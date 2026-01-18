import { useState, useEffect } from 'react'
import {
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BarChart3,
} from 'lucide-react'
import StatsCard from '../components/StatsCard'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackModal from '../components/FeedbackModal'
import Loading from '../components/Loading'
import { api } from '../hooks/useApi'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentFeedback, setRecentFeedback] = useState([])
  const [churnRisks, setChurnRisks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [statsData, recentData, churnData] = await Promise.all([
        api.getStats(30),
        api.search({ limit: 5, days: 7 }),
        api.getChurnRisks(500, 30),
      ])

      setStats(statsData)
      setRecentFeedback(recentData.items || [])
      setChurnRisks(churnData.items?.slice(0, 3) || [])
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <Loading text="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of customer feedback from the last 30 days
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Feedback"
          value={stats?.total_count || 0}
          icon={MessageSquare}
          color="indigo"
        />
        <StatsCard
          title="Positive"
          value={stats?.by_sentiment?.positive || 0}
          subtitle={`${((stats?.by_sentiment?.positive / stats?.total_count) * 100 || 0).toFixed(0)}% of total`}
          icon={ThumbsUp}
          color="green"
        />
        <StatsCard
          title="Negative"
          value={stats?.by_sentiment?.negative || 0}
          subtitle={`${((stats?.by_sentiment?.negative / stats?.total_count) * 100 || 0).toFixed(0)}% of total`}
          icon={ThumbsDown}
          color="red"
        />
        <StatsCard
          title="Avg NPS"
          value={stats?.avg_nps?.toFixed(1) || 'N/A'}
          icon={BarChart3}
          color="blue"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Feedback */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Feedback
            </h2>
            <span className="text-sm text-gray-500">Last 7 days</span>
          </div>

          <div className="space-y-4">
            {recentFeedback.length > 0 ? (
              recentFeedback.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  onClick={() => setSelectedFeedback(feedback)}
                />
              ))
            ) : (
              <div className="card p-8 text-center text-gray-500">
                No recent feedback found
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Churn Risks */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Churn Risks
              </h2>
            </div>

            <div className="space-y-3">
              {churnRisks.length > 0 ? (
                churnRisks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="card p-4 border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedFeedback(feedback)}
                  >
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {feedback.text}
                    </p>
                    {feedback.user_profile?.mrr && (
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        ${feedback.user_profile.mrr.toLocaleString()} MRR at
                        risk
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="card p-4 text-center text-gray-500 text-sm">
                  No churn risks detected
                </div>
              )}
            </div>
          </div>

          {/* Top Topics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Top Topics
            </h2>

            <div className="card p-4">
              {stats?.by_topic && Object.keys(stats.by_topic).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.by_topic)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([topic, count]) => (
                      <div
                        key={topic}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-700 capitalize">
                          {topic.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{
                                width: `${(count / stats.total_count) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-8 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm">
                  No topic data available
                </p>
              )}
            </div>
          </div>

          {/* Urgency Distribution */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              By Urgency
            </h2>

            <div className="card p-4">
              <div className="flex gap-4">
                {['high', 'medium', 'low'].map((level) => {
                  const count = stats?.by_urgency?.[level] || 0
                  const colors = {
                    high: 'bg-red-500',
                    medium: 'bg-yellow-500',
                    low: 'bg-blue-500',
                  }

                  return (
                    <div key={level} className="flex-1 text-center">
                      <div
                        className={`h-16 ${colors[level]} rounded-lg flex items-end justify-center pb-2`}
                        style={{
                          opacity: 0.3 + (count / (stats?.total_count || 1)) * 0.7,
                        }}
                      >
                        <span className="text-white font-bold">{count}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 capitalize">
                        {level}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
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
