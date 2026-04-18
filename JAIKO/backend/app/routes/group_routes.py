"""
app/routes/group_routes.py
───────────────────────────
Endpoints de grupos de búsqueda de roomies.

Cambios respecto a la versión anterior:
    Solo se modificó el endpoint GET / (list_groups).
    Todos los demás endpoints están intactos y funcionan igual.

    Filtros nuevos en GET /groups/:
        pets_allowed     → filtra por Group.pets_allowed (boolean)
        smoking_allowed  → filtra por Group.smoking_allowed (boolean)
        budget_max       → filtra grupos con presupuesto <= al valor enviado
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from ..extensions import db
from ..models import Group, GroupMember, Chat, ChatMember
from ..services.notification_service import send_notification
from ..utils.jwt_helpers import get_current_user_id

# ✅ NUEVO: parse_bool desde el helper compartido
from ..utils.query_helpers import parse_bool

group_bp = Blueprint("groups", __name__)


# ── Listar grupos ─────────────────────────────────────────────────────────────
@group_bp.route("/", methods=["GET"])
@jwt_required()
def list_groups():
    # ── Parámetros existentes (sin cambios) ────────────────────────────────────
    city     = request.args.get("city", "Asunción")
    page     = request.args.get("page",     1,  type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20

    # ── ✅ NUEVOS: Filtros opcionales ──────────────────────────────────────────
    #
    # Mapeo frontend → DB:
    #   ?pets_allowed=true/false   → Group.pets_allowed    (BOOLEAN)
    #   ?smoking_allowed=true/false → Group.smoking_allowed (BOOLEAN)
    #   ?budget_max=1500000        → Group.budget_max       (INTEGER)
    #
    # Todos son opcionales. Si no vienen en la URL, no se aplican.
    # parse_bool convierte "true"/"false" → True/False (ver utils/query_helpers.py)

    pets_filter    = parse_bool(request.args.get("pets_allowed"))
    smoking_filter = parse_bool(request.args.get("smoking_allowed"))

    # type=int en Flask: si el valor no es un entero válido (o no viene),
    # devuelve None sin explotar con un ValueError.
    budget_max_filter = request.args.get("budget_max", type=int)

    # ── Query base (igual que antes) ──────────────────────────────────────────
    q = Group.query.filter(Group.city == city, Group.status == "open")

    # ── ✅ Aplicar filtros booleanos ──────────────────────────────────────────
    #
    # Por qué "is not None" y no solo "if pets_filter":
    #   Si el usuario pide pets_allowed=false, pets_filter == False.
    #   `if False` no ejecutaría el filtro → bug silencioso.
    #   `if pets_filter is not None` distingue "no enviado" de "enviado como False".
    if pets_filter is not None:
        q = q.filter(Group.pets_allowed == pets_filter)

    if smoking_filter is not None:
        q = q.filter(Group.smoking_allowed == smoking_filter)

    # ── ✅ Aplicar filtro de presupuesto ──────────────────────────────────────
    #
    # Semántica: el usuario quiere grupos cuyo presupuesto max sea <= su budget.
    # Ejemplo: si envía ?budget_max=1500000, ve grupos con budget_max ≤ 1,500,000.
    #
    # Por qué or_(Group.budget_max == None, ...):
    #   Algunos grupos no tienen budget_max definido (campo nullable).
    #   NULL en SQL nunca es <= a nada → esos grupos quedarían excluidos.
    #   Con el or_, los grupos sin presupuesto definido siempre aparecen,
    #   porque NULL = "sin restricción de presupuesto" (más permisivo).
    if budget_max_filter is not None:
        q = q.filter(
            or_(
                Group.budget_max == None,
                Group.budget_max <= budget_max_filter,
            )
        )

    # ── Paginación y respuesta (igual que antes) ───────────────────────────────
    total  = q.count()
    groups = (
        q.order_by(Group.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return (
        jsonify(
            {"groups": [g.to_dict() for g in groups], "total": total, "page": page}
        ),
        200,
    )


# ── Crear grupo ───────────────────────────────────────────────────────────────
@group_bp.route("/", methods=["POST"])
@jwt_required()
def create_group():
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    data = request.get_json()
    if not data.get("name"):
        return jsonify({"error": "El nombre del grupo es requerido"}), 400

    max_members = max(2, min(int(data.get("max_members", 3)), 6))

    group = Group(
        name=data["name"],
        description=data.get("description"),
        city=data.get("city", "Asunción"),
        max_members=max_members,
        created_by=user_id,
        budget_max=data.get("budget_max"),
        pets_allowed=data.get("pets_allowed", False),
        smoking_allowed=data.get("smoking_allowed", False),
    )
    db.session.add(group)
    db.session.flush()

    db.session.add(
        GroupMember(group_id=group.id, user_id=user_id, role="admin", status="active")
    )

    chat = Chat(type="group", group_id=group.id)
    db.session.add(chat)
    db.session.flush()
    db.session.add(ChatMember(chat_id=chat.id, user_id=user_id))

    db.session.commit()
    return jsonify({"group": group.to_dict()}), 201


# ── Obtener grupo ─────────────────────────────────────────────────────────────
@group_bp.route("/<int:group_id>", methods=["GET"])
@jwt_required()
def get_group(group_id):
    group      = Group.query.get_or_404(group_id)
    group_data = group.to_dict()

    pending_members = GroupMember.query.filter_by(
        group_id=group_id, status="pending"
    ).all()
    group_data["join_requests"] = [
        {
            "id": m.id,
            "user": {
                "id": m.user_id,
                "profile": (
                    m.user.profile.to_dict() if m.user and m.user.profile else {}
                ),
            },
        }
        for m in pending_members
    ]
    return jsonify({"group": group_data}), 200


# ── Unirse directamente al grupo ──────────────────────────────────────────────
@group_bp.route("/<int:group_id>/join", methods=["POST"])
@jwt_required()
def join_group(group_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    group = Group.query.get_or_404(group_id)
    if group.is_full:
        return jsonify({"error": "El grupo está lleno"}), 400

    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing and existing.status == "active":
        return jsonify({"error": "Ya sos miembro de este grupo"}), 400

    if existing:
        existing.status = "active"
    else:
        db.session.add(GroupMember(group_id=group_id, user_id=user_id, status="active"))

    chat = Chat.query.filter_by(group_id=group_id).first()
    if (
        chat
        and not ChatMember.query.filter_by(chat_id=chat.id, user_id=user_id).first()
    ):
        db.session.add(ChatMember(chat_id=chat.id, user_id=user_id))

    if group.current_members + 1 >= group.max_members:
        group.status = "full"

    db.session.commit()

    send_notification(
        user_id=group.created_by,
        notif_type="group_invite",
        title="Nuevo miembro en tu grupo",
        content=f"Alguien se unió a tu grupo {group.name}",
        data={"group_id": group_id},
    )
    return jsonify({"message": "Te uniste al grupo", "group": group.to_dict()}), 200


# ── Solicitar unirse al grupo ─────────────────────────────────────────────────
@group_bp.route("/<int:group_id>/join-request", methods=["POST"])
@jwt_required()
def request_join_group(group_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    group    = Group.query.get_or_404(group_id)
    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()

    if existing and existing.status in ["active", "pending"]:
        return jsonify({"error": "Ya sos miembro o ya enviaste una solicitud"}), 400

    try:
        if existing:
            existing.status = "pending"
            member = existing
        else:
            member = GroupMember(group_id=group_id, user_id=user_id, status="pending")
            db.session.add(member)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"No se pudo guardar la solicitud: {str(e)}"}), 500

    active_members = GroupMember.query.filter_by(
        group_id=group_id, status="active"
    ).all()
    for m in active_members:
        send_notification(
            user_id=m.user_id,
            notif_type="join_request",
            title="Solicitud de ingreso al grupo",
            content=f"Un usuario quiere unirse a {group.name}",
            data={"group_id": group_id, "request_user_id": user_id},
        )

    return (
        jsonify(
            {
                "message": "Solicitud enviada",
                "member": {"id": member.id, "status": member.status},
            }
        ),
        200,
    )


# ── Aceptar solicitud ─────────────────────────────────────────────────────────
@group_bp.route(
    "/<int:group_id>/join-request/<int:request_id>/accept", methods=["POST"]
)
@jwt_required()
def accept_join_request(group_id, request_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    admin = GroupMember.query.filter_by(
        group_id=group_id, user_id=user_id, role="admin", status="active"
    ).first()
    if not admin:
        return jsonify({"error": "Solo un admin puede aceptar solicitudes"}), 403

    request_member = GroupMember.query.get_or_404(request_id)
    request_member.status = "active"

    group = Group.query.get(group_id)
    if group.current_members + 1 >= group.max_members:
        group.status = "full"

    chat = Chat.query.filter_by(group_id=group_id).first()
    if (
        chat
        and not ChatMember.query.filter_by(
            chat_id=chat.id, user_id=request_member.user_id
        ).first()
    ):
        db.session.add(ChatMember(chat_id=chat.id, user_id=request_member.user_id))

    db.session.commit()

    send_notification(
        user_id=request_member.user_id,
        notif_type="request_accepted",
        title=f"Aceptado en {group.name}",
        content="¡Fuiste agregado al grupo!",
        data={"group_id": group_id},
    )
    return jsonify({"message": "Solicitud aceptada"}), 200


# ── Rechazar solicitud ────────────────────────────────────────────────────────
@group_bp.route(
    "/<int:group_id>/join-request/<int:request_id>/reject", methods=["POST"]
)
@jwt_required()
def reject_join_request(group_id, request_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    admin = GroupMember.query.filter_by(
        group_id=group_id, user_id=user_id, role="admin", status="active"
    ).first()
    if not admin:
        return jsonify({"error": "Solo un admin puede rechazar solicitudes"}), 403

    request_member = GroupMember.query.get_or_404(request_id)
    group          = Group.query.get_or_404(group_id)
    request_member.status = "rejected"
    db.session.commit()

    send_notification(
        user_id=request_member.user_id,
        notif_type="request_rejected",
        title=f"Solicitud rechazada en {group.name}",
        content="Tu solicitud fue rechazada.",
        data={"group_id": group_id},
    )
    return jsonify({"message": "Solicitud rechazada"}), 200


# ── Salir del grupo ───────────────────────────────────────────────────────────
@group_bp.route("/<int:group_id>/leave", methods=["POST"])
@jwt_required()
def leave_group(group_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        return jsonify({"error": "No sos miembro de este grupo"}), 404

    member.status = "left"
    group = Group.query.get(group_id)
    if group and group.status == "full":
        group.status = "open"

    db.session.commit()

    active_count = GroupMember.query.filter_by(
        group_id=group_id, status="active"
    ).count()
    if active_count == 0:
        chat = Chat.query.filter_by(group_id=group_id).first()
        if chat:
            ChatMember.query.filter_by(chat_id=chat.id).delete()
            db.session.delete(chat)
        db.session.delete(group)
        db.session.commit()

    return jsonify({"message": "Saliste del grupo"}), 200


# ── Mis grupos ────────────────────────────────────────────────────────────────
@group_bp.route("/my", methods=["GET"])
@jwt_required()
def my_groups():
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    memberships = GroupMember.query.filter_by(user_id=user_id, status="active").all()
    groups      = [m.group.to_dict() for m in memberships]
    return jsonify({"groups": groups}), 200


# ── Actualizar grupo ──────────────────────────────────────────────────────────
@group_bp.route("/<int:group_id>", methods=["PUT"])
@jwt_required()
def update_group(group_id):
    user_id = get_current_user_id()
    if user_id is None:
        return jsonify({"error": "Token inválido. Iniciá sesión nuevamente."}), 401

    group  = Group.query.get_or_404(group_id)
    member = GroupMember.query.filter_by(
        group_id=group_id, user_id=user_id, status="active", role="admin"
    ).first()
    if not member:
        return jsonify({"error": "Solo el administrador del grupo puede editarlo"}), 403

    data = request.get_json()
    group.name            = data.get("name",            group.name)
    group.description     = data.get("description",     group.description)
    group.city            = data.get("city",            group.city)
    group.budget_max      = data.get("budget_max",      group.budget_max)
    group.pets_allowed    = data.get("pets_allowed",    group.pets_allowed)
    group.smoking_allowed = data.get("smoking_allowed", group.smoking_allowed)

    db.session.commit()
    return jsonify({"group": group.to_dict()}), 200
