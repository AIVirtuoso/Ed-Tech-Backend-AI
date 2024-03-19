from sqlmodel import Field, SQLModel, Relationship, JSON, Column
from typing import List, Optional
from datetime import datetime

class Conversations(SQLModel, table=True):
    __tablename__ = "Conversations"
    id: str = Field(default=None, primary_key=True)
    title: str | None = Field(default=None)
    topic: str | None = Field(default=None)
    subject: str | None = Field(default=None)
    level: str | None = Field(default=None)
    language: str = Field(default="English")

    ChatLog: List["ChatLog"] = Relationship(back_populates="Conversations")
    reference: str = Field(default="document", enum=["student", "document", "note"], nullable=False)
    referenceId: str = Field(default=None, nullable=False)

    createdAt: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updatedAt: datetime | None = Field(default=None, nullable=True)
    deletedAt: datetime | None = Field(default=None, nullable=True)

class ChatLog(SQLModel, table=True):
    __tablename__ = "ChatLog"
    studentId: str = Field(default=None, nullable=False)
    liked: bool = Field(default=False)
    disliked: bool = Field(default=False)
    isPinned: bool = Field(default=False)
    conversationId: Optional[int] = Field(default=None, foreign_key="Conversations.id")
    conversation: Optional[Conversations] = Relationship(backpopulates="ChatLog")
    log: dict = Field(default={}, sa_column=Column(JSON))
    
  


class Document(SQLModel, table=True):
    __tablename__ = "Document"
    reference: str = Field(default="document", enum=["student", "shepherdtutors"], nullable=False)
    title: str = Field(default=None, nullable=False)
    referenceId: str = Field(default=None, nullable=False)
    documentURL: str | None = Field(default=None)
    documentId: str = Field(default=None, primary_key=True)
    courseId: str | None = Field(default=None)
    summary: str | None = Field(default=None)
    keywords: dict | None = Field(default=None)


class HighlightComment(SQLModel, table=True):
    __tablename__ = "HighlightComment"
    id: str = Field(default=None, primary_key=True)
    content: str = Field(default=None, nullable=False)
    highlightId: str = Field(default=None, foreign_key="Highlight.id")
    studentId: str = Field(default=None, nullable=False)


class Highlight(SQLModel, table=True):
    __tablename__ = "Highlight"
    id: str = Field(default=None, primary_key=True)
    highlight: dict = Field(default=None, nullable=False)
    documentId: str = Field(default=None, nullable=False)

    comments: list[HighlightComment] = Relationship(backpopulates="Highlight")



