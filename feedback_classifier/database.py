"""Database layer with vector search support.

Supports:
- SQLite with numpy for local development
- PostgreSQL with pgvector for production
"""
import json
import sqlite3
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

import numpy as np

from config import Config
from models import (
    Classification,
    FeedbackItem,
    FeedbackSource,
    Intent,
    SearchQuery,
    SearchResult,
    Sentiment,
    Urgency,
    UserProfile,
)


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a = np.array(vec1)
    b = np.array(vec2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class DatabaseBase(ABC):
    """Abstract base class for database operations."""

    @abstractmethod
    def initialize(self) -> None:
        """Initialize the database schema."""
        pass

    @abstractmethod
    def insert_feedback(self, feedback: FeedbackItem) -> str:
        """Insert a feedback item, returns the ID."""
        pass

    @abstractmethod
    def get_feedback(self, feedback_id: str) -> Optional[FeedbackItem]:
        """Get a feedback item by ID."""
        pass

    @abstractmethod
    def search(self, query: SearchQuery, query_embedding: Optional[list[float]] = None) -> SearchResult:
        """Search feedback with filters and optional semantic search."""
        pass

    @abstractmethod
    def update_classification(self, feedback_id: str, classification: Classification) -> None:
        """Update the classification for a feedback item."""
        pass

    @abstractmethod
    def get_all_for_reclassification(self, batch_size: int = 100) -> list[FeedbackItem]:
        """Get all feedback items for batch reclassification."""
        pass


class SQLiteDatabase(DatabaseBase):
    """SQLite implementation for local development."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.SQLITE_PATH
        self.conn = None

    def _get_connection(self) -> sqlite3.Connection:
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
        return self.conn

    def initialize(self) -> None:
        """Create tables if they don't exist."""
        conn = self._get_connection()
        conn.executescript("""
            -- User profiles table
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                email TEXT,
                subscription_type TEXT,
                mrr REAL,
                company_name TEXT,
                industry TEXT,
                signup_date TEXT,
                custom_traits TEXT
            );

            -- Feedback items table
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                user_id TEXT,

                -- Classification
                sentiment TEXT,
                topics TEXT,
                urgency TEXT,
                intent TEXT,
                summary TEXT,
                confidence REAL,

                -- Source-specific
                nps_score INTEGER,
                ticket_id TEXT,
                ticket_priority TEXT,

                -- Embedding stored as JSON array
                embedding TEXT,

                FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);
            CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);
            CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON feedback(urgency);
            CREATE INDEX IF NOT EXISTS idx_feedback_intent ON feedback(intent);
            CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
            CREATE INDEX IF NOT EXISTS idx_feedback_nps ON feedback(nps_score);
        """)
        conn.commit()

    def insert_user_profile(self, profile: UserProfile) -> None:
        """Insert or update a user profile."""
        conn = self._get_connection()
        conn.execute(
            """
            INSERT OR REPLACE INTO user_profiles
            (user_id, email, subscription_type, mrr, company_name, industry, signup_date, custom_traits)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile.user_id,
                profile.email,
                profile.subscription_type,
                profile.mrr,
                profile.company_name,
                profile.industry,
                profile.signup_date.isoformat() if profile.signup_date else None,
                json.dumps(profile.custom_traits),
            ),
        )
        conn.commit()

    def insert_feedback(self, feedback: FeedbackItem) -> str:
        """Insert a feedback item."""
        if not feedback.id:
            feedback.id = str(uuid.uuid4())

        conn = self._get_connection()

        # Insert user profile if present
        if feedback.user_profile:
            self.insert_user_profile(feedback.user_profile)

        # Prepare classification data
        classification = feedback.classification
        sentiment = classification.sentiment.value if classification else None
        topics = json.dumps(classification.topics) if classification else None
        urgency = classification.urgency.value if classification else None
        intent = classification.intent.value if classification else None
        summary = classification.summary if classification else None
        confidence = classification.confidence if classification else None

        # Serialize embedding
        embedding_json = json.dumps(feedback.embedding) if feedback.embedding else None

        conn.execute(
            """
            INSERT INTO feedback
            (id, text, source, created_at, user_id, sentiment, topics, urgency, intent,
             summary, confidence, nps_score, ticket_id, ticket_priority, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                feedback.id,
                feedback.text,
                feedback.source.value,
                feedback.created_at.isoformat(),
                feedback.user_profile.user_id if feedback.user_profile else None,
                sentiment,
                topics,
                urgency,
                intent,
                summary,
                confidence,
                feedback.nps_score,
                feedback.ticket_id,
                feedback.ticket_priority,
                embedding_json,
            ),
        )
        conn.commit()
        return feedback.id

    def _row_to_feedback(self, row: sqlite3.Row, user_row: Optional[sqlite3.Row] = None) -> FeedbackItem:
        """Convert a database row to a FeedbackItem."""
        # Parse user profile
        user_profile = None
        if user_row:
            user_profile = UserProfile(
                user_id=user_row["user_id"],
                email=user_row["email"],
                subscription_type=user_row["subscription_type"],
                mrr=user_row["mrr"],
                company_name=user_row["company_name"],
                industry=user_row["industry"],
                signup_date=datetime.fromisoformat(user_row["signup_date"])
                if user_row["signup_date"]
                else None,
                custom_traits=json.loads(user_row["custom_traits"])
                if user_row["custom_traits"]
                else {},
            )

        # Parse classification
        classification = None
        if row["sentiment"]:
            classification = Classification(
                sentiment=Sentiment(row["sentiment"]),
                topics=json.loads(row["topics"]) if row["topics"] else [],
                urgency=Urgency(row["urgency"]) if row["urgency"] else Urgency.LOW,
                intent=Intent(row["intent"]) if row["intent"] else Intent.GENERAL_FEEDBACK,
                summary=row["summary"] or "",
                confidence=row["confidence"] or 0.0,
            )

        # Parse embedding
        embedding = json.loads(row["embedding"]) if row["embedding"] else None

        return FeedbackItem(
            id=row["id"],
            text=row["text"],
            source=FeedbackSource(row["source"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            user_profile=user_profile,
            classification=classification,
            embedding=embedding,
            nps_score=row["nps_score"],
            ticket_id=row["ticket_id"],
            ticket_priority=row["ticket_priority"],
        )

    def get_feedback(self, feedback_id: str) -> Optional[FeedbackItem]:
        """Get a feedback item by ID."""
        conn = self._get_connection()
        cursor = conn.execute(
            """
            SELECT f.*, u.* FROM feedback f
            LEFT JOIN user_profiles u ON f.user_id = u.user_id
            WHERE f.id = ?
            """,
            (feedback_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        # Get user profile separately for cleaner parsing
        user_row = None
        if row["user_id"]:
            user_cursor = conn.execute(
                "SELECT * FROM user_profiles WHERE user_id = ?", (row["user_id"],)
            )
            user_row = user_cursor.fetchone()

        return self._row_to_feedback(row, user_row)

    def search(self, query: SearchQuery, query_embedding: Optional[list[float]] = None) -> SearchResult:
        """Search feedback with filters and optional semantic search."""
        conn = self._get_connection()

        # Build WHERE clause
        conditions = []
        params = []

        if query.sources:
            placeholders = ",".join("?" * len(query.sources))
            conditions.append(f"f.source IN ({placeholders})")
            params.extend([s.value for s in query.sources])

        if query.sentiments:
            placeholders = ",".join("?" * len(query.sentiments))
            conditions.append(f"f.sentiment IN ({placeholders})")
            params.extend([s.value for s in query.sentiments])

        if query.topics:
            # Check if any topic matches (topics stored as JSON array)
            topic_conditions = []
            for topic in query.topics:
                topic_conditions.append("f.topics LIKE ?")
                params.append(f'%"{topic}"%')
            conditions.append(f"({' OR '.join(topic_conditions)})")

        if query.urgency_levels:
            placeholders = ",".join("?" * len(query.urgency_levels))
            conditions.append(f"f.urgency IN ({placeholders})")
            params.extend([u.value for u in query.urgency_levels])

        if query.intents:
            placeholders = ",".join("?" * len(query.intents))
            conditions.append(f"f.intent IN ({placeholders})")
            params.extend([i.value for i in query.intents])

        if query.subscription_types:
            placeholders = ",".join("?" * len(query.subscription_types))
            conditions.append(f"u.subscription_type IN ({placeholders})")
            params.extend(query.subscription_types)

        if query.min_mrr is not None:
            conditions.append("u.mrr >= ?")
            params.append(query.min_mrr)

        if query.max_mrr is not None:
            conditions.append("u.mrr <= ?")
            params.append(query.max_mrr)

        if query.industries:
            placeholders = ",".join("?" * len(query.industries))
            conditions.append(f"u.industry IN ({placeholders})")
            params.extend(query.industries)

        if query.min_nps is not None:
            conditions.append("f.nps_score >= ?")
            params.append(query.min_nps)

        if query.max_nps is not None:
            conditions.append("f.nps_score <= ?")
            params.append(query.max_nps)

        if query.start_date:
            conditions.append("f.created_at >= ?")
            params.append(query.start_date.isoformat())

        if query.end_date:
            conditions.append("f.created_at <= ?")
            params.append(query.end_date.isoformat())

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Get total count
        count_sql = f"""
            SELECT COUNT(*) FROM feedback f
            LEFT JOIN user_profiles u ON f.user_id = u.user_id
            WHERE {where_clause}
        """
        total_count = conn.execute(count_sql, params).fetchone()[0]

        # Get results
        sql = f"""
            SELECT f.*, u.user_id as u_user_id, u.email as u_email,
                   u.subscription_type as u_subscription_type, u.mrr as u_mrr,
                   u.company_name as u_company_name, u.industry as u_industry,
                   u.signup_date as u_signup_date, u.custom_traits as u_custom_traits
            FROM feedback f
            LEFT JOIN user_profiles u ON f.user_id = u.user_id
            WHERE {where_clause}
            ORDER BY f.created_at DESC
        """

        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()

        # Convert to FeedbackItems
        items = []
        for row in rows:
            # Build user row dict if user data exists
            user_row = None
            if row["u_user_id"]:
                user_row = {
                    "user_id": row["u_user_id"],
                    "email": row["u_email"],
                    "subscription_type": row["u_subscription_type"],
                    "mrr": row["u_mrr"],
                    "company_name": row["u_company_name"],
                    "industry": row["u_industry"],
                    "signup_date": row["u_signup_date"],
                    "custom_traits": row["u_custom_traits"],
                }
                # Create a simple object that supports [] access
                class RowDict(dict):
                    def __getitem__(self, key):
                        return self.get(key)
                user_row = RowDict(user_row)

            items.append(self._row_to_feedback(row, user_row))

        # If semantic search requested, rerank by similarity
        if query_embedding and query.query_text:
            items_with_scores = []
            for item in items:
                if item.embedding:
                    score = cosine_similarity(query_embedding, item.embedding)
                    items_with_scores.append((item, score))
                else:
                    items_with_scores.append((item, 0.0))

            # Sort by similarity score descending
            items_with_scores.sort(key=lambda x: x[1], reverse=True)
            items = [item for item, _ in items_with_scores]

        # Apply pagination
        items = items[query.offset : query.offset + query.limit]

        return SearchResult(items=items, total_count=total_count, query=query)

    def update_classification(self, feedback_id: str, classification: Classification) -> None:
        """Update the classification for a feedback item."""
        conn = self._get_connection()
        conn.execute(
            """
            UPDATE feedback SET
                sentiment = ?,
                topics = ?,
                urgency = ?,
                intent = ?,
                summary = ?,
                confidence = ?
            WHERE id = ?
            """,
            (
                classification.sentiment.value,
                json.dumps(classification.topics),
                classification.urgency.value,
                classification.intent.value,
                classification.summary,
                classification.confidence,
                feedback_id,
            ),
        )
        conn.commit()

    def get_all_for_reclassification(self, batch_size: int = 100) -> list[FeedbackItem]:
        """Get all feedback items for batch reclassification."""
        conn = self._get_connection()
        cursor = conn.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?", (batch_size,)
        )
        rows = cursor.fetchall()
        return [self._row_to_feedback(row) for row in rows]

    def close(self) -> None:
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None


# PostgreSQL implementation for production
class PostgresDatabase(DatabaseBase):
    """PostgreSQL with pgvector implementation for production."""

    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or Config.DATABASE_URL
        self.conn = None

    def _get_connection(self):
        if self.conn is None:
            import psycopg2
            from pgvector.psycopg2 import register_vector

            self.conn = psycopg2.connect(self.connection_string)
            register_vector(self.conn)
        return self.conn

    def initialize(self) -> None:
        """Create tables with pgvector extension."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")

        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                email TEXT,
                subscription_type TEXT,
                mrr REAL,
                company_name TEXT,
                industry TEXT,
                signup_date TIMESTAMP,
                custom_traits JSONB
            );

            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                source TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                user_id TEXT REFERENCES user_profiles(user_id),

                sentiment TEXT,
                topics TEXT[],
                urgency TEXT,
                intent TEXT,
                summary TEXT,
                confidence REAL,

                nps_score INTEGER,
                ticket_id TEXT,
                ticket_priority TEXT,

                embedding vector({Config.EMBEDDING_DIMENSIONS})
            );

            CREATE INDEX IF NOT EXISTS idx_feedback_embedding
            ON feedback USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        """)
        conn.commit()

    def insert_feedback(self, feedback: FeedbackItem) -> str:
        """Insert a feedback item with vector embedding."""
        # Implementation similar to SQLite but using pgvector
        # For brevity, this would follow the same pattern
        raise NotImplementedError("Use SQLite for now, Postgres coming soon")

    def get_feedback(self, feedback_id: str) -> Optional[FeedbackItem]:
        raise NotImplementedError("Use SQLite for now")

    def search(self, query: SearchQuery, query_embedding: Optional[list[float]] = None) -> SearchResult:
        """Search with native vector similarity using pgvector."""
        # The key difference: pgvector does similarity in SQL
        # SELECT * FROM feedback
        # ORDER BY embedding <=> query_embedding  -- cosine distance
        # LIMIT 20
        raise NotImplementedError("Use SQLite for now")

    def update_classification(self, feedback_id: str, classification: Classification) -> None:
        raise NotImplementedError("Use SQLite for now")

    def get_all_for_reclassification(self, batch_size: int = 100) -> list[FeedbackItem]:
        raise NotImplementedError("Use SQLite for now")


def get_database() -> DatabaseBase:
    """Factory function to get the appropriate database implementation."""
    if Config.USE_SQLITE:
        return SQLiteDatabase()
    else:
        return PostgresDatabase()
