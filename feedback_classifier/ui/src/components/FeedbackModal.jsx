import { useState } from 'react'
import { X, User, Calendar, TrendingUp, Tag, AlertCircle, Edit2, Save, XCircle } from 'lucide-react'

const API_BASE = '/api'

// Classification options
const SENTIMENTS = ['positive', 'neutral', 'negative']
const URGENCY_LEVELS = ['low', 'medium', 'high']
const INTENTS = ['churn_risk', 'upsell_opportunity', 'support_needed', 'feature_advocacy', 'general_feedback']
const TOPICS = [
  'bug', 'feature_request', 'pricing', 'ux', 'performance', 'onboarding',
  'support', 'documentation', 'integration', 'security', 'billing', 'mobile', 'api'
]

export default function FeedbackModal({ feedback, onClose, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Edit form state
  const [editSentiment, setEditSentiment] = useState(feedback?.classification?.sentiment || 'neutral')
  const [editTopics, setEditTopics] = useState(feedback?.classification?.topics || [])
  const [editUrgency, setEditUrgency] = useState(feedback?.classification?.urgency || 'low')
  const [editIntent, setEditIntent] = useState(feedback?.classification?.intent || 'general_feedback')
  const [editSummary, setEditSummary] = useState(feedback?.classification?.summary || '')

  if (!feedback) return null

  const { id, text, source, created_at, classification, user_profile, nps_score, ticket_id } = feedback

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

  const handleTopicToggle = (topic) => {
    setEditTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/feedback/${id}/classification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentiment: editSentiment,
          topics: editTopics,
          urgency: editUrgency,
          intent: editIntent,
          summary: editSummary,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update classification')
      }

      const data = await response.json()

      // Update local feedback object
      if (onUpdate) {
        onUpdate({
          ...feedback,
          classification: data.classification,
        })
      }

      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setEditSentiment(classification?.sentiment || 'neutral')
    setEditTopics(classification?.topics || [])
    setEditUrgency(classification?.urgency || 'low')
    setEditIntent(classification?.intent || 'general_feedback')
    setEditSummary(classification?.summary || '')
    setIsEditing(false)
    setError(null)
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Classification */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">
                {isEditing ? 'Edit Classification' : 'AI Classification'}
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || editTopics.length === 0}
                    className="flex items-center gap-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                {/* Sentiment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
                  <div className="flex gap-2">
                    {SENTIMENTS.map(s => (
                      <button
                        key={s}
                        onClick={() => setEditSentiment(s)}
                        className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                          editSentiment === s
                            ? getSentimentColor(s) + ' ring-2 ring-offset-2 ring-indigo-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
                  <div className="flex gap-2">
                    {URGENCY_LEVELS.map(u => (
                      <button
                        key={u}
                        onClick={() => setEditUrgency(u)}
                        className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                          editUrgency === u
                            ? getUrgencyColor(u) + ' ring-2 ring-offset-2 ring-indigo-500'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intent */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Intent</label>
                  <select
                    value={editIntent}
                    onChange={(e) => setEditIntent(e.target.value)}
                    className="input w-full"
                  >
                    {INTENTS.map(i => (
                      <option key={i} value={i}>
                        {i.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topics */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Topics <span className="text-gray-400">(select 1-3)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleTopicToggle(topic)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          editTopics.includes(topic)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {topic.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  {editTopics.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">Select at least one topic</p>
                  )}
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                  <input
                    type="text"
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="Brief summary of the feedback"
                    maxLength={100}
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">{editSummary.length}/100 characters</p>
                </div>
              </div>
            ) : (
              /* View Mode */
              classification && (
                <>
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
                      {classification.intent?.replace(/_/g, ' ')}
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
                          {topic.replace(/_/g, ' ')}
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
                      {classification.confidence === 1 && ' (manually edited)'}
                    </span>
                  </div>
                </>
              )
            )}
          </div>

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
