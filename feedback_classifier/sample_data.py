#!/usr/bin/env python3
"""Sample data for testing the feedback classification system.

Run: python sample_data.py
"""
from datetime import datetime, timedelta
import random

from models import FeedbackSource, UserProfile
from ingestion import FeedbackIngester


# Sample NPS responses
NPS_SAMPLES = [
    # Promoters (9-10)
    {
        "text": "Absolutely love this product! The API is super easy to use and the documentation is excellent. Already recommended it to three other teams.",
        "score": 10,
        "subscription": "enterprise",
        "mrr": 2500,
    },
    {
        "text": "Great experience so far. The onboarding was smooth and support has been very responsive.",
        "score": 9,
        "subscription": "pro",
        "mrr": 299,
    },
    {
        "text": "Best tool we've used for this. The mobile app works flawlessly and syncs instantly.",
        "score": 10,
        "subscription": "enterprise",
        "mrr": 5000,
    },

    # Passives (7-8)
    {
        "text": "It's good but could use more integrations. Would love to see Salesforce and HubSpot support.",
        "score": 8,
        "subscription": "pro",
        "mrr": 199,
    },
    {
        "text": "Works well for basic use cases but missing some advanced features we need.",
        "score": 7,
        "subscription": "starter",
        "mrr": 49,
    },
    {
        "text": "The product is solid but the pricing tiers are confusing. Not sure what I'm paying for.",
        "score": 7,
        "subscription": "pro",
        "mrr": 299,
    },

    # Detractors (0-6)
    {
        "text": "Very frustrated with the constant bugs. The app crashed three times this week and I lost work.",
        "score": 3,
        "subscription": "enterprise",
        "mrr": 1500,
    },
    {
        "text": "Support takes forever to respond. Been waiting 5 days for a critical issue to be resolved.",
        "score": 2,
        "subscription": "pro",
        "mrr": 199,
    },
    {
        "text": "Too expensive for what you get. Considering switching to a competitor.",
        "score": 4,
        "subscription": "enterprise",
        "mrr": 3000,
    },
    {
        "text": "The new update completely broke our workflow. Please bring back the old interface.",
        "score": 1,
        "subscription": "pro",
        "mrr": 499,
    },
    {
        "text": "Performance has degraded significantly. Pages take 10+ seconds to load now.",
        "score": 5,
        "subscription": "enterprise",
        "mrr": 2000,
    },
    {
        "text": "Billing issues every month. I keep getting charged incorrectly and it takes weeks to resolve.",
        "score": 2,
        "subscription": "pro",
        "mrr": 299,
    },
]


# Sample Zendesk tickets
ZENDESK_SAMPLES = [
    {
        "text": "Cannot login to my account. Getting 'Invalid credentials' error even though password is correct. Tried resetting but still not working. This is urgent as we have a demo tomorrow.",
        "priority": "high",
        "subscription": "enterprise",
        "mrr": 4000,
    },
    {
        "text": "How do I export data to CSV? Can't find the option anywhere in the dashboard.",
        "priority": "low",
        "subscription": "starter",
        "mrr": 29,
    },
    {
        "text": "API rate limiting is causing issues for our integration. We need higher limits for our use case. Currently hitting the 100 req/min limit constantly.",
        "priority": "medium",
        "subscription": "pro",
        "mrr": 499,
    },
    {
        "text": "Security concern: noticed that user data is being sent over HTTP instead of HTTPS on the mobile app. Please investigate immediately.",
        "priority": "urgent",
        "subscription": "enterprise",
        "mrr": 5000,
    },
    {
        "text": "Feature request: Would love to see a dark mode option. Working late nights and the bright interface is hard on the eyes.",
        "priority": "low",
        "subscription": "pro",
        "mrr": 199,
    },
    {
        "text": "Webhook notifications stopped working after the latest update. Our automation pipeline is completely broken.",
        "priority": "high",
        "subscription": "enterprise",
        "mrr": 3500,
    },
    {
        "text": "Need help setting up SSO with Okta. Documentation is outdated and the steps don't match current interface.",
        "priority": "medium",
        "subscription": "enterprise",
        "mrr": 2500,
    },
    {
        "text": "Mobile app doesn't work offline. When I lose connection, I lose all unsaved work. This is a dealbreaker for our field team.",
        "priority": "high",
        "subscription": "enterprise",
        "mrr": 6000,
    },
]


def load_sample_data(skip_classification: bool = False):
    """Load sample data into the database.

    Args:
        skip_classification: If True, skip AI classification (faster, for testing schema)
    """
    ingester = FeedbackIngester()

    print("Loading sample NPS responses...")
    for i, sample in enumerate(NPS_SAMPLES):
        user_profile = UserProfile(
            user_id=f"user_nps_{i}",
            email=f"user{i}@example.com",
            subscription_type=sample["subscription"],
            mrr=sample["mrr"],
            company_name=f"Company {i}",
            industry=random.choice(["tech", "finance", "healthcare", "retail", "education"]),
        )

        # Randomize dates within last 30 days
        created_at = datetime.now() - timedelta(days=random.randint(0, 30))

        feedback = ingester.ingest_single(
            text=sample["text"],
            source=FeedbackSource.NPS,
            user_profile=user_profile,
            nps_score=sample["score"],
            created_at=created_at,
            skip_classification=skip_classification,
        )

        print(f"  [{feedback.id[:8]}] NPS {sample['score']}: {sample['text'][:50]}...")

    print("\nLoading sample Zendesk tickets...")
    for i, sample in enumerate(ZENDESK_SAMPLES):
        user_profile = UserProfile(
            user_id=f"user_zendesk_{i}",
            email=f"support{i}@example.com",
            subscription_type=sample["subscription"],
            mrr=sample["mrr"],
            company_name=f"Customer {i}",
            industry=random.choice(["tech", "finance", "healthcare", "retail", "education"]),
        )

        created_at = datetime.now() - timedelta(days=random.randint(0, 14))

        feedback = ingester.ingest_single(
            text=sample["text"],
            source=FeedbackSource.ZENDESK,
            user_profile=user_profile,
            ticket_id=f"TICKET-{1000 + i}",
            ticket_priority=sample["priority"],
            created_at=created_at,
            skip_classification=skip_classification,
        )

        print(f"  [{feedback.id[:8]}] {sample['priority']}: {sample['text'][:50]}...")

    print(f"\nLoaded {len(NPS_SAMPLES)} NPS responses and {len(ZENDESK_SAMPLES)} Zendesk tickets.")


if __name__ == "__main__":
    import sys

    skip = "--skip-classification" in sys.argv or "-s" in sys.argv

    if skip:
        print("Skipping AI classification (test mode)\n")

    load_sample_data(skip_classification=skip)
