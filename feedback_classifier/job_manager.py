"""Background job manager for long-running tasks like CSV imports."""
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobProgress:
    """Progress information for a job."""
    current: int = 0
    total: int = 0
    successful: int = 0
    errors: int = 0
    message: str = ""

    @property
    def percentage(self) -> float:
        if self.total == 0:
            return 0
        return (self.current / self.total) * 100


@dataclass
class Job:
    """A background job."""
    id: str
    type: str
    status: JobStatus = JobStatus.PENDING
    progress: JobProgress = field(default_factory=JobProgress)
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status.value,
            "progress": {
                "current": self.progress.current,
                "total": self.progress.total,
                "successful": self.progress.successful,
                "errors": self.progress.errors,
                "percentage": round(self.progress.percentage, 1),
                "message": self.progress.message,
            },
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class JobManager:
    """Manages background jobs with progress tracking."""

    def __init__(self, max_jobs: int = 100):
        self.jobs: dict[str, Job] = {}
        self.max_jobs = max_jobs
        self._lock = threading.Lock()

    def create_job(self, job_type: str) -> Job:
        """Create a new job and return it."""
        job_id = str(uuid.uuid4())[:8]
        job = Job(id=job_id, type=job_type)

        with self._lock:
            # Clean up old completed jobs if we have too many
            if len(self.jobs) >= self.max_jobs:
                self._cleanup_old_jobs()

            self.jobs[job_id] = job

        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get a job by ID."""
        return self.jobs.get(job_id)

    def update_progress(
        self,
        job_id: str,
        current: Optional[int] = None,
        total: Optional[int] = None,
        successful: Optional[int] = None,
        errors: Optional[int] = None,
        message: Optional[str] = None,
    ) -> None:
        """Update job progress."""
        job = self.jobs.get(job_id)
        if not job:
            return

        with self._lock:
            if current is not None:
                job.progress.current = current
            if total is not None:
                job.progress.total = total
            if successful is not None:
                job.progress.successful = successful
            if errors is not None:
                job.progress.errors = errors
            if message is not None:
                job.progress.message = message

    def start_job(self, job_id: str) -> None:
        """Mark a job as started."""
        job = self.jobs.get(job_id)
        if job:
            with self._lock:
                job.status = JobStatus.RUNNING
                job.started_at = datetime.now()

    def complete_job(self, job_id: str, result: Any = None) -> None:
        """Mark a job as completed."""
        job = self.jobs.get(job_id)
        if job:
            with self._lock:
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.now()
                job.result = result

    def fail_job(self, job_id: str, error: str) -> None:
        """Mark a job as failed."""
        job = self.jobs.get(job_id)
        if job:
            with self._lock:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.now()
                job.error = error

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job. Returns True if cancelled."""
        job = self.jobs.get(job_id)
        if job and job.status in (JobStatus.PENDING, JobStatus.RUNNING):
            with self._lock:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.now()
            return True
        return False

    def list_jobs(self, job_type: Optional[str] = None) -> list[Job]:
        """List all jobs, optionally filtered by type."""
        jobs = list(self.jobs.values())
        if job_type:
            jobs = [j for j in jobs if j.type == job_type]
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)

    def _cleanup_old_jobs(self) -> None:
        """Remove old completed jobs."""
        completed = [
            j for j in self.jobs.values()
            if j.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
        ]
        # Sort by completion time and remove oldest
        completed.sort(key=lambda j: j.completed_at or j.created_at)
        to_remove = completed[:len(completed) // 2]  # Remove half
        for job in to_remove:
            del self.jobs[job.id]


# Global job manager instance
job_manager = JobManager()
