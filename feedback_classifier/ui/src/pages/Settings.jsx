import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Key,
  Cpu,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import Loading from '../components/Loading'

const API_BASE = '/api'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [classificationModel, setClassificationModel] = useState('')
  const [embeddingDimensions, setEmbeddingDimensions] = useState(768)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/settings`)
      const data = await response.json()
      setSettings(data)
      setEmbeddingModel(data.embedding_model)
      setClassificationModel(data.classification_model)
      setEmbeddingDimensions(data.embedding_dimensions)
    } catch (error) {
      console.error('Failed to load settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const payload = {}
      if (apiKey) payload.google_api_key = apiKey
      if (embeddingModel !== settings.embedding_model) payload.embedding_model = embeddingModel
      if (classificationModel !== settings.classification_model) payload.classification_model = classificationModel
      if (embeddingDimensions !== settings.embedding_dimensions) payload.embedding_dimensions = embeddingDimensions

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'info', text: 'No changes to save' })
        setSaving(false)
        return
      }

      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setApiKey('') // Clear the API key field after saving
        await loadSettings() // Reload to get updated masked key
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestApiKey = async () => {
    const keyToTest = apiKey || settings?.google_api_key
    if (!keyToTest || keyToTest.includes('*')) {
      setMessage({ type: 'error', text: 'Please enter an API key to test' })
      return
    }

    setTesting(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('api_key', apiKey)

      const response = await fetch(`${API_BASE}/settings/test-api-key`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.valid) {
        setMessage({ type: 'success', text: `API key is valid! Response: "${data.test_response}"` })
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test API key' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <Loading text="Loading settings..." />
      </div>
    )
  }

  const selectedEmbeddingModel = settings?.available_models?.embedding?.find(
    (m) => m.id === embeddingModel
  )

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <SettingsIcon size={24} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-500">
          Configure your Google AI API key and model preferences
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          {message.text}
        </div>
      )}

      {/* API Key Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Google AI API Key</h2>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Get your API key from{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            Google AI Studio
            <ExternalLink size={14} />
          </a>
        </p>

        {settings?.google_api_key_set && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <Check size={18} />
              <span className="font-medium">API Key is configured</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              Current key: {settings.google_api_key}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                settings?.google_api_key_set
                  ? 'Enter new API key to update...'
                  : 'Enter your Google AI API key...'
              }
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            onClick={handleTestApiKey}
            disabled={testing || !apiKey}
            className="btn btn-secondary disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              'Test'
            )}
          </button>
        </div>
      </div>

      {/* Models Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Cpu size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Models</h2>
        </div>

        {/* Embedding Model */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Embedding Model
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Used to convert feedback text into vectors for semantic search
          </p>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="input"
          >
            {settings?.available_models?.embedding?.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        {/* Embedding Dimensions */}
        {selectedEmbeddingModel?.dimensions && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Embedding Dimensions
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Higher dimensions = better quality but more storage. 768 is usually sufficient.
            </p>
            <div className="flex gap-3">
              {selectedEmbeddingModel.dimensions.map((dim) => (
                <button
                  key={dim}
                  onClick={() => setEmbeddingDimensions(dim)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    embeddingDimensions === dim
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Classification Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Classification Model
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Used to analyze sentiment, topics, urgency, and generate summaries
          </p>
          <select
            value={classificationModel}
            onChange={(e) => setClassificationModel(e.target.value)}
            className="input"
          >
            {settings?.available_models?.classification?.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw size={18} className="animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-700 mb-2">Note</h3>
        <p className="text-sm text-gray-500">
          Settings are stored in memory and will reset when the server restarts.
          For permanent configuration, update the <code className="bg-gray-200 px-1 rounded">.env</code> file:
        </p>
        <pre className="mt-3 bg-gray-800 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
{`GOOGLE_API_KEY=your-api-key-here
EMBEDDING_MODEL=gemini-embedding-001
CLASSIFICATION_MODEL=gemini-2.5-flash
EMBEDDING_DIMENSIONS=768`}
        </pre>
      </div>
    </div>
  )
}
