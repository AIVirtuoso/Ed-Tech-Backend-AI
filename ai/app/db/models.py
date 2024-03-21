from sqlmodel import Field, SQLModel, Relationship, JSON, Column, Enum
from typing import List, Optional
import enum
import uuid as uuid_pkg
from datetime import datetime
class Reference(str, enum.Enum):
    student = "student"
    document = "document"
    note = "note"
class DocumentReference(str, enum.Enum):
    student = "student"
    shepherdtutors = "shepherdtutors"


class Conversations(SQLModel, table=True):
    __tablename__ = "Conversations"
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    title: str | None = Field(default=None)
    topic: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    level: str | None = Field(default=None)
    language: str = Field(default="English")

    #ChatLog: List["ConversationLogs"] = Relationship(back_populates="Conversations")
    reference: Reference =  Field(sa_column=Column(Enum(Reference), nullable=False, default="document"))
    referenceId: str = Field(default=None, nullable=False)

    createdAt: datetime = Field(default_factory=datetime.now(datetime.UTC), nullable=False)
    updatedAt: datetime | None = Field(default_factory=datetime.now(datetime.UTC), nullable=True)
    deletedAt: datetime | None = Field(default=None, nullable=True)

class ConversationLogs(SQLModel, table=True):
    __tablename__ = "ConversationLogs"
    id: uuid_pkg.UUID = Field(
        default_factory=uuid_pkg.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    studentId: str = Field(default=None, nullable=False)
    liked: bool = Field(default=False)
    disliked: bool = Field(default=False)
    isPinned: bool = Field(default=False)
    conversationId: Optional[int] = Field(default=None, foreign_key="conversations.id")
    # conversation: Optional[Conversations] = Relationship(back_populates="ConversationLogs")
    log: dict = Field(default={}, sa_column=Column(JSON))
    
  


# class Document(SQLModel, table=True):
#     __tablename__ = "Documents"
#     id: uuid_pkg.UUID = Field(
#         default_factory=uuid_pkg.uuid4,
#         primary_key=True,
#         index=True,
#         nullable=False,
#     )
#     reference: DocumentReference =  Field(sa_column=Column(Enum(DocumentReference), nullable=False))
#     title: str = Field(default=None, nullable=False)
#     referenceId: str = Field(default=None, nullable=False)
#     documentURL: str | None = Field(default=None)
#     documentId: str = Field(default=None, primary_key=True)
#     courseId: str | None = Field(default=None)
#     summary: str | None = Field(default=None)
#     keywords: dict | None = Field(default=None)


# class HighlightComments(SQLModel, table=True):
#     __tablename__ = "HighlightComments"
#     id: uuid_pkg.UUID = Field(
#         default_factory=uuid_pkg.uuid4,
#         primary_key=True,
#         index=True,
#         nullable=False,
#     )
#     content: str = Field(default=None, nullable=False)
#     highlightId: str = Field(default=None, foreign_key="Highlights.id")
#     studentId: str = Field(default=None, nullable=False)


# class Highlights(SQLModel, table=True):
#     __tablename__ = "Highlights"
#     id: str = Field(default=None, primary_key=True)
#     highlight: dict = Field(default=None, nullable=False)
#     documentId: str = Field(default=None, nullable=False)

#     comments: list[HighlightComments] = Relationship(backpopulates="Highlights")



