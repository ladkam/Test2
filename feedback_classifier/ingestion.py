"""Ingestion pipeline for various feedback sources.

Supports:
- NPS survey responses (CSV, JSON, or API)
- Zendesk tickets (API or export)
- Generic feedback (any text source)
"""
import csv
import json
import uuid
from datetime import datetime
from typing import Iterator, Optional

from models import FeedbackItem, FeedbackSource, UserProfile
from database import get_database, DatabaseBase
from ai_service import AIService


class FeedbackIngester:
    """Ingests feedback from various sources, classifies, and stores it."""

    def __init__(self, db: DatabaseBase = None, ai: AIService = None):
        self.db = db or get_database()
        self.ai = ai or AIService()
        self.db.initialize()

    def ingest_single(
        self,
        text: str,
        source: FeedbackSource,
        user_profile: Optional[UserProfile] = None,
        nps_score: Optional[int] = None,
        ticket_id: Optional[str] = None,
        ticket_priority: Optional[str] = None,
        created_at: Optional[datetime] = None,
        skip_classification: bool = False,
    ) -> FeedbackItem:
        """Ingest a single feedback item.

        1. Generates embedding
        2. Classifies content
        3. Stores in database
        """
        feedback = FeedbackItem(
            id=str(uuid.uuid4()),
            text=text,
            source=source,
            created_at=created_at or datetime.now(),
            user_profile=user_profile,
            nps_score=nps_score,
            ticket_id=ticket_id,
            ticket_priority=ticket_priority,
        )

        # Generate embedding
        feedback.embedding = self.ai.generate_embedding(text)

        # Classify
        if not skip_classification:
            feedback.classification = self.ai.classify_feedback(
                text=text,
                user_profile=user_profile,
                nps_score=nps_score,
                source=source.value,
            )

        # Store
        self.db.insert_feedback(feedback)

        return feedback

    def ingest_batch(
        self,
        items: list[dict],
        source: FeedbackSource,
        skip_classification: bool = False,
        batch_size: int = 10,
    ) -> list[FeedbackItem]:
        """Ingest multiple feedback items efficiently.

        Expected item format:
        {
            "text": "feedback text",
            "user_id": "optional",
            "email": "optional",
            "subscription_type": "optional",
            "mrr": 0.0,
            "nps_score": 8,  # for NPS
            "ticket_id": "123",  # for Zendesk
            "created_at": "2025-01-15T10:00:00"
        }
        """
        results = []

        # Process in batches for embedding efficiency
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            texts = [item["text"] for item in batch]

            # Batch embed
            embeddings = self.ai.generate_embeddings_batch(texts)

            for j, item in enumerate(batch):
                # Build user profile if data available
                user_profile = None
                if item.get("user_id"):
                    user_profile = UserProfile(
                        user_id=item["user_id"],
                        email=item.get("email"),
                        subscription_type=item.get("subscription_type"),
                        mrr=item.get("mrr"),
                        company_name=item.get("company_name"),
                        industry=item.get("industry"),
                    )

                feedback = FeedbackItem(
                    id=str(uuid.uuid4()),
                    text=item["text"],
                    source=source,
                    created_at=datetime.fromisoformat(item["created_at"])
                    if item.get("created_at")
                    else datetime.now(),
                    user_profile=user_profile,
                    embedding=embeddings[j],
                    nps_score=item.get("nps_score"),
                    ticket_id=item.get("ticket_id"),
                    ticket_priority=item.get("ticket_priority"),
                )

                # Classify individually (could batch with careful prompt engineering)
                if not skip_classification:
                    feedback.classification = self.ai.classify_feedback(
                        text=item["text"],
                        user_profile=user_profile,
                        nps_score=item.get("nps_score"),
                        source=source.value,
                    )

                self.db.insert_feedback(feedback)
                results.append(feedback)

                print(f"Ingested {len(results)}/{len(items)}: {item['text'][:50]}...")

        return results

    def ingest_nps_csv(
        self,
        filepath: str,
        text_column: str = "response",
        score_column: str = "score",
        user_id_column: str = "user_id",
        email_column: str = "email",
        date_column: str = "date",
    ) -> list[FeedbackItem]:
        """Ingest NPS responses from a CSV file.

        Expected columns (configurable):
        - response: The text feedback
        - score: NPS score (0-10)
        - user_id: User identifier
        - email: User email (optional)
        - date: Response date (optional)
        """
        items = []

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row.get(text_column):
                    continue  # Skip empty responses

                items.append(
                    {
                        "text": row[text_column],
                        "nps_score": int(row[score_column]) if row.get(score_column) else None,
                        "user_id": row.get(user_id_column),
                        "email": row.get(email_column),
                        "created_at": row.get(date_column),
                    }
                )

        return self.ingest_batch(items, FeedbackSource.NPS)

    def ingest_zendesk_json(
        self,
        filepath: str,
    ) -> list[FeedbackItem]:
        """Ingest Zendesk tickets from JSON export.

        Expected format:
        [
            {
                "id": "12345",
                "description": "ticket text",
                "priority": "high",
                "requester": {
                    "id": "user_123",
                    "email": "user@example.com"
                },
                "created_at": "2025-01-15T10:00:00Z"
            }
        ]
        """
        with open(filepath, "r", encoding="utf-8") as f:
            tickets = json.load(f)

        items = []
        for ticket in tickets:
            items.append(
                {
                    "text": ticket.get("description", ""),
                    "ticket_id": str(ticket.get("id")),
                    "ticket_priority": ticket.get("priority"),
                    "user_id": ticket.get("requester", {}).get("id"),
                    "email": ticket.get("requester", {}).get("email"),
                    "created_at": ticket.get("created_at"),
                }
            )

        return self.ingest_batch(items, FeedbackSource.ZENDESK)

    def ingest_user_profiles_csv(
        self,
        filepath: str,
    ) -> int:
        """Import user profiles from CSV for enrichment.

        Expected columns:
        - user_id (required)
        - email
        - subscription_type
        - mrr
        - company_name
        - industry
        """
        count = 0

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row.get("user_id"):
                    continue

                profile = UserProfile(
                    user_id=row["user_id"],
                    email=row.get("email"),
                    subscription_type=row.get("subscription_type"),
                    mrr=float(row["mrr"]) if row.get("mrr") else None,
                    company_name=row.get("company_name"),
                    industry=row.get("industry"),
                )

                self.db.insert_user_profile(profile)
                count += 1

        return count


# Convenience function for quick ingestion
def ingest_feedback(
    text: str,
    source: str = "nps",
    user_id: str = None,
    nps_score: int = None,
    **kwargs,
) -> FeedbackItem:
    """Quick function to ingest a single feedback item."""
    ingester = FeedbackIngester()

    user_profile = None
    if user_id:
        user_profile = UserProfile(user_id=user_id, **kwargs)

    return ingester.ingest_single(
        text=text,
        source=FeedbackSource(source),
        user_profile=user_profile,
        nps_score=nps_score,
    )
