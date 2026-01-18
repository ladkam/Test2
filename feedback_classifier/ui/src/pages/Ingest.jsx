import { useState } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { LoadingOverlay } from '../components/Loading'
import { api } from '../hooks/useApi'

const sources = [
  { id: 'nps', label: 'NPS Survey' },
  { id: 'zendesk', label: 'Zendesk Ticket' },
  { id: 'intercom', label: 'Intercom' },
  { id: 'email', label: 'Email' },
  { id: 'other', label: 'Other' },
]

export default function Ingest() {
  const [formData, setFormData] = useState({
    text: '',
    source: 'nps',
    nps_score: '',
    user_id: '',
    email: '',
    subscription_type: '',
    mrr: '',
    company_name: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.text.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const payload = {
        text: formData.text,
        source: formData.source,
        nps_score: formData.nps_score ? parseInt(formData.nps_score) : null,
        user_profile: formData.user_id
          ? {
              user_id: formData.user_id,
              email: formData.email || null,
              subscription_type: formData.subscription_type || null,
              mrr: formData.mrr ? parseFloat(formData.mrr) : null,
              company_name: formData.company_name || null,
            }
          : null,
      }

      const response = await api.ingest(payload)
      setResult(response)

      // Clear form
      setFormData({
        text: '',
        source: 'nps',
        nps_score: '',
        user_id: '',
        email: '',
        subscription_type: '',
        mrr: '',
        company_name: '',
      })
    } catch (err) {
      setError('Failed to ingest feedback. Please try again.')
      console.error('Ingest error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
          <Upload size={32} className="text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Import Feedback</h1>
        <p className="text-gray-500 mt-1">
          Add new feedback to classify and analyze
        </p>
      </div>

      {/* Success Result */}
      {result && (
        <div className="card p-6 mb-6 border-l-4 border-green-500">
          <div className="flex items-start gap-4">
            <CheckCircle size={24} className="text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 mb-2">
                Feedback Ingested Successfully
              </h3>

              {result.classification && (
                <div className="bg-green-50 rounded-lg p-4 mt-3">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Classification:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-green-600">Sentiment:</span>{' '}
                      <span className="font-medium capitalize">
                        {result.classification.sentiment}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-600">Urgency:</span>{' '}
                      <span className="font-medium capitalize">
                        {result.classification.urgency}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-600">Intent:</span>{' '}
                      <span className="font-medium">
                        {result.classification.intent?.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-600">Topics:</span>{' '}
                      <span className="font-medium">
                        {result.classification.topics?.join(', ')}
                      </span>
                    </div>
                  </div>
                  {result.classification.summary && (
                    <p className="mt-2 text-green-800 italic">
                      "{result.classification.summary}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-4 mb-6 border-l-4 border-red-500 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6">
        {/* Feedback Text */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Feedback Text <span className="text-red-500">*</span>
          </label>
          <textarea
            name="text"
            value={formData.text}
            onChange={handleChange}
            placeholder="Enter the customer feedback..."
            rows={4}
            className="input"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
            <select
              name="source"
              value={formData.source}
              onChange={handleChange}
              className="input"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* NPS Score */}
          {formData.source === 'nps' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NPS Score (0-10)
              </label>
              <input
                type="number"
                name="nps_score"
                value={formData.nps_score}
                onChange={handleChange}
                min="0"
                max="10"
                placeholder="e.g., 8"
                className="input"
              />
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <FileText size={16} />
            User Profile (Optional)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                User ID
              </label>
              <input
                type="text"
                name="user_id"
                value={formData.user_id}
                onChange={handleChange}
                placeholder="e.g., user_123"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g., user@example.com"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Subscription Type
              </label>
              <select
                name="subscription_type"
                value={formData.subscription_type}
                onChange={handleChange}
                className="input"
              >
                <option value="">Select...</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                MRR ($)
              </label>
              <input
                type="number"
                name="mrr"
                value={formData.mrr}
                onChange={handleChange}
                placeholder="e.g., 500"
                className="input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g., Acme Corp"
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6">
          <button
            type="submit"
            disabled={loading || !formData.text.trim()}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Ingest & Classify'}
          </button>
        </div>
      </form>

      {/* Bulk Import Info */}
      <div className="mt-8 card p-6 bg-gray-50">
        <h3 className="font-medium text-gray-700 mb-2">Bulk Import</h3>
        <p className="text-sm text-gray-500 mb-4">
          For importing large volumes of feedback, use the CLI or API:
        </p>
        <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
          {`# Import NPS from CSV
python cli.py ingest --file nps_export.csv

# Import Zendesk from JSON
python cli.py ingest --file tickets.json`}
        </pre>
      </div>

      {loading && <LoadingOverlay text="Classifying feedback..." />}
    </div>
  )
}
