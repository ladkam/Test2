import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Calendar, Filter, RefreshCw } from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { LoadingSpinner } from '../components/Loading'

const API_BASE = '/api'

const TIME_GRAINS = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const TIME_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' },
]

const SENTIMENTS = ['positive', 'neutral', 'negative']
const SOURCES = ['nps', 'zendesk', 'intercom', 'email', 'other']

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
  unknown: '#9ca3af',
}

const SOURCE_COLORS = {
  nps: '#6366f1',
  zendesk: '#f59e0b',
  intercom: '#3b82f6',
  email: '#8b5cf6',
  other: '#9ca3af',
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Filters
  const [grain, setGrain] = useState('day')
  const [daysBack, setDaysBack] = useState(30)
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedSentiments, setSelectedSentiments] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        grain,
        days_back: daysBack.toString(),
      })

      if (selectedSources.length > 0) {
        params.set('sources', selectedSources.join(','))
      }
      if (selectedSentiments.length > 0) {
        params.set('sentiments', selectedSentiments.join(','))
      }

      const response = await fetch(`${API_BASE}/analytics/volume?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [grain, daysBack, selectedSources, selectedSentiments])

  const toggleSource = (source) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )
  }

  const toggleSentiment = (sentiment) => {
    setSelectedSentiments((prev) =>
      prev.includes(sentiment) ? prev.filter((s) => s !== sentiment) : [...prev, sentiment]
    )
  }

  // Transform data for stacked area chart
  const getStackedAreaData = () => {
    if (!data?.data) return []
    return data.data.map((item) => ({
      period: item.period,
      positive: item.by_sentiment?.positive || 0,
      neutral: item.by_sentiment?.neutral || 0,
      negative: item.by_sentiment?.negative || 0,
    }))
  }

  // Transform data for source bar chart
  const getSourceBarData = () => {
    if (!data?.data) return []
    return data.data.map((item) => ({
      period: item.period,
      ...item.by_source,
    }))
  }

  // Get pie chart data for sentiment distribution
  const getSentimentPieData = () => {
    if (!data?.totals?.by_sentiment) return []
    return Object.entries(data.totals.by_sentiment).map(([name, value]) => ({
      name,
      value,
    }))
  }

  // Get pie chart data for source distribution
  const getSourcePieData = () => {
    if (!data?.totals?.by_source) return []
    return Object.entries(data.totals.by_source).map(([name, value]) => ({
      name,
      value,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" />
            Analytics
          </h1>
          <p className="text-gray-500 mt-1">Feedback volume trends and distribution</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-secondary flex items-center gap-2 ${showFilters ? 'bg-indigo-100' : ''}`}
          >
            <Filter size={18} />
            Filters
          </button>
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Time Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="input"
            >
              {TIME_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {TIME_GRAINS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGrain(g.value)}
                  className={`px-3 py-2 text-sm transition-colors ${
                    grain === g.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {data?.totals && (
            <div className="ml-auto text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-900">{data.totals.count}</span> feedback items
            </div>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map((source) => (
                    <button
                      key={source}
                      onClick={() => toggleSource(source)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedSources.includes(source)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sentiments</p>
                <div className="flex flex-wrap gap-2">
                  {SENTIMENTS.map((sentiment) => (
                    <button
                      key={sentiment}
                      onClick={() => toggleSentiment(sentiment)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors capitalize ${
                        selectedSentiments.includes(sentiment)
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={
                        selectedSentiments.includes(sentiment)
                          ? { backgroundColor: SENTIMENT_COLORS[sentiment] }
                          : {}
                      }
                    >
                      {sentiment}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(selectedSources.length > 0 || selectedSentiments.length > 0) && (
              <button
                onClick={() => {
                  setSelectedSources([])
                  setSelectedSentiments([])
                }}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-12 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {/* Charts */}
      {!loading && data && (
        <div className="space-y-6">
          {/* Volume Over Time - Stacked Area */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Feedback Volume by Sentiment
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getStackedAreaData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stackId="1"
                    stroke={SENTIMENT_COLORS.positive}
                    fill={SENTIMENT_COLORS.positive}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    stackId="1"
                    stroke={SENTIMENT_COLORS.neutral}
                    fill={SENTIMENT_COLORS.neutral}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stackId="1"
                    stroke={SENTIMENT_COLORS.negative}
                    fill={SENTIMENT_COLORS.negative}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Source Distribution Over Time - Bar Chart */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Feedback Volume by Source
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getSourceBarData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {SOURCES.map((source) => (
                    <Bar
                      key={source}
                      dataKey={source}
                      stackId="a"
                      fill={SOURCE_COLORS[source]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Pie Charts */}
          <div className="grid grid-cols-2 gap-6">
            {/* Sentiment Distribution */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Sentiment Distribution
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getSentimentPieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {getSentimentPieData().map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={SENTIMENT_COLORS[entry.name] || SENTIMENT_COLORS.unknown}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Source Distribution */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Source Distribution
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getSourcePieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {getSourcePieData().map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={SOURCE_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && data?.data?.length === 0 && (
        <div className="card p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No data available</h3>
          <p className="text-gray-500 mt-1">
            Try adjusting your filters or time range
          </p>
        </div>
      )}
    </div>
  )
}
