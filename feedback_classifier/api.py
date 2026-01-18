"""FastAPI REST API for feedback classification system.

Run with: uvicorn api:app --reload
"""
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from models import FeedbackSource
from ingestion import FeedbackIngester
from query_service import FeedbackQueryService

app = FastAPI(
    title="Feedback Classification API",
    description="Classify and query customer feedback using AI",
    version="1.0.0",
)

# Initialize services
ingester = FeedbackIngester()
query_service = FeedbackQueryService()


# ========== Request/Response Models ==========


class IngestRequest(BaseModel):
    text: str
    source: str = "nps"  # nps, zendesk, intercom, email, other
    user_id: Optional[str] = None
    email: Optional[str] = None
    subscription_type: Optional[str] = None
    mrr: Optional[float] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    nps_score: Optional[int] = None
    ticket_id: Optional[str] = None
    ticket_priority: Optional[str] = None


class IngestResponse(BaseModel):
    id: str
    classification: dict
    message: str


class AskRequest(BaseModel):
    question: str
    sources: Optional[list[str]] = None
    sentiments: Optional[list[str]] = None
    topics: Optional[list[str]] = None
    subscription_types: Optional[list[str]] = None
    min_mrr: Optional[float] = None
    max_mrr: Optional[float] = None
    days_back: Optional[int] = 30


class AskResponse(BaseModel):
    answer: str
    feedback_count: int


class SearchResponse(BaseModel):
    items: list[dict]
    total_count: int


class CustomSearchRequest(BaseModel):
    criteria: str
    limit: int = 50


class ReclassifyResponse(BaseModel):
    count: int
    message: str


# ========== Endpoints ==========


@app.get("/")
def root():
    return {
        "name": "Feedback Classification API",
        "version": "1.0.0",
        "endpoints": {
            "/ingest": "POST - Ingest and classify new feedback",
            "/ask": "POST - Ask natural language questions about feedback",
            "/search": "GET - Search feedback with filters",
            "/alerts/churn-risks": "GET - Get churn risk alerts",
            "/alerts/urgent": "GET - Get urgent issues",
            "/stats": "GET - Get feedback statistics",
        },
    }


