#!/usr/bin/env python3
"""Command-line interface for feedback classification system.

Usage:
    python cli.py ingest "Your feedback text here" --source nps --nps-score 8
    python cli.py search --query "pricing complaints" --sentiment negative
    python cli.py ask "What are the main issues from enterprise users?"
    python cli.py alerts churn --min-mrr 500
    python cli.py stats
"""
import argparse
import json
import sys

from models import FeedbackSource, UserProfile
from ingestion import FeedbackIngester
from query_service import FeedbackQueryService


def cmd_ingest(args):
    """Ingest feedback from command line or file."""
    ingester = FeedbackIngester()

    if args.file:
        # Ingest from file
        if args.file.endswith(".csv"):
            items = ingester.ingest_nps_csv(args.file)
            print(f"Ingested {len(items)} feedback items from CSV")
        elif args.file.endswith(".json"):
            items = ingester.ingest_zendesk_json(args.file)
            print(f"Ingested {len(items)} feedback items from JSON")
        else:
            print("Unsupported file format. Use .csv or .json")
            sys.exit(1)
    else:
        # Ingest single feedback
        user_profile = None
        if args.user_id:
            user_profile = UserProfile(
                user_id=args.user_id,
                subscription_type=args.subscription,
                mrr=args.mrr,
            )

        feedback = ingester.ingest_single(
            text=args.text,
            source=FeedbackSource(args.source),
            user_profile=user_profile,
            nps_score=args.nps_score,
        )

        print(f"\nFeedback ID: {feedback.id}")
        print(f"Source: {feedback.source.value}")

        if feedback.classification:
            c = feedback.classification
            print(f"\nClassification:")
            print(f"  Sentiment: {c.sentiment.value}")
            print(f"  Topics: {', '.join(c.topics)}")
            print(f"  Urgency: {c.urgency.value}")
            print(f"  Intent: {c.intent.value}")
            print(f"  Summary: {c.summary}")
            print(f"  Confidence: {c.confidence:.2f}")


def cmd_search(args):
    """Search feedback with filters."""
    service = FeedbackQueryService()

    result = service.search(
        query_text=args.query,
        sources=args.sources.split(",") if args.sources else None,
        sentiments=args.sentiments.split(",") if args.sentiments else None,
        topics=args.topics.split(",") if args.topics else None,
        urgency_levels=args.urgency.split(",") if args.urgency else None,
        subscription_types=args.subscriptions.split(",") if args.subscriptions else None,
        min_mrr=args.min_mrr,
        max_mrr=args.max_mrr,
        min_nps=args.min_nps,
        max_nps=args.max_nps,
        days_back=args.days,
        limit=args.limit,
    )

    print(f"\nFound {result.total_count} results (showing {len(result.items)}):\n")

    for i, item in enumerate(result.items, 1):
        print(f"{i}. [{item.source.value}] {item.text[:100]}...")

        if item.classification:
            c = item.classification
            print(f"   Sentiment: {c.sentiment.value} | Topics: {', '.join(c.topics)} | Urgency: {c.urgency.value}")

        if item.user_profile:
            u = item.user_profile
            print(f"   User: {u.subscription_type or 'unknown'} | MRR: ${u.mrr or 0:.0f}")

        if item.nps_score is not None:
            print(f"   NPS: {item.nps_score}")

        print()


def cmd_ask(args):
    """Ask a natural language question about feedback."""
    service = FeedbackQueryService()

    answer = service.ask(
        question=args.question,
        sources=args.sources.split(",") if args.sources else None,
        sentiments=args.sentiments.split(",") if args.sentiments else None,
        topics=args.topics.split(",") if args.topics else None,
        subscription_types=args.subscriptions.split(",") if args.subscriptions else None,
        min_mrr=args.min_mrr,
        days_back=args.days,
    )

    print(f"\nQuestion: {args.question}\n")
    print(f"Answer:\n{answer}\n")


def cmd_alerts(args):
    """Get proactive alerts."""
    service = FeedbackQueryService()

    if args.alert_type == "churn":
        result = service.get_churn_risks(
            min_mrr=args.min_mrr or 100,
            days_back=args.days or 30,
        )
        title = "Churn Risk Alerts"

    elif args.alert_type == "urgent":
        result = service.get_urgent_issues(days_back=args.days or 7)
        title = "Urgent Issues"

    elif args.alert_type == "upsell":
        result = service.get_upsell_opportunities(days_back=args.days or 30)
        title = "Upsell Opportunities"

    elif args.alert_type == "detractors":
        result = service.get_detractor_feedback(days_back=args.days or 30)
        title = "Detractor Feedback (NPS 0-6)"

    else:
        print(f"Unknown alert type: {args.alert_type}")
        sys.exit(1)

    print(f"\n{title} ({result.total_count} found):\n")

    for i, item in enumerate(result.items, 1):
        print(f"{i}. {item.text[:150]}...")

        if item.classification:
            c = item.classification
            print(f"   {c.sentiment.value} | {c.urgency.value} urgency | {c.intent.value}")

        if item.user_profile and item.user_profile.mrr:
            print(f"   MRR: ${item.user_profile.mrr:.0f}")

        print()


