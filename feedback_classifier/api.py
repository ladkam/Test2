"""FastAPI REST API for feedback classification system.

Run with: uvicorn api:app --reload
"""
import csv
import io
import threading
from datetime import datetime
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import FeedbackSource, UserProfile
from ingestion import FeedbackIngester
from query_service import FeedbackQueryService
from job_manager import job_manager, JobStatus

app = FastAPI(
    title="Feedback Classification API",
    description="Classify and query customer feedback using AI",
    version="1.0.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ingester = FeedbackIngester()
query_service = FeedbackQueryService()


# ========== Request/Response Models ==========


class UserProfileRequest(BaseModel):
    user_id: str
    email: Optional[str] = None
    subscription_type: Optional[str] = None
    mrr: Optional[float] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None


class IngestRequest(BaseModel):
    text: str
    source: str = "nps"  # nps, zendesk, intercom, email, other
    user_profile: Optional[UserProfileRequest] = None
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
        if request.user_profile:
            user_profile = UserProfile(
                user_id=request.user_profile.user_id,
                email=request.user_profile.email,
                subscription_type=request.user_profile.subscription_type,
                mrr=request.user_profile.mrr,
                company_name=request.user_profile.company_name,
                industry=request.user_profile.industry,
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


# ========== CSV Upload Endpoints ==========


@app.post("/csv/preview")
async def preview_csv(file: UploadFile = File(...)):
    """Preview CSV file and return columns and sample rows.

    Use this to get column names for mapping before import.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        contents = await file.read()
        decoded = contents.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))

        columns = reader.fieldnames or []
        sample_rows = []
        for i, row in enumerate(reader):
            if i >= 5:  # Return first 5 rows as preview
                break
            sample_rows.append(row)

        # Count total rows
        reader = csv.DictReader(io.StringIO(decoded))
        total_rows = sum(1 for _ in reader)

        return {
            "filename": file.filename,
            "columns": columns,
            "sample_rows": sample_rows,
            "total_rows": total_rows,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")


class ColumnMapping(BaseModel):
    """Mapping of CSV columns to feedback fields."""

    text: str  # Required: column containing feedback text
    source: Optional[str] = None  # Column for source, or use default
    default_source: str = "nps"  # Default source if not mapped
    nps_score: Optional[str] = None
    user_id: Optional[str] = None
    email: Optional[str] = None
    subscription_type: Optional[str] = None
    mrr: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    ticket_id: Optional[str] = None
    ticket_priority: Optional[str] = None
    created_at: Optional[str] = None


class CSVImportRequest(BaseModel):
    """Request for CSV import with column mapping."""

    csv_data: str  # Base64 or raw CSV content
    mapping: ColumnMapping
    skip_classification: bool = False


@app.post("/csv/import")
async def import_csv(
    file: UploadFile = File(...),
    mapping_json: str = Form(...),
    skip_classification: bool = Form(False),
):
    """Import feedback from CSV with column mapping.

    Expected form data:
    - file: The CSV file
    - mapping_json: JSON string of ColumnMapping
    - skip_classification: Optional, skip AI classification for speed
    """
    import json

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        mapping_dict = json.loads(mapping_json)
        mapping = ColumnMapping(**mapping_dict)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid mapping: {str(e)}")

    try:
        contents = await file.read()
        decoded = contents.decode("utf-8")
        reader = csv.DictReader(io.StringIO(decoded))

        imported = []
        errors = []

        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Get text (required)
                text = row.get(mapping.text, "").strip()
                if not text:
                    errors.append({"row": row_num, "error": "Empty text field"})
                    continue

                # Get source
                source_str = mapping.default_source
                if mapping.source and row.get(mapping.source):
                    source_str = row.get(mapping.source).strip().lower()

                # Validate source
                try:
                    source = FeedbackSource(source_str)
                except ValueError:
                    source = FeedbackSource.OTHER

                # Get NPS score
                nps_score = None
                if mapping.nps_score and row.get(mapping.nps_score):
                    try:
                        nps_score = int(row.get(mapping.nps_score))
                    except ValueError:
                        pass

                # Build user profile
                user_profile = None
                if mapping.user_id and row.get(mapping.user_id):
                    user_profile = UserProfile(
                        user_id=row.get(mapping.user_id, "").strip(),
                        email=row.get(mapping.email, "").strip() if mapping.email else None,
                        subscription_type=row.get(mapping.subscription_type, "").strip()
                        if mapping.subscription_type
                        else None,
                        mrr=float(row.get(mapping.mrr))
                        if mapping.mrr and row.get(mapping.mrr)
                        else None,
                        company_name=row.get(mapping.company_name, "").strip()
                        if mapping.company_name
                        else None,
                        industry=row.get(mapping.industry, "").strip()
                        if mapping.industry
                        else None,
                    )

                # Get ticket info
                ticket_id = (
                    row.get(mapping.ticket_id, "").strip()
                    if mapping.ticket_id
                    else None
                )
                ticket_priority = (
                    row.get(mapping.ticket_priority, "").strip()
                    if mapping.ticket_priority
                    else None
                )

                # Ingest
                feedback = ingester.ingest_single(
                    text=text,
                    source=source,
                    user_profile=user_profile,
                    nps_score=nps_score,
                    ticket_id=ticket_id,
                    ticket_priority=ticket_priority,
                    skip_classification=skip_classification,
                )

                imported.append(
                    {
                        "row": row_num,
                        "id": feedback.id,
                        "classification": feedback.classification.to_dict()
                        if feedback.classification
                        else None,
                    }
                )

            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})

        return {
            "success": True,
            "imported_count": len(imported),
            "error_count": len(errors),
            "imported": imported[:10],  # Return first 10 for preview
            "errors": errors[:10],  # Return first 10 errors
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# ========== Background Import with Progress ==========


def process_csv_import_background(
    job_id: str,
    csv_content: str,
    mapping: ColumnMapping,
    skip_classification: bool,
):
    """Background task to process CSV import with progress tracking."""
    job_manager.start_job(job_id)

    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        total_rows = len(rows)

        job_manager.update_progress(job_id, current=0, total=total_rows, message="Starting import...")

        imported = []
        errors = []

        for i, row in enumerate(rows):
            row_num = i + 2  # Account for header row

            # Check if job was cancelled
            job = job_manager.get_job(job_id)
            if job and job.status == JobStatus.CANCELLED:
                job_manager.update_progress(job_id, message="Import cancelled")
                return

            try:
                # Get text (required)
                text = row.get(mapping.text, "").strip()
                if not text:
                    errors.append({"row": row_num, "error": "Empty text field"})
                    job_manager.update_progress(
                        job_id,
                        current=i + 1,
                        errors=len(errors),
                        message=f"Row {row_num}: Empty text, skipped"
                    )
                    continue

                # Get source
                source_str = mapping.default_source
                if mapping.source and row.get(mapping.source):
                    source_str = row.get(mapping.source).strip().lower()

                try:
                    source = FeedbackSource(source_str)
                except ValueError:
                    source = FeedbackSource.OTHER

                # Get NPS score
                nps_score = None
                if mapping.nps_score and row.get(mapping.nps_score):
                    try:
                        nps_score = int(row.get(mapping.nps_score))
                    except ValueError:
                        pass

                # Build user profile
                user_profile = None
                if mapping.user_id and row.get(mapping.user_id):
                    user_profile = UserProfile(
                        user_id=row.get(mapping.user_id, "").strip(),
                        email=row.get(mapping.email, "").strip() if mapping.email else None,
                        subscription_type=row.get(mapping.subscription_type, "").strip()
                        if mapping.subscription_type else None,
                        mrr=float(row.get(mapping.mrr))
                        if mapping.mrr and row.get(mapping.mrr) else None,
                        company_name=row.get(mapping.company_name, "").strip()
                        if mapping.company_name else None,
                        industry=row.get(mapping.industry, "").strip()
                        if mapping.industry else None,
                    )

                # Get ticket info
                ticket_id = row.get(mapping.ticket_id, "").strip() if mapping.ticket_id else None
                ticket_priority = row.get(mapping.ticket_priority, "").strip() if mapping.ticket_priority else None

                # Ingest
                feedback = ingester.ingest_single(
                    text=text,
                    source=source,
                    user_profile=user_profile,
                    nps_score=nps_score,
                    ticket_id=ticket_id,
                    ticket_priority=ticket_priority,
                    skip_classification=skip_classification,
                )

                imported.append({
                    "row": row_num,
                    "id": feedback.id,
                    "classification": feedback.classification.to_dict() if feedback.classification else None,
                })

                job_manager.update_progress(
                    job_id,
                    current=i + 1,
                    successful=len(imported),
                    errors=len(errors),
                    message=f"Processing row {i + 1}/{total_rows}"
                )

            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})
                job_manager.update_progress(
                    job_id,
                    current=i + 1,
                    errors=len(errors),
                    message=f"Row {row_num}: Error - {str(e)[:50]}"
                )

        # Complete the job
        result = {
            "imported_count": len(imported),
            "error_count": len(errors),
            "imported": imported[:20],
            "errors": errors[:20],
        }
        job_manager.complete_job(job_id, result)

    except Exception as e:
        job_manager.fail_job(job_id, str(e))


@app.post("/csv/import-async")
async def import_csv_async(
    file: UploadFile = File(...),
    mapping_json: str = Form(...),
    skip_classification: bool = Form(False),
):
    """Start a background CSV import with progress tracking.

    Returns a job ID that can be used to check progress.
    """
    import json

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        mapping_dict = json.loads(mapping_json)
        mapping = ColumnMapping(**mapping_dict)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid mapping: {str(e)}")

    try:
        contents = await file.read()
        csv_content = contents.decode("utf-8")

        # Count rows for progress tracking
        reader = csv.DictReader(io.StringIO(csv_content))
        total_rows = sum(1 for _ in reader)

        # Create job
        job = job_manager.create_job("csv_import")
        job_manager.update_progress(job.id, total=total_rows, message="Queued for processing")

        # Start background thread
        thread = threading.Thread(
            target=process_csv_import_background,
            args=(job.id, csv_content, mapping, skip_classification),
            daemon=True,
        )
        thread.start()

        return {
            "job_id": job.id,
            "status": "started",
            "total_rows": total_rows,
            "message": "Import started in background. Poll /csv/import/{job_id}/status for progress.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start import: {str(e)}")


@app.get("/csv/import/{job_id}/status")
def get_import_status(job_id: str):
    """Get the status of a background CSV import."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job.to_dict()


@app.post("/csv/import/{job_id}/cancel")
def cancel_import(job_id: str):
    """Cancel a running CSV import."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job_manager.cancel_job(job_id):
        return {"success": True, "message": "Import cancelled"}
    else:
        return {"success": False, "message": f"Cannot cancel job in {job.status.value} status"}


@app.get("/jobs")
def list_jobs(job_type: Optional[str] = None, limit: int = 10):
    """List recent jobs."""
    jobs = job_manager.list_jobs(job_type)[:limit]
    return {"jobs": [j.to_dict() for j in jobs]}


# ========== Settings Endpoints ==========


class SettingsUpdate(BaseModel):
    """Settings update request."""

    google_api_key: Optional[str] = None
    embedding_model: Optional[str] = None
    classification_model: Optional[str] = None
    embedding_dimensions: Optional[int] = None


# Available models
AVAILABLE_MODELS = {
    "embedding": [
        {"id": "gemini-embedding-001", "name": "Gemini Embedding 001 (Recommended)", "dimensions": [768, 1536, 3072]},
        {"id": "text-embedding-004", "name": "Text Embedding 004 (Legacy)", "dimensions": [768]},
    ],
    "classification": [
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash (Recommended)"},
        {"id": "gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite (Fastest)"},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro (Best Quality)"},
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
    ],
}


@app.get("/settings")
def get_settings():
    """Get current settings (API key is masked)."""
    from config import Config

    api_key = Config.GOOGLE_API_KEY or ""
    masked_key = ""
    if api_key:
        # Show first 4 and last 4 characters
        if len(api_key) > 8:
            masked_key = api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
        else:
            masked_key = "*" * len(api_key)

    return {
        "google_api_key": masked_key,
        "google_api_key_set": bool(Config.GOOGLE_API_KEY),
        "embedding_model": Config.EMBEDDING_MODEL,
        "classification_model": Config.CLASSIFICATION_MODEL,
        "embedding_dimensions": Config.EMBEDDING_DIMENSIONS,
        "available_models": AVAILABLE_MODELS,
    }


@app.post("/settings")
def update_settings(settings: SettingsUpdate):
    """Update settings.

    Note: This updates the runtime config. For persistence,
    update the .env file or environment variables.
    """
    from config import Config
    import os

    updated = []

    if settings.google_api_key is not None:
        Config.GOOGLE_API_KEY = settings.google_api_key
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key
        # Reconfigure the AI service
        import google.generativeai as genai
        genai.configure(api_key=settings.google_api_key)
        updated.append("google_api_key")

    if settings.embedding_model is not None:
        Config.EMBEDDING_MODEL = settings.embedding_model
        os.environ["EMBEDDING_MODEL"] = settings.embedding_model
        updated.append("embedding_model")

    if settings.classification_model is not None:
        Config.CLASSIFICATION_MODEL = settings.classification_model
        os.environ["CLASSIFICATION_MODEL"] = settings.classification_model
        updated.append("classification_model")

    if settings.embedding_dimensions is not None:
        Config.EMBEDDING_DIMENSIONS = settings.embedding_dimensions
        os.environ["EMBEDDING_DIMENSIONS"] = str(settings.embedding_dimensions)
        updated.append("embedding_dimensions")

    # Reinitialize services with new config
    global ingester, query_service
    ingester = FeedbackIngester()
    query_service = FeedbackQueryService()

    return {
        "success": True,
        "updated": updated,
        "message": f"Updated {len(updated)} setting(s). Note: For persistence, update .env file.",
    }


@app.post("/settings/test-api-key")
def test_api_key(api_key: str = Form(...)):
    """Test if an API key is valid."""
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        # Try a simple operation to validate
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content("Say 'API key is valid' in 5 words or less.")

        return {
            "valid": True,
            "message": "API key is valid",
            "test_response": response.text[:100] if response.text else None,
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Invalid API key: {str(e)}",
        }


# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
