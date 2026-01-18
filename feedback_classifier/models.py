"""Data models for feedback classification system."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum


class FeedbackSource(str, Enum):
    NPS = "nps"
    ZENDESK = "zendesk"
    INTERCOM = "intercom"
    EMAIL = "email"
    OTHER = "other"


class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Intent(str, Enum):
    CHURN_RISK = "churn_risk"
    UPSELL_OPPORTUNITY = "upsell_opportunity"
    SUPPORT_NEEDED = "support_needed"
    FEATURE_ADVOCACY = "feature_advocacy"
    GENERAL_FEEDBACK = "general_feedback"


@dataclass
class UserProfile:
    """User profile with traits for context-aware classification."""

    user_id: str
    email: Optional[str] = None
    subscription_type: Optional[str] = None  # free, starter, pro, enterprise
    mrr: Optional[float] = None  # Monthly Recurring Revenue
    company_name: Optional[str] = None
    industry: Optional[str] = None
    signup_date: Optional[datetime] = None
    custom_traits: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "subscription_type": self.subscription_type,
            "mrr": self.mrr,
            "company_name": self.company_name,
            "industry": self.industry,
            "signup_date": self.signup_date.isoformat() if self.signup_date else None,
            "custom_traits": self.custom_traits,
        }


@dataclass
class Classification:
    """Classification results for a feedback item."""

    sentiment: Sentiment
    topics: list[str]
    urgency: Urgency
    intent: Intent
    summary: str
    confidence: float = 0.0

    def to_dict(self) -> dict:
        return {
            "sentiment": self.sentiment.value,
            "topics": self.topics,
            "urgency": self.urgency.value,
            "intent": self.intent.value,
            "summary": self.summary,
            "confidence": self.confidence,
        }


@dataclass
class FeedbackItem:
    """A single feedback item with all associated data."""

    id: str
    text: str
    source: FeedbackSource
    created_at: datetime
    user_profile: Optional[UserProfile] = None
    classification: Optional[Classification] = None
    embedding: Optional[list[float]] = None

    # Source-specific metadata
    nps_score: Optional[int] = None  # 0-10 for NPS
    ticket_id: Optional[str] = None  # Zendesk ticket ID
    ticket_priority: Optional[str] = None  # Zendesk priority

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "source": self.source.value,
            "created_at": self.created_at.isoformat(),
            "user_profile": self.user_profile.to_dict() if self.user_profile else None,
            "classification": self.classification.to_dict()
            if self.classification
            else None,
            "nps_score": self.nps_score,
            "ticket_id": self.ticket_id,
            "ticket_priority": self.ticket_priority,
        }


@dataclass
class SearchQuery:
    """Query parameters for searching feedback."""

    # Semantic search
    query_text: Optional[str] = None

    # Metadata filters
    sources: Optional[list[FeedbackSource]] = None
    sentiments: Optional[list[Sentiment]] = None
    topics: Optional[list[str]] = None
    urgency_levels: Optional[list[Urgency]] = None
    intents: Optional[list[Intent]] = None

    # User profile filters
    subscription_types: Optional[list[str]] = None
    min_mrr: Optional[float] = None
    max_mrr: Optional[float] = None
    industries: Optional[list[str]] = None

    # NPS specific
    min_nps: Optional[int] = None
    max_nps: Optional[int] = None

    # Date range
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    # Pagination
    limit: int = 20
    offset: int = 0


@dataclass
class SearchResult:
    """Result of a feedback search."""

    items: list[FeedbackItem]
    total_count: int
    query: SearchQuery
    summary: Optional[str] = None  # AI-generated summary of results
