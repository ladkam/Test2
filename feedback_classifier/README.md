# Feedback Classification Tool

AI-powered tool for classifying and querying customer feedback from NPS surveys and Zendesk tickets.

## Features

- **Automatic Classification**: Sentiment, topics, urgency, and intent detection
- **Semantic Search**: Find feedback by meaning, not just keywords
- **User Context**: Incorporate MRR, subscription type, and other user traits
- **Proactive Alerts**: Surface churn risks, urgent issues, upsell opportunities
- **Custom Queries**: Ask natural language questions about your feedback
- **Reclassification**: Update classifications when your taxonomy changes

## Quick Start

### 1. Install Dependencies

```bash
cd feedback_classifier
pip install -r requirements.txt
```

### 2. Configure API Key

```bash
cp .env.example .env
# Edit .env and add your Google AI API key
# Get one at: https://aistudio.google.com/apikey
```

### 3. Load Sample Data

```bash
python sample_data.py
```

### 4. Start Using

**CLI:**
```bash
# Search feedback
python cli.py search --query "pricing complaints"

# Ask a question
python cli.py ask "What are the main issues from enterprise users?"

# Get alerts
python cli.py alerts churn --min-mrr 1000

# View statistics
python cli.py stats
```

**API:**
```bash
uvicorn api:app --reload
# Visit http://localhost:8000/docs for interactive API docs
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                             │
│  NPS Surveys  │  Zendesk Tickets  │  User Profiles          │
└───────┬───────────────┬─────────────────────┬───────────────┘
        │               │                     │
        ▼               ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   INGESTION PIPELINE                         │
│  1. Parse source data                                        │
│  2. Generate embeddings (gemini-embedding-001)               │
│  3. Classify with LLM (gemini-2.5-flash)                    │
│  4. Store with user context                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                                │
│  SQLite + numpy (dev)  or  PostgreSQL + pgvector (prod)     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │  feedback   │  │ user_profiles│  │   embeddings    │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUERY SERVICE                             │
│  • Semantic search (embedding similarity)                    │
│  • Metadata filters (sentiment, topics, MRR, etc.)          │
│  • Natural language Q&A                                      │
│  • Proactive alerts                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    CLI      │     │  REST API   │     │  Webhooks   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Google AI Models Used

| Purpose | Model | Notes |
|---------|-------|-------|
| Embeddings | `gemini-embedding-001` | 768-3072 dimensions, 100+ languages |
| Classification | `gemini-2.5-flash` | Best price/performance for structured output |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest` | POST | Ingest and classify new feedback |
| `/search` | GET | Search with filters and semantic search |
| `/ask` | POST | Ask natural language questions |
| `/alerts/churn-risks` | GET | High-value users showing churn signals |
| `/alerts/urgent` | GET | High-urgency issues |
| `/alerts/upsell` | GET | Upsell opportunities |
| `/topic/{topic}/summary` | GET | AI summary for a topic |
| `/custom-search` | POST | Find feedback matching custom criteria |
| `/stats` | GET | Feedback statistics |

## CLI Commands

```bash
# Ingest single feedback
python cli.py ingest "Your feedback text" --source nps --nps-score 8

# Ingest from file
python cli.py ingest --file nps_export.csv

# Search with filters
python cli.py search --query "slow performance" --sentiments negative --min-mrr 500

# Ask questions
python cli.py ask "What features are enterprise users requesting?"

# Get alerts
python cli.py alerts churn --min-mrr 1000
python cli.py alerts urgent
python cli.py alerts upsell

# Statistics
python cli.py stats --days 30

# Topic summary
python cli.py topic pricing
```

## Classification Taxonomy

### Sentiment
- `positive`, `neutral`, `negative`

### Topics
- `bug`, `feature_request`, `pricing`, `ux`, `performance`
- `onboarding`, `support`, `documentation`, `integration`
- `security`, `billing`, `mobile`, `api`

### Urgency
- `low`: General feedback, minor issues
- `medium`: Significant friction, clear frustration
- `high`: Critical issues, potential churn, security concerns

### Intent
- `churn_risk`: Frustration that could lead to cancellation
- `upsell_opportunity`: Interest in features/growth
- `support_needed`: Needs help with current functionality
- `feature_advocacy`: Loves a feature, wants expansion
- `general_feedback`: General comments

## Data Import Formats

### NPS CSV
```csv
response,score,user_id,email,date
"Great product!",9,user_123,user@example.com,2025-01-15
```

### Zendesk JSON
```json
[
  {
    "id": "12345",
    "description": "Cannot login to my account...",
    "priority": "high",
    "requester": {"id": "user_123", "email": "user@example.com"},
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

### User Profiles CSV
```csv
user_id,email,subscription_type,mrr,company_name,industry
user_123,user@example.com,enterprise,5000,Acme Corp,tech
```

## Production Deployment

For production, use PostgreSQL with pgvector:

```bash
# Install pgvector extension
CREATE EXTENSION vector;

# Update .env
USE_SQLITE=false
DATABASE_URL=postgresql://user:pass@host:5432/feedback_db
```

## Cost Estimates (Google AI)

| Operation | Cost per 1000 items |
|-----------|---------------------|
| Embedding | ~$0.01 |
| Classification | ~$0.10 |
| Query answering | ~$0.05 per query |

## License

MIT
