"""Feedback Classification Tool.

AI-powered classification and search for customer feedback.
"""
from .models import (
    FeedbackItem,
    FeedbackSource,
    Classification,
    UserProfile,
    SearchQuery,
    SearchResult,
    Sentiment,
    Urgency,
    Intent,
)
from .ingestion import FeedbackIngester, ingest_feedback
from .query_service import FeedbackQueryService
from .ai_service import AIService
from .database import get_database

__version__ = "1.0.0"
__all__ = [
    "FeedbackItem",
    "FeedbackSource",
    "Classification",
    "UserProfile",
    "SearchQuery",
    "SearchResult",
    "Sentiment",
    "Urgency",
    "Intent",
    "FeedbackIngester",
    "FeedbackQueryService",
    "AIService",
    "ingest_feedback",
    "get_database",
]