@app.post("/ingest", response_model=IngestResponse)
def ingest_feedback(request: IngestRequest):
    """Ingest a new feedback item.

    The feedback will be:
    1. Embedded for semantic search
    2. Classified (sentiment, topics, urgency, intent)
    3. Stored in the database
    """
    try:
        from models import UserProfile

        user_profile = None
        if request.user_id:
            user_profile = UserProfile(
                user_id=request.user_id,
                email=request.email,
                subscription_type=request.subscription_type,
                mrr=request.mrr,
                company_name=request.company_name,
                industry=request.industry,
            )

        feedback = ingester.ingest_single(
            text=request.text,
            source=FeedbackSource(request.source),
            user_profile=user_profile,
            nps_score=request.nps_score,
            ticket_id=request.ticket_id,
            ticket_priority=request.ticket_priority,
        )

        return IngestResponse(
            id=feedback.id,
            classification=feedback.classification.to_dict() if feedback.classification else {},
            message="Feedback ingested and classified successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest):
    """Ask a natural language question about feedback.

    Examples:
    - "What are the main complaints from enterprise users?"
    - "Summarize feature requests from this month"
    - "Are there any urgent security issues?"
    """
    try:
        answer = query_service.ask(
            question=request.question,
            sources=request.sources,
            sentiments=request.sentiments,
            topics=request.topics,
            subscription_types=request.subscription_types,
            min_mrr=request.min_mrr,
            max_mrr=request.max_mrr,
            days_back=request.days_back,
        )

        # Get count for context
        result = query_service.search(
            query_text=request.question,
            sources=request.sources,
            sentiments=request.sentiments,
            topics=request.topics,
            subscription_types=request.subscription_types,
            min_mrr=request.min_mrr,
            max_mrr=request.max_mrr,
            days_back=request.days_back,
        )

        return AskResponse(answer=answer, feedback_count=result.total_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search", response_model=SearchResponse)
def search_feedback(
    query: Optional[str] = None,
    sources: Optional[str] = Query(None, description="Comma-separated: nps,zendesk"),
    sentiments: Optional[str] = Query(None, description="Comma-separated: positive,neutral,negative"),
    topics: Optional[str] = Query(None, description="Comma-separated topic list"),
    urgency: Optional[str] = Query(None, description="Comma-separated: low,medium,high"),
    intents: Optional[str] = Query(None, description="Comma-separated intent list"),
    subscription_types: Optional[str] = Query(None, description="Comma-separated subscription types"),
    min_mrr: Optional[float] = None,
    max_mrr: Optional[float] = None,
    min_nps: Optional[int] = None,
    max_nps: Optional[int] = None,
    days_back: Optional[int] = 30,
    limit: int = 20,
):
    """Search feedback with filters and optional semantic search."""
    try:
        result = query_service.search(
            query_text=query,
            sources=sources.split(",") if sources else None,
            sentiments=sentiments.split(",") if sentiments else None,
            topics=topics.split(",") if topics else None,
            urgency_levels=urgency.split(",") if urgency else None,
            intents=intents.split(",") if intents else None,
            subscription_types=subscription_types.split(",") if subscription_types else None,
            min_mrr=min_mrr,
            max_mrr=max_mrr,
            min_nps=min_nps,
            max_nps=max_nps,
            days_back=days_back,
            limit=limit,
        )

        return SearchResponse(
            items=[item.to_dict() for item in result.items],
            total_count=result.total_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts/churn-risks", response_model=SearchResponse)
def get_churn_risks(
    min_mrr: float = 100,
    days_back: int = 30,
    limit: int = 20,
):
    """Get feedback indicating potential churn from high-value users."""
    result = query_service.get_churn_risks(
        min_mrr=min_mrr,
        days_back=days_back,
        limit=limit,
    )
    return SearchResponse(
        items=[item.to_dict() for item in result.items],
        total_count=result.total_count,
    )


@app.get("/alerts/urgent", response_model=SearchResponse)
def get_urgent_issues(
    subscription_types: Optional[str] = None,
    days_back: int = 7,
    limit: int = 20,
):
    """Get high-urgency issues requiring immediate attention."""
    result = query_service.get_urgent_issues(
        subscription_types=subscription_types.split(",") if subscription_types else None,
        days_back=days_back,
        limit=limit,
    )
    return SearchResponse(
        items=[item.to_dict() for item in result.items],
        total_count=result.total_count,
    )


@app.get("/alerts/upsell", response_model=SearchResponse)
def get_upsell_opportunities(
    subscription_types: Optional[str] = "free,starter",
    days_back: int = 30,
    limit: int = 20,
):
    """Find users expressing interest in features/growth."""
    result = query_service.get_upsell_opportunities(
        subscription_types=subscription_types.split(",") if subscription_types else None,
        days_back=days_back,
        limit=limit,
    )
    return SearchResponse(
        items=[item.to_dict() for item in result.items],
        total_count=result.total_count,
    )


@app.get("/topic/{topic}/summary")
def get_topic_summary(topic: str, days_back: int = 30):
    """Get AI-generated summary for a specific topic."""
    summary = query_service.get_topic_summary(topic, days_back)
    return {"topic": topic, "summary": summary}


@app.post("/custom-search")
def custom_search(request: CustomSearchRequest):
    """Find feedback matching custom criteria.

    Examples:
    - "Is this feedback about API rate limiting?"
    - "Does this mention competitors?"
    - "Is this a data privacy concern?"
    """
    results = query_service.find_by_custom_criteria(
        criteria=request.criteria,
        limit=request.limit,
    )

    return {
        "criteria": request.criteria,
        "matches": [
            {
                "feedback": item.to_dict(),
                "matches": matches,
                "reason": reason,
            }
            for item, matches, reason in results
            if matches  # Only return matches
        ],
    }


@app.post("/reclassify", response_model=ReclassifyResponse)
def reclassify_all(batch_size: int = 100):
    """Reclassify all feedback with current taxonomy."""
    count = query_service.reclassify_all(batch_size)
    return ReclassifyResponse(
        count=count,
        message=f"Reclassified {count} feedback items",
    )


@app.get("/stats")
def get_statistics(days_back: int = 30):
    """Get summary statistics for feedback."""
    return query_service.get_statistics(days_back)


# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
