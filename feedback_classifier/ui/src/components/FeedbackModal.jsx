import { X, User, Calendar, TrendingUp, Tag, AlertCircle } from 'lucide-react'

export default function FeedbackModal({ feedback, onClose }) {
  if (!feedback) return null

  const { text, source, created_at, classification, user_profile, nps_score, ticket_id } = feedback

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSentimentColor = (sentiment) => {
    const colors = {
      positive: 'text-green-600 bg-green-50',
      negative: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50',
    }
    return colors[sentiment] || colors.neutral
  }

  const getUrgencyColor = (urgency) => {
    const colors = {
      high: 'text-red-600 bg-red-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-blue-600 bg-blue-50',
    }
    return colors[urgency] || colors.low
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="badge bg-indigo-100 text-indigo-800 uppercase">
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
            {ticket_id && (
              <span className="text-sm text-gray-500">Ticket #{ticket_id}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Calendar size={16} />
            {formatDate(created_at)}
          </div>

          {/* Feedback Text */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Feedback</h3>
            <p className="text-gray-800 text-lg leading-relaxed">{text}</p>
          </div>

          {/* Classification */}
          {classification && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                AI Classification
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Sentiment */}
                <div
                  className={`p-4 rounded-lg ${getSentimentColor(
                    classification.sentiment
                  )}`}
                >
                  <p className="text-sm font-medium mb-1">Sentiment</p>
                  <p className="text-lg font-semibold capitalize">
                    {classification.sentiment}
                  </p>
                </div>

                {/* Urgency */}
                <div
                  className={`p-4 rounded-lg ${getUrgencyColor(
                    classification.urgency
                  )}`}
                >
                  <p className="text-sm font-medium mb-1">Urgency</p>
                  <p className="text-lg font-semibold capitalize">
                    {classification.urgency}
                  </p>
                </div>
              </div>

              {/* Intent */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Intent</p>
                <p className="text-gray-800 capitalize">
                  {classification.intent?.replace('_', ' ')}
                </p>
              </div>

              {/* Topics */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Topics</p>
                <div className="flex flex-wrap gap-2">
                  {classification.topics?.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                    >
                      <Tag size={14} />
                      {topic.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {classification.summary && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm font-medium text-indigo-700 mb-1">
                    AI Summary
                  </p>
                  <p className="text-indigo-900">{classification.summary}</p>
                </div>
              )}

              {/* Confidence */}
              <div className="mt-4 flex items-center gap-2">
                <AlertCircle size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">
                  Classification confidence:{' '}
                  {(classification.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* User Profile */}
          {user_profile && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                User Profile
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Subscription</p>
                    <p className="font-medium capitalize">
                      {user_profile.subscription_type || 'Unknown'}
                    </p>
                  </div>
                </div>

                {user_profile.mrr && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">MRR</p>
                      <p className="font-medium">
                        ${user_profile.mrr.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {user_profile.company_name && (
                  <div>
                    <p className="text-sm text-gray-500">Company</p>
                    <p className="font-medium">{user_profile.company_name}</p>
                  </div>
                )}

                {user_profile.industry && (
                  <div>
                    <p className="text-sm text-gray-500">Industry</p>
                    <p className="font-medium capitalize">
                      {user_profile.industry}
                    </p>
                  </div>
                )}

                {user_profile.email && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{user_profile.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
