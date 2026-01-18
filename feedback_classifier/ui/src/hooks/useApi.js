import { useState, useCallback } from 'react'

const API_BASE = '/api'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = useCallback(async (endpoint, options = {}) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  const get = useCallback((endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint
    return request(url)
  }, [request])

  const post = useCallback((endpoint, data) => {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }, [request])

  return { get, post, loading, error }
}

// API endpoints
export const api = {
  // Search
  search: (params) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    ).toString()
    return fetch(`${API_BASE}/search?${queryString}`).then(r => r.json())
  },

  // Ask question
  ask: (question, filters = {}) => {
    return fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, ...filters }),
    }).then(r => r.json())
  },

  // Statistics
  getStats: (days = 30) => {
    return fetch(`${API_BASE}/stats?days=${days}`).then(r => r.json())
  },

  // Alerts
  getChurnRisks: (minMrr = 100, days = 30) => {
    return fetch(`${API_BASE}/alerts/churn-risks?min_mrr=${minMrr}&days=${days}`).then(r => r.json())
  },

  getUrgentIssues: (days = 7) => {
    return fetch(`${API_BASE}/alerts/urgent?days=${days}`).then(r => r.json())
  },

  getUpsellOpportunities: (days = 30) => {
    return fetch(`${API_BASE}/alerts/upsell?days=${days}`).then(r => r.json())
  },

  // Topic summary
  getTopicSummary: (topic, days = 30) => {
    return fetch(`${API_BASE}/topic/${topic}/summary?days=${days}`).then(r => r.json())
  },

  // Ingest
  ingest: (data) => {
    return fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json())
  },

  // Custom search
  customSearch: (criteria, limit = 50) => {
    return fetch(`${API_BASE}/custom-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria, limit }),
    }).then(r => r.json())
  },
}