def cmd_stats(args):
    """Get feedback statistics."""
    service = FeedbackQueryService()
    stats = service.get_statistics(args.days)

    print(f"\nFeedback Statistics (last {args.days} days):\n")
    print(f"Total feedback: {stats['total_count']}")

    if stats["avg_nps"]:
        print(f"Average NPS: {stats['avg_nps']:.1f}")

    print(f"\nBy Sentiment:")
    for sentiment, count in stats["by_sentiment"].items():
        print(f"  {sentiment}: {count}")

    print(f"\nBy Source:")
    for source, count in stats["by_source"].items():
        print(f"  {source}: {count}")

    print(f"\nBy Topic:")
    sorted_topics = sorted(stats["by_topic"].items(), key=lambda x: x[1], reverse=True)
    for topic, count in sorted_topics[:10]:
        print(f"  {topic}: {count}")

    print(f"\nBy Urgency:")
    for urgency, count in stats["by_urgency"].items():
        print(f"  {urgency}: {count}")

    print(f"\nBy Intent:")
    for intent, count in stats["by_intent"].items():
        print(f"  {intent}: {count}")


def cmd_topic_summary(args):
    """Get summary for a specific topic."""
    service = FeedbackQueryService()
    summary = service.get_topic_summary(args.topic, args.days)

    print(f"\nTopic Summary: {args.topic}\n")
    print(summary)


def main():
    parser = argparse.ArgumentParser(
        description="Feedback Classification CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest feedback")
    ingest_parser.add_argument("text", nargs="?", help="Feedback text")
    ingest_parser.add_argument("--file", "-f", help="CSV or JSON file to import")
    ingest_parser.add_argument("--source", "-s", default="nps", help="Source: nps, zendesk, etc.")
    ingest_parser.add_argument("--nps-score", type=int, help="NPS score (0-10)")
    ingest_parser.add_argument("--user-id", help="User ID")
    ingest_parser.add_argument("--subscription", help="Subscription type")
    ingest_parser.add_argument("--mrr", type=float, help="Monthly recurring revenue")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search feedback")
    search_parser.add_argument("--query", "-q", help="Semantic search query")
    search_parser.add_argument("--sources", help="Filter by sources (comma-separated)")
    search_parser.add_argument("--sentiments", help="Filter by sentiments (comma-separated)")
    search_parser.add_argument("--topics", help="Filter by topics (comma-separated)")
    search_parser.add_argument("--urgency", help="Filter by urgency (comma-separated)")
    search_parser.add_argument("--subscriptions", help="Filter by subscription types")
    search_parser.add_argument("--min-mrr", type=float, help="Minimum MRR")
    search_parser.add_argument("--max-mrr", type=float, help="Maximum MRR")
    search_parser.add_argument("--min-nps", type=int, help="Minimum NPS score")
    search_parser.add_argument("--max-nps", type=int, help="Maximum NPS score")
    search_parser.add_argument("--days", type=int, default=30, help="Days back to search")
    search_parser.add_argument("--limit", type=int, default=20, help="Max results")

    # Ask command
    ask_parser = subparsers.add_parser("ask", help="Ask a question about feedback")
    ask_parser.add_argument("question", help="Natural language question")
    ask_parser.add_argument("--sources", help="Filter by sources")
    ask_parser.add_argument("--sentiments", help="Filter by sentiments")
    ask_parser.add_argument("--topics", help="Filter by topics")
    ask_parser.add_argument("--subscriptions", help="Filter by subscription types")
    ask_parser.add_argument("--min-mrr", type=float, help="Minimum MRR")
    ask_parser.add_argument("--days", type=int, default=30, help="Days back")

    # Alerts command
    alerts_parser = subparsers.add_parser("alerts", help="Get proactive alerts")
    alerts_parser.add_argument(
        "alert_type",
        choices=["churn", "urgent", "upsell", "detractors"],
        help="Type of alert",
    )
    alerts_parser.add_argument("--min-mrr", type=float, help="Minimum MRR (for churn)")
    alerts_parser.add_argument("--days", type=int, help="Days back")

    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Get statistics")
    stats_parser.add_argument("--days", type=int, default=30, help="Days back")

    # Topic summary command
    topic_parser = subparsers.add_parser("topic", help="Get topic summary")
    topic_parser.add_argument("topic", help="Topic name")
    topic_parser.add_argument("--days", type=int, default=30, help="Days back")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "ingest":
        cmd_ingest(args)
    elif args.command == "search":
        cmd_search(args)
    elif args.command == "ask":
        cmd_ask(args)
    elif args.command == "alerts":
        cmd_alerts(args)
    elif args.command == "stats":
        cmd_stats(args)
    elif args.command == "topic":
        cmd_topic_summary(args)


if __name__ == "__main__":
    main()
