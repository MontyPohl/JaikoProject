from datetime import datetime
from ..extensions import db
from typing import Optional

class Chat(db.Model):
    __tablename__ = "chats"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), nullable=False, default="private")  # private | group | listing
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship("ChatMember", back_populates="chat", cascade="all, delete-orphan")
    messages = db.relationship("Message", back_populates="chat", cascade="all, delete-orphan",
                               order_by="Message.created_at")

    def get_last_message(self):
        if self.messages:
            return self.messages[-1].to_dict()
        return None

    def to_dict(self, user_id: Optional[int] = None) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "group_id": self.group_id,
            "listing_id": self.listing_id,
            "members": [m.to_dict() for m in self.members],
            "last_message": self.get_last_message(),
            "created_at": self.created_at.isoformat(),
        }


class ChatMember(db.Model):
    __tablename__ = "chat_members"

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey("chats.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_read_at = db.Column(db.DateTime, nullable=True)

    chat = db.relationship("Chat", back_populates="members")
    user = db.relationship("User")

    def to_dict(self) -> dict:
        profile = self.user.profile
        return {
            "user_id": self.user_id,
            "name": profile.name if profile else self.user.email,
            "photo": profile.profile_photo_url if profile else None,
            "joined_at": self.joined_at.isoformat(),
        }


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey("chats.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), default="text")     # text | image | system
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    chat = db.relationship("Chat", back_populates="messages")
    sender = db.relationship("User")

    def to_dict(self) -> dict:
        profile = self.sender.profile
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "sender_id": self.sender_id,
            "sender_name": profile.name if profile else self.sender.email,
            "sender_photo": profile.profile_photo_url if profile else None,
            "content": self.content,
            "type": self.type,
            "created_at": self.created_at.isoformat(),
        }
