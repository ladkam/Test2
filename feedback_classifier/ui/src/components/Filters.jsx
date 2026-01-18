import { X } from 'lucide-react'

const SENTIMENTS = ['positive', 'neutral', 'negative']
const URGENCY_LEVELS = ['low', 'medium', 'high']
const SOURCES = ['nps', 'zendesk', 'intercom', 'email']
const TOPICS = [
  'bug',
  'feature_request',
  'pricing',
  'ux',
  'performance',
  'onboarding',
  'support',
  'documentation',
  'integration',
  'security',
  'billing',
  'mobile',
  'api',
]
const SUBSCRIPTION_TYPES = ['free', 'starter', 'pro', 'enterprise']

export default function Filters({ filters, onChange, onClear }) {
  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value })
  }

  const activeFilterCount = Object.values(filters).filter(
    (v) => v != null && v !== '' && v.length !== 0
  ).length

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-700">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <X size={14} />
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Source
          </label>
          <select
            value={filters.sources || ''}
            onChange={(e) => updateFilter('sources', e.target.value)}
            className="input"
          >
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Sentiment
          </label>
          <select
            value={filters.sentiments || ''}
            onChange={(e) => updateFilter('sentiments', e.target.value)}
            className="input"
          >
            <option value="">All sentiments</option>
            {SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Urgency
          </label>
          <select
            value={filters.urgency || ''}
            onChange={(e) => updateFilter('urgency', e.target.value)}
            className="input"
          >
            <option value="">All urgency levels</option>
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {u.charAt(0).toUpperCase() + u.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Subscription */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Subscription
          </label>
          <select
            value={filters.subscription_types || ''}
            onChange={(e) => updateFilter('subscription_types', e.target.value)}
            className="input"
          >
            <option value="">All subscriptions</option>
            {SUBSCRIPTION_TYPES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Topic
          </label>
          <select
            value={filters.topics || ''}
            onChange={(e) => updateFilter('topics', e.target.value)}
            className="input"
          >
            <option value="">All topics</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Min MRR */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Min MRR
          </label>
          <input
            type="number"
            value={filters.min_mrr || ''}
            onChange={(e) => updateFilter('min_mrr', e.target.value)}
            placeholder="e.g., 500"
            className="input"
          />
        </div>

        {/* NPS Range */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            NPS Score
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={filters.min_nps || ''}
              onChange={(e) => updateFilter('min_nps', e.target.value)}
              placeholder="Min"
              min="0"
              max="10"
              className="input"
            />
            <input
              type="number"
              value={filters.max_nps || ''}
              onChange={(e) => updateFilter('max_nps', e.target.value)}
              placeholder="Max"
              min="0"
              max="10"
              className="input"
            />
          </div>
        </div>

        {/* Days */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Time Range
          </label>
          <select
            value={filters.days || 30}
            onChange={(e) => updateFilter('days', parseInt(e.target.value))}
            className="input"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>
    </div>
  )
}
