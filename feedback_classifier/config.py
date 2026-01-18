"""Configuration for feedback classification system."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Google AI
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

    # Models (current as of Jan 2025)
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    CLASSIFICATION_MODEL = os.getenv("CLASSIFICATION_MODEL", "gemini-2.5-flash")

    # Embedding dimensions (768, 1536, or 3072)
    EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))

    # Database
    USE_SQLITE = os.getenv("USE_SQLITE", "true").lower() == "true"
    SQLITE_PATH = os.getenv("SQLITE_PATH", "./feedback.db")
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/feedback_db")

    # Classification taxonomy
    TOPICS = [
        "bug",
        "feature_request",
        "pricing",
        "ux",
        "performance",
        "onboarding",
        "support",
        "documentation",
        "integration",
        "security",
        "billing",
        "mobile",
        "api",
    ]

    SENTIMENTS = ["positive", "neutral", "negative"]
    URGENCY_LEVELS = ["low", "medium", "high"]
    INTENTS = [
        "churn_risk",
        "upsell_opportunity",
        "support_needed",
        "feature_advocacy",
        "general_feedback",
    ]
