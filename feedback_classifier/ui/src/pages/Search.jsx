import { useState, useEffect } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import Filters from '../components/Filters'
import FeedbackCard from '../components/FeedbackCard'
import FeedbackModal from '../components/FeedbackModal'
import Loading from '../components/Loading'
import { api } from '../hooks/useApi'

const defaultFilters = {
  sources: '',
  sentiments: '',
  urgency: '',
  topics: '',
  subscription_types: '',
  min_mrr: '',
  max_mrr: '',
  min_nps: '',
  max_nps: '',
  days: 30,
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(defaultFilters)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState(null)

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params = {
        query: query || undefined,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '' && v != null)
        ),
        limit: 50,
      }

      const data = await api.search(params)
      setResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  // Initial load
  useEffect(() => {
    handleSearch()
  }, [])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Search Feedback</h1>
        <p className="text-gray-500 mt-1">
          Find feedback using semantic search and filters
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <SearchIcon
            size={20}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by meaning (e.g., 'pricing complaints', 'slow performance')"
            className="input pl-12"
          />
        </div>
        <button onClick={handleSearch} className="btn btn-primary">
          Search
        </button>
      </div>

      {/* Filters */}
      <Filters filters={filters} onChange={setFilters} onClear={clearFilters} />

      {/* Results */}
      {loading ? (
        <Loading text="Searching..." />
      ) : results ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">
              Found <span className="font-semibold">{results.total_count}</span>{' '}
              results
              {query && (
                <span className="text-gray-400">
                  {' '}
                  for "{query}"
                </span>
              )}
            </p>
          </div>

          {results.items?.length > 0 ? (
            <div className="space-y-4">
              {results.items.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  onClick={() => setSelectedFeedback(feedback)}
                />
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <p className="text-gray-500">No feedback matches your search</p>
              <p className="text-sm text-gray-400 mt-2">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      ) : null}

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
