import { MessageSquare, User, Calendar, TrendingUp } from 'lucide-react'

export default function FeedbackCard({ feedback, onClick }) {
  const { text, source, created_at, classification, user_profile, nps_score } = feedback

  const getSentimentBadge = (sentiment) => {
    const styles = {
      positive: 'badge-positive',
      negative: 'badge-negative',
      neutral: 'badge-neutral',
    }
    return styles[sentiment] || 'badge-neutral'
  }

  const getUrgencyBadge = (urgency) => {
    const styles = {
      high: 'badge-high',
      medium: 'badge-medium',
      low: 'badge-low',
    }
    return styles[urgency] || 'badge-low'
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div
      className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="badge bg-indigo-100 text-indigo-800 uppercase text-xs">
            {source}
          </span>
          {nps_score !== null && nps_score !== undefined && (
            <span
              className={`badge ${
                nps_score >= 9
                  ? 'badge-positive'
                  : nps_score >= 7
                  ? 'badge-neutral'
                  : 'badge-negative'
              }`}
            >
              NPS: {nps_score}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar size={14} />
          {formatDate(created_at)}
        </span>
      </div>

      {/* Text */}
      <p className="text-gray-700 mb-3 line-clamp-3">{text}</p>

      {/* Classification */}
      {classification && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`badge ${getSentimentBadge(classification.sentiment)}`}>
            {classification.sentiment}
          </span>
          <span className={`badge ${getUrgencyBadge(classification.urgency)}`}>
            {classification.urgency} urgency
          </span>
          {classification.topics?.slice(0, 3).map((topic) => (
            <span key={topic} className="badge bg-gray-100 text-gray-700">
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      {classification?.summary && (
        <p className="text-sm text-gray-500 italic mb-3">
          "{classification.summary}"
        </p>
      )}

      {/* User Profile */}
      {user_profile && (
        <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <User size={14} />
            {user_profile.subscription_type || 'Unknown'}
          </span>
          {user_profile.mrr && (
            <span className="flex items-center gap-1">
              <TrendingUp size={14} />
              ${user_profile.mrr.toLocaleString()} MRR
            </span>
          )}
          {user_profile.company_name && (
            <span>{user_profile.company_name}</span>
          )}
        </div>
      )}
    </div>
  )
}
