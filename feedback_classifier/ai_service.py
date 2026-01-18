"""AI services for embedding and classification using Google Gemini API.

Models used (as of January 2025):
- Embeddings: gemini-embedding-001 (GA, 3072 dims, truncatable to 768/1536)
- Classification: gemini-2.5-flash (best price/performance)
"""
import json
from typing import Optional

import google.generativeai as genai

from config import Config
from models import Classification, FeedbackItem, Intent, Sentiment, Urgency, UserProfile


class AIService:
    """Service for embedding generation and feedback classification."""

    _configured = False

    def __init__(self):
        self.embedding_model = Config.EMBEDDING_MODEL
        self.classification_model = Config.CLASSIFICATION_MODEL
        self.embedding_dimensions = Config.EMBEDDING_DIMENSIONS
        # Only configure if we have a valid key
        self._ensure_configured()

    @classmethod
    def _ensure_configured(cls):
        """Configure genai only once and only with a valid key."""
        if Config.GOOGLE_API_KEY and not cls._configured:
            genai.configure(api_key=Config.GOOGLE_API_KEY)
            cls._configured = True

    @classmethod
    def reconfigure(cls, api_key: str):
        """Reconfigure with a new API key."""
        if api_key:
            genai.configure(api_key=api_key)
            cls._configured = True

    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding vector for text.

        Uses gemini-embedding-001 which outputs 3072 dimensions by default,
        but can be truncated to 768 or 1536 without quality loss.
        """
        result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=text,
            output_dimensionality=self.embedding_dimensions,
        )
        return result["embedding"]

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts efficiently."""
        result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=texts,
            output_dimensionality=self.embedding_dimensions,
        )
        return result["embedding"]

    def classify_feedback(
        self,
        text: str,
        user_profile: Optional[UserProfile] = None,
        nps_score: Optional[int] = None,
        source: str = "unknown",
    ) -> Classification:
        """Classify feedback using Gemini.

        Returns structured classification with sentiment, topics, urgency, intent.
        """
        # Build context from user profile
        user_context = ""
        if user_profile:
            user_context = f"""
User Context:
- Subscription: {user_profile.subscription_type or 'unknown'}
- MRR: ${user_profile.mrr or 0:.2f}
- Company: {user_profile.company_name or 'unknown'}
- Industry: {user_profile.industry or 'unknown'}
"""

        nps_context = ""
        if nps_score is not None:
            nps_label = "Promoter" if nps_score >= 9 else "Passive" if nps_score >= 7 else "Detractor"
            nps_context = f"NPS Score: {nps_score}/10 ({nps_label})"

        prompt = f"""Analyze this customer feedback and classify it. Return ONLY valid JSON.

Feedback Source: {source}
{nps_context}
{user_context}

Feedback Text:
\"\"\"{text}\"\"\"

Classify into the following categories:

1. sentiment: One of ["positive", "neutral", "negative"]

2. topics: Array of applicable topics from:
   ["bug", "feature_request", "pricing", "ux", "performance", "onboarding",
    "support", "documentation", "integration", "security", "billing", "mobile", "api"]
   Select 1-3 most relevant topics.

3. urgency: One of ["low", "medium", "high"]
   - high: Critical issues, potential churn, security/data concerns
   - medium: Significant friction, clear frustration
   - low: General feedback, suggestions, minor issues

4. intent: One of:
   - "churn_risk": User expressing frustration that could lead to cancellation
   - "upsell_opportunity": User requesting features in higher tiers or expressing growth needs
   - "support_needed": User needs help with current functionality
   - "feature_advocacy": User loves a feature or wants to see it expanded
   - "general_feedback": General comments without specific action needed

5. summary: One sentence summary of the feedback (max 100 chars)

6. confidence: Your confidence in this classification (0.0 to 1.0)

Return JSON only, no markdown:
{{"sentiment": "...", "topics": [...], "urgency": "...", "intent": "...", "summary": "...", "confidence": 0.0}}
"""

        model = genai.GenerativeModel(self.classification_model)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # Low temperature for consistent classification
                response_mime_type="application/json",
            ),
        )

        # Parse response
        try:
            result = json.loads(response.text)
            return Classification(
                sentiment=Sentiment(result["sentiment"]),
                topics=result["topics"],
                urgency=Urgency(result["urgency"]),
                intent=Intent(result["intent"]),
                summary=result["summary"],
                confidence=float(result.get("confidence", 0.8)),
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            # Fallback classification if parsing fails
            print(f"Classification parsing error: {e}")
            return Classification(
                sentiment=Sentiment.NEUTRAL,
                topics=["general_feedback"],
                urgency=Urgency.LOW,
                intent=Intent.GENERAL_FEEDBACK,
                summary="Classification failed - manual review needed",
                confidence=0.0,
            )

    def answer_query(
        self,
        query: str,
        feedback_items: list[FeedbackItem],
        context: str = "",
    ) -> str:
        """Answer a natural language query about feedback using retrieved items as context.

        This enables PMs to ask questions like:
        - "What are the main complaints from enterprise users?"
        - "Summarize feature requests from this month"
        - "Are there any urgent issues I should know about?"
        """
        # Format feedback for context
        feedback_context = []
        for i, item in enumerate(feedback_items[:20], 1):  # Limit to 20 for context
            user_info = ""
            if item.user_profile:
                user_info = f" [{item.user_profile.subscription_type}, ${item.user_profile.mrr or 0:.0f} MRR]"

            classification_info = ""
            if item.classification:
                classification_info = f" (sentiment: {item.classification.sentiment.value}, topics: {', '.join(item.classification.topics)})"

            nps_info = f" NPS: {item.nps_score}" if item.nps_score is not None else ""

            feedback_context.append(
                f"{i}. [{item.source.value}]{user_info}{nps_info}{classification_info}\n   \"{item.text[:500]}\""
            )

        context_str = "\n\n".join(feedback_context)

        prompt = f"""You are a helpful assistant for Product Managers analyzing customer feedback.

{context}

Here are relevant feedback items:

{context_str}

Based on this feedback, answer the following question:
{query}

Provide a clear, actionable answer. Include specific examples from the feedback when relevant.
If the feedback doesn't contain enough information to fully answer, say so.
"""

        model = genai.GenerativeModel(self.classification_model)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1000,
            ),
        )

        return response.text

    def reclassify_with_custom_prompt(
        self,
        feedback_items: list[FeedbackItem],
        classification_prompt: str,
    ) -> list[tuple[str, bool, str]]:
        """Reclassify feedback based on a custom prompt.

        Useful for creating new categories or checking for specific patterns.

        Example prompts:
        - "Is this feedback about integrations with third-party tools?"
        - "Does this user seem frustrated with pricing?"
        - "Is this a security concern?"

        Returns: List of (feedback_id, matches, reason)
        """
        results = []

        for item in feedback_items:
            prompt = f"""Analyze this customer feedback based on the following question:

Question: {classification_prompt}

Feedback:
\"\"\"{item.text}\"\"\"

Answer with JSON only:
{{"matches": true/false, "reason": "brief explanation"}}
"""

            model = genai.GenerativeModel(self.classification_model)
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )

            try:
                result = json.loads(response.text)
                results.append((item.id, result["matches"], result["reason"]))
            except (json.JSONDecodeError, KeyError):
                results.append((item.id, False, "Classification failed"))

        return results
