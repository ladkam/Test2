"""Query service for searching and analyzing feedback.

Supports:
- Semantic search (natural language queries)
- Structured filters (sentiment, topics, user segments)
- Proactive alerts (high-value user issues, churn risks)
- Custom reclassification
"""
from datetime import datetime, timedelta
from typing import Optional

from models import (
    FeedbackItem,
    FeedbackSource,
    Intent,
    SearchQuery,
    SearchResult,
    Sentiment,
    Urgency,
)
from database import get_database, DatabaseBase
from ai_service import AIService


class FeedbackQueryService:
    """Service for querying and analyzing feedback."""

    def __init__(self, db: DatabaseBase = None, ai: AIService = None):
        self.db = db or get_database()
        self.ai = ai or AIService()
        self.db.initialize()

    def search(
        self,
        query_text: Optional[str] = None,
        sources: Optional[list[str]] = None,
        sentiments: Optional[list[str]] = None,
        topics: Optional[list[str]] = None,
        urgency_levels: Optional[list[str]] = None,
        intents: Optional[list[str]] = None,
        subscription_types: Optional[list[str]] = None,
        min_mrr: Optional[float] = None,
        max_mrr: Optional[float] = None,
        min_nps: Optional[int] = None,
        max_nps: Optional[int] = None,
        days_back: Optional[int] = None,
        limit: int = 20,
    ) -> SearchResult:
        """Search feedback with filters and semantic search.

        Args:
            query_text: Natural language search query (uses embeddings)
            sources: Filter by source ["nps", "zendesk"]
            sentiments: Filter by sentiment ["positive", "neutral", "negative"]
            topics: Filter by topics ["bug", "pricing", "ux", ...]
            urgency_levels: Filter by urgency ["low", "medium", "high"]
            intents: Filter by intent ["churn_risk", "upsell_opportunity", ...]
            subscription_types: Filter by user subscription
            min_mrr, max_mrr: Filter by user MRR range
            min_nps, max_nps: Filter by NPS score range
            days_back: Only include feedback from last N days
            limit: Maximum results to return

        Returns:
            SearchResult with matching feedback items
        """
        # Build search query
        search_query = SearchQuery(
            query_text=query_text,
            sources=[FeedbackSource(s) for s in sources] if sources else None,
            sentiments=[Sentiment(s) for s in sentiments] if sentiments else None,
            topics=topics,
            urgency_levels=[Urgency(u) for u in urgency_levels] if urgency_levels else None,
            intents=[Intent(i) for i in intents] if intents else None,
            subscription_types=subscription_types,
            min_mrr=min_mrr,
            max_mrr=max_mrr,
            min_nps=min_nps,
            max_nps=max_nps,
            start_date=datetime.now() - timedelta(days=days_back) if days_back else None,
            limit=limit,
        )

        # Generate embedding for semantic search
        query_embedding = None
        if query_text:
            query_embedding = self.ai.generate_embedding(query_text)

        return self.db.search(search_query, query_embedding)

    def ask(self, question: str, **filters) -> str:
        """Ask a natural language question about feedback.

        Examples:
            - "What are the main complaints from enterprise users?"
            - "Summarize feature requests from detractors"
            - "Are there any urgent security issues?"

        Args:
            question: Natural language question
            **filters: Same filters as search()

        Returns:
            AI-generated answer based on relevant feedback
        """
        # Search for relevant feedback
        result = self.search(query_text=question, **filters, limit=30)

        if not result.items:
            return "No matching feedback found for your query."

        # Generate answer using AI
        return self.ai.answer_query(question, result.items)

    # ========== Proactive Alert Queries ==========

    def get_churn_risks(
        self,
        min_mrr: float = 100,
        days_back: int = 30,
        limit: int = 20,
    ) -> SearchResult:
        """Get high-value users showing churn signals.

        Finds negative feedback from users with significant MRR.
        """
        return self.search(
            sentiments=["negative"],
            intents=["churn_risk"],
            min_mrr=min_mrr,
            days_back=days_back,
            limit=limit,
        )

    def get_urgent_issues(
        self,
        subscription_types: Optional[list[str]] = None,
        days_back: int = 7,
        limit: int = 20,
    ) -> SearchResult:
        """Get high-urgency issues requiring immediate attention."""
        return self.search(
            urgency_levels=["high"],
            subscription_types=subscription_types,
            days_back=days_back,
            limit=limit,
        )

    def get_upsell_opportunities(
        self,
        subscription_types: Optional[list[str]] = None,
        days_back: int = 30,
        limit: int = 20,
    ) -> SearchResult:
        """Find users expressing interest in features/growth."""
        return self.search(
            intents=["upsell_opportunity"],
            subscription_types=subscription_types or ["free", "starter"],
            days_back=days_back,
            limit=limit,
        )

    def get_detractor_feedback(
        self,
        max_nps: int = 6,
        days_back: int = 30,
        limit: int = 20,
    ) -> SearchResult:
        """Get feedback from NPS detractors (score 0-6)."""
        return self.search(
            sources=["nps"],
            max_nps=max_nps,
            days_back=days_back,
            limit=limit,
        )

    def get_promoter_feedback(
        self,
        min_nps: int = 9,
        days_back: int = 30,
        limit: int = 20,
    ) -> SearchResult:
        """Get feedback from NPS promoters (score 9-10)."""
        return self.search(
            sources=["nps"],
            min_nps=min_nps,
            days_back=days_back,
            limit=limit,
        )

    def get_topic_summary(
        self,
        topic: str,
        days_back: int = 30,
    ) -> str:
        """Get AI-generated summary of feedback for a specific topic."""
        result = self.search(topics=[topic], days_back=days_back, limit=50)

        if not result.items:
            return f"No feedback found for topic: {topic}"

        return self.ai.answer_query(
            f"Summarize the key themes and issues in feedback about {topic}. "
            "Include specific examples and prioritize by frequency and impact.",
            result.items,
        )

    # ========== Reclassification ==========

    def reclassify_all(self, batch_size: int = 100) -> int:
        """Reclassify all feedback with current taxonomy.

        Useful when classification prompts or categories change.
        """
        items = self.db.get_all_for_reclassification(batch_size)
        count = 0

        for item in items:
            classification = self.ai.classify_feedback(
                text=item.text,
                user_profile=item.user_profile,
                nps_score=item.nps_score,
                source=item.source.value,
            )
            self.db.update_classification(item.id, classification)
            count += 1
            print(f"Reclassified {count}/{len(items)}")

        return count

    def find_by_custom_criteria(
        self,
        criteria: str,
        limit: int = 50,
    ) -> list[tuple[FeedbackItem, bool, str]]:
        """Find feedback matching custom criteria.

        Examples:
            - "Is this feedback about API rate limiting?"
            - "Does this mention competitors?"
            - "Is this a data privacy concern?"

        Returns list of (feedback, matches, reason) tuples.
        """
        items = self.db.get_all_for_reclassification(limit)
        results = self.ai.reclassify_with_custom_prompt(items, criteria)

        # Match results with original items
        item_map = {item.id: item for item in items}
        return [
            (item_map[feedback_id], matches, reason)
            for feedback_id, matches, reason in results
        ]

    # ========== Analytics ==========

    def get_statistics(self, days_back: int = 30) -> dict:
        """Get summary statistics for feedback."""
        all_feedback = self.search(days_back=days_back, limit=1000)

        stats = {
            "total_count": all_feedback.total_count,
            "by_sentiment": {"positive": 0, "neutral": 0, "negative": 0},
            "by_source": {},
            "by_topic": {},
            "by_urgency": {"low": 0, "medium": 0, "high": 0},
            "by_intent": {},
            "avg_nps": None,
        }

        nps_scores = []

        for item in all_feedback.items:
            # Source
            source = item.source.value
            stats["by_source"][source] = stats["by_source"].get(source, 0) + 1

            # NPS
            if item.nps_score is not None:
                nps_scores.append(item.nps_score)

            if item.classification:
                # Sentiment
                sentiment = item.classification.sentiment.value
                stats["by_sentiment"][sentiment] += 1

                # Topics
                for topic in item.classification.topics:
                    stats["by_topic"][topic] = stats["by_topic"].get(topic, 0) + 1

                # Urgency
                urgency = item.classification.urgency.value
                stats["by_urgency"][urgency] += 1

                # Intent
                intent = item.classification.intent.value
                stats["by_intent"][intent] = stats["by_intent"].get(intent, 0) + 1

        if nps_scores:
            stats["avg_nps"] = sum(nps_scores) / len(nps_scores)

        return stats
