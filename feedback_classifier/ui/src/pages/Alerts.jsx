import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
} from 'lucide-react'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackModal from '../components/FeedbackModal'
import Loading from '../components/Loading'
import { api } from '../hooks/useApi'

const alertTypes = [
  {
    id: 'churn',
    label: 'Churn Risks',
    description: 'High-value users showing frustration',
    icon: TrendingDown,
    color: 'red',
  },
  {
    id: 'urgent',
    label: 'Urgent Issues',
    description: 'High-urgency problems requiring attention',
    icon: AlertTriangle,
    color: 'yellow',
  },
  {
    id: 'upsell',
    label: 'Upsell Opportunities',
    description: 'Users expressing interest in more features',
    icon: TrendingUp,
    color: 'green',
  },
  {
    id: 'detractors',
    label: 'Detractors',
    description: 'NPS scores 0-6',
    icon: Users,
    color: 'orange',
  },
]

export default function Alerts() {
  const [activeType, setActiveType] = useState('churn')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState(null)

  useEffect(() => {
    loadAlerts()
  }, [activeType])

  const loadAlerts = async () => {
    setLoading(true)
    try {
      let data
      switch (activeType) {
        case 'churn':
          data = await api.getChurnRisks(100, 30)
          break
        case 'urgent':
          data = await api.getUrgentIssues(7)
          break
        case 'upsell':
          data = await api.getUpsellOpportunities(30)
          break
        case 'detractors':
          data = await api.search({ max_nps: 6, sources: 'nps', limit: 50 })
          break
        default:
          data = { items: [] }
      }
      setAlerts(data.items || [])
    } catch (error) {
      console.error('Failed to load alerts:', error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const activeAlertType = alertTypes.find((t) => t.id === activeType)

  const colorStyles = {
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-500 mt-1">
            Proactive notifications about important feedback
          </p>
        </div>
        <button
          onClick={loadAlerts}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Alert Type Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {alertTypes.map((type) => {
          const Icon = type.icon
          const isActive = activeType === type.id

          return (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isActive
                  ? colorStyles[type.color]
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon
                  size={24}
                  className={isActive ? '' : 'text-gray-400'}
                />
                <span className="font-semibold">{type.label}</span>
              </div>
              <p
                className={`text-sm ${
                  isActive ? '' : 'text-gray-500'
                }`}
              >
                {type.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Alert Content */}
      <div className="card">
        <div
          className={`p-4 border-b ${
            colorStyles[activeAlertType?.color] || ''
          } rounded-t-xl`}
        >
          <div className="flex items-center gap-3">
            {activeAlertType && (
              <activeAlertType.icon size={24} />
            )}
            <div>
              <h2 className="font-semibold text-lg">
                {activeAlertType?.label}
              </h2>
              <p className="text-sm opacity-80">
                {alerts.length} items found
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <Loading text="Loading alerts..." />
          ) : alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  onClick={() => setSelectedFeedback(feedback)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                {activeAlertType && (
                  <activeAlertType.icon size={32} className="text-gray-400" />
                )}
              </div>
              <p className="text-gray-500">
                No {activeAlertType?.label.toLowerCase()} found
              </p>
              <p className="text-sm text-gray-400 mt-1">
                This is good news!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {selectedFeedback && (
        <FeedbackModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
        />
      )}
    </div>
  )
}
