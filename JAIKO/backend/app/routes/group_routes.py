from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Group, GroupMember, Chat, ChatMember
from ..services.notification_service import send_notification

group_bp = Blueprint("groups", __name__)


@group_bp.route("/", methods=["GET"])
@jwt_required()
def list_groups():
    city = request.args.get("city", "Asunción")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    q = Group.query.filter(Group.city == city, Group.status == "open")
    total = q.count()
    groups = q.order_by(Group.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({
        "groups": [g.to_dict() for g in groups],
        "total": total,
        "page": page,
    }), 200


@group_bp.route("/", methods=["POST"])
@jwt_required()
def create_group():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data.get("name"):
        return jsonify({"error": "name is required"}), 400

    group = Group(
        name=data["name"],
        description=data.get("description"),
        city=data.get("city", "Asunción"),
        max_members=data.get("max_members", 3),
        created_by=user_id,
        budget_max=data.get("budget_max"),
        pets_allowed=data.get("pets_allowed", False),
        smoking_allowed=data.get("smoking_allowed", False),
    )
    db.session.add(group)
    db.session.flush()

    # Creator joins as admin
    member = GroupMember(group_id=group.id, user_id=user_id, role="admin", status="active")
    db.session.add(member)

    # Create a group chat
    chat = Chat(type="group", group_id=group.id)
    db.session.add(chat)
    db.session.flush()

    chat_member = ChatMember(chat_id=chat.id, user_id=user_id)
    db.session.add(chat_member)

    db.session.commit()
    return jsonify({"group": group.to_dict()}), 201


@group_bp.route("/<int:group_id>", methods=["GET"])
@jwt_required()
def get_group(group_id):
    group = Group.query.get_or_404(group_id)
    return jsonify({"group": group.to_dict()}), 200


@group_bp.route("/<int:group_id>/join", methods=["POST"])
@jwt_required()
def join_group(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get_or_404(group_id)

    if group.is_full:
        return jsonify({"error": "Group is full"}), 400

    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing and existing.status == "active":
        return jsonify({"error": "Already a member"}), 400

    if existing:
        existing.status = "active"
    else:
        member = GroupMember(group_id=group_id, user_id=user_id, status="active")
        db.session.add(member)

    # Add to group chat
    chat = Chat.query.filter_by(group_id=group_id).first()
    if chat:
        cm = ChatMember.query.filter_by(chat_id=chat.id, user_id=user_id).first()
        if not cm:
            db.session.add(ChatMember(chat_id=chat.id, user_id=user_id))

    if group.current_members + 1 >= group.max_members:
        group.status = "full"

    db.session.commit()

    # Notify group admin
    send_notification(
        user_id=group.created_by,
        type="group_invite",
        title="Nuevo miembro en tu grupo",
        content=f"Alguien se unió a tu grupo {group.name}",
        data={"group_id": group_id},
    )
    return jsonify({"message": "Joined successfully", "group": group.to_dict()}), 200


@group_bp.route("/<int:group_id>/join-request", methods=["POST"])
@jwt_required()
def request_join_group(group_id):
    """
    Nueva ruta para manejar solicitudes de ingreso al grupo.
    Crea un registro pendiente y notifica a todos los miembros activos.
    """
    user_id = int(get_jwt_identity())
    group = Group.query.get_or_404(group_id)

    # Verificar si ya hay un miembro o solicitud existente
    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing:
        return jsonify({"error": "Ya eres miembro o ya enviaste una solicitud"}), 400

    # Crear solicitud pendiente
    member = GroupMember(group_id=group_id, user_id=user_id, status="pending")
    db.session.add(member)
    db.session.commit()

    # Enviar notificación a todos los miembros activos
    active_members = GroupMember.query.filter_by(group_id=group_id, status="active").all()
    for m in active_members:
        send_notification(
            user_id=m.user_id,
            type="join_request",
            title="Solicitud de ingreso",
            content=f"El usuario {user_id} ha solicitado unirse a tu grupo {group.name}",
            data={"group_id": group_id, "request_user_id": user_id},
        )

    return jsonify({"message": "Solicitud enviada"}), 200


@group_bp.route("/<int:group_id>/leave", methods=["POST"])
@jwt_required()
def leave_group(group_id):
    user_id = int(get_jwt_identity())
    member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        return jsonify({"error": "Not a member"}), 404
    member.status = "left"
    group = Group.query.get(group_id)
    if group.status == "full":
        group.status = "open"
    db.session.commit()

    # Verificar si el grupo quedó sin miembros activos y eliminarlo
    active_members_count = GroupMember.query.filter_by(group_id=group_id, status="active").count()
    if active_members_count == 0:
        # Eliminar chat si existe
        chat = Chat.query.filter_by(group_id=group_id).first()
        if chat:
            ChatMember.query.filter_by(chat_id=chat.id).delete()
            db.session.delete(chat)
        # Eliminar el grupo
        db.session.delete(group)
        db.session.commit()

    return jsonify({"message": "Left group"}), 200


@group_bp.route("/my", methods=["GET"])
@jwt_required()
def my_groups():
    user_id = int(get_jwt_identity())
    memberships = GroupMember.query.filter_by(user_id=user_id, status="active").all()
    groups = [m.group.to_dict() for m in memberships]
    return jsonify({"groups": groups}), 200


@group_bp.route("/<int:group_id>", methods=["PUT"])
@jwt_required()
def update_group(group_id):
    user_id = int(get_jwt_identity())
    group = Group.query.get_or_404(group_id)
    
    # Verificar si el usuario es miembro activo del grupo
    member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id, status="active").first()
    if not member:
        return jsonify({"error": "No tienes permiso para editar este grupo"}), 403

    data = request.get_json()

    # Actualizar campos editables
    group.name = data.get("name", group.name)
    group.description = data.get("description", group.description)
    group.city = data.get("city", group.city)
    group.budget_max = data.get("budget_max", group.budget_max)
    group.pets_allowed = data.get("pets_allowed", group.pets_allowed)
    group.smoking_allowed = data.get("smoking_allowed", group.smoking_allowed)

    db.session.commit()

    return jsonify({"group": group.to_dict()}), 200