import { useState, useRef, useEffect } from 'react'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  StopCircle,
} from 'lucide-react'
import { LoadingOverlay } from './Loading'

const API_BASE = '/api'

// Available fields to map to
const MAPPING_FIELDS = [
  { key: 'text', label: 'Feedback Text', required: true, description: 'The main feedback content' },
  { key: 'created_at', label: 'Date', required: false, description: 'Feedback date (ISO format or common formats)' },
  { key: 'source', label: 'Source', required: false, description: 'nps, zendesk, intercom, email, other' },
  { key: 'nps_score', label: 'NPS Score', required: false, description: 'Score from 0-10' },
  { key: 'user_id', label: 'User ID', required: false, description: 'Unique user identifier' },
  { key: 'email', label: 'Email', required: false, description: 'User email address' },
  { key: 'subscription_type', label: 'Subscription', required: false, description: 'free, starter, pro, enterprise' },
  { key: 'mrr', label: 'MRR', required: false, description: 'Monthly recurring revenue' },
  { key: 'company_name', label: 'Company', required: false, description: 'Company name' },
  { key: 'industry', label: 'Industry', required: false, description: 'Industry vertical' },
  { key: 'ticket_id', label: 'Ticket ID', required: false, description: 'Support ticket ID' },
  { key: 'ticket_priority', label: 'Ticket Priority', required: false, description: 'low, medium, high, urgent' },
]

const SOURCES = ['nps', 'zendesk', 'intercom', 'email', 'other']

export default function CSVUpload({ onComplete }) {
  const [step, setStep] = useState('upload') // upload, map, importing, done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState({})
  const [defaultSource, setDefaultSource] = useState('nps')
  const [skipClassification, setSkipClassification] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const fileInputRef = useRef(null)

  // Progress tracking
  const [jobId, setJobId] = useState(null)
  const [progress, setProgress] = useState(null)
  const pollIntervalRef = useRef(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setFile(selectedFile)
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${API_BASE}/csv/preview`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to parse CSV')
      }

      const data = await response.json()
      setPreview(data)

      // Auto-map columns with matching names
      const autoMapping = {}
      MAPPING_FIELDS.forEach((field) => {
        const matchingColumn = data.columns.find(
          (col) =>
            col.toLowerCase() === field.key.toLowerCase() ||
            col.toLowerCase().includes(field.key.toLowerCase()) ||
            field.key.toLowerCase().includes(col.toLowerCase())
        )
        if (matchingColumn) {
          autoMapping[field.key] = matchingColumn
        }
      })
      setMapping(autoMapping)
      setStep('map')
    } catch (err) {
      setError(err.message || 'Failed to load CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (fieldKey, columnName) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: columnName || undefined,
    }))
  }

  const canImport = mapping.text // text is required

  const pollProgress = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/csv/import/${id}/status`)
      if (!response.ok) {
        throw new Error('Failed to get status')
      }

      const data = await response.json()
      setProgress(data.progress)

      // Check if completed or failed
      if (data.status === 'completed') {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
        setResult(data.result)
        setStep('done')
        if (onComplete) {
          onComplete(data.result)
        }
      } else if (data.status === 'failed') {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
        setError(data.error || 'Import failed')
        setStep('map')
      } else if (data.status === 'cancelled') {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
        setError('Import was cancelled')
        setStep('map')
      }
    } catch (err) {
      console.error('Polling error:', err)
    }
  }

  const handleImport = async () => {
    if (!canImport || !file) return

    setLoading(true)
    setStep('importing')
    setError(null)
    setProgress(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append(
        'mapping_json',
        JSON.stringify({
          ...mapping,
          default_source: defaultSource,
        })
      )
      formData.append('skip_classification', skipClassification.toString())

      // Use async endpoint with progress tracking
      const response = await fetch(`${API_BASE}/csv/import-async`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Import failed')
      }

      const data = await response.json()
      setJobId(data.job_id)

      // Start polling for progress
      setProgress({ current: 0, total: data.total_rows, percentage: 0, message: 'Starting...' })
      pollIntervalRef.current = setInterval(() => pollProgress(data.job_id), 1000)

    } catch (err) {
      setError(err.message || 'Import failed')
      setStep('map')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (jobId) {
      try {
        await fetch(`${API_BASE}/csv/import/${jobId}/cancel`, { method: 'POST' })
      } catch (err) {
        console.error('Cancel error:', err)
      }
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    setStep('map')
    setJobId(null)
    setProgress(null)
  }

  const reset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setStep('upload')
    setFile(null)
    setPreview(null)
    setMapping({})
    setResult(null)
    setError(null)
    setJobId(null)
    setProgress(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Step 1: Upload
  if (step === 'upload') {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-indigo-600" />
          Import from CSV
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop your CSV file here, or click to browse
          </p>
          <p className="text-sm text-gray-400">
            Supports NPS exports, Zendesk exports, and custom formats
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {loading && <LoadingOverlay text="Reading CSV..." />}
      </div>
    )
  }

  // Step 2: Map columns
  if (step === 'map') {
    return (
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet size={24} className="text-indigo-600" />
                Map Columns
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {preview?.filename} - {preview?.total_rows} rows
              </p>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Preview Section */}
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Preview Data ({preview?.sample_rows?.length} rows)
          </button>

          {showPreview && preview?.sample_rows?.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {preview.columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {preview.columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mapping Section */}
        <div className="p-6">
          <h4 className="font-medium text-gray-700 mb-4">Column Mapping</h4>

          <div className="space-y-3">
            {MAPPING_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-40 flex-shrink-0">
                  <span className="font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <p className="text-xs text-gray-400">{field.description}</p>
                </div>

                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />

                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => handleMappingChange(field.key, e.target.value)}
                  className={`flex-1 input ${
                    field.required && !mapping[field.key]
                      ? 'border-red-300 focus:ring-red-500'
                      : ''
                  }`}
                >
                  <option value="">-- Select column --</option>
                  {preview?.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>

                {mapping[field.key] && (
                  <Check size={18} className="text-green-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Default Source */}
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <label className="block text-sm font-medium text-indigo-700 mb-2">
              Default Source (if not mapped)
            </label>
            <select
              value={defaultSource}
              onChange={(e) => setDefaultSource(e.target.value)}
              className="input w-48"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipClassification}
                onChange={(e) => setSkipClassification(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-sm text-gray-600">
                Skip AI classification (faster import, classify later)
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button onClick={reset} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="btn btn-primary disabled:opacity-50"
          >
            Import {preview?.total_rows} Rows
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Importing with Progress
  if (step === 'importing') {
    const percentage = progress?.percentage || 0
    const current = progress?.current || 0
    const total = progress?.total || preview?.total_rows || 0
    const successful = progress?.successful || 0
    const errors = progress?.errors || 0
    const message = progress?.message || 'Starting...'

    return (
      <div className="card p-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Importing Feedback
          </h3>
          <p className="text-sm text-gray-500">
            {skipClassification
              ? 'Storing data without classification'
              : 'Embedding and classifying each item'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{current} / {total}</span>
            <span>{percentage.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{successful}</p>
            <p className="text-sm text-green-700">Successful</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{errors}</p>
            <p className="text-sm text-red-700">Errors</p>
          </div>
        </div>

        {/* Current Status */}
        <div className="p-3 bg-gray-100 rounded-lg mb-6">
          <p className="text-sm text-gray-600 text-center truncate">{message}</p>
        </div>

        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className="btn btn-secondary w-full flex items-center justify-center gap-2"
        >
          <StopCircle size={18} />
          Cancel Import
        </button>
      </div>
    )
  }

  // Step 4: Done
  if (step === 'done' && result) {
    return (
      <div className="card p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Import Complete</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-green-600">
              {result.imported_count}
            </p>
            <p className="text-sm text-green-700">Imported</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-red-600">{result.error_count}</p>
            <p className="text-sm text-red-700">Errors</p>
          </div>
        </div>

        {result.errors?.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">Errors (first 20)</h4>
            <div className="bg-red-50 rounded-lg p-3 text-sm max-h-40 overflow-y-auto">
              {result.errors.map((err, i) => (
                <p key={i} className="text-red-700">
                  Row {err.row}: {err.error}
                </p>
              ))}
            </div>
          </div>
        )}

        {result.imported?.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-2">
              Sample Classifications
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.imported.slice(0, 5).map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex flex-wrap gap-2">
                    {item.classification?.sentiment && (
                      <span
                        className={`badge ${
                          item.classification.sentiment === 'positive'
                            ? 'badge-positive'
                            : item.classification.sentiment === 'negative'
                            ? 'badge-negative'
                            : 'badge-neutral'
                        }`}
                      >
                        {item.classification.sentiment}
                      </span>
                    )}
                    {item.classification?.topics?.map((t) => (
                      <span key={t} className="badge bg-gray-200 text-gray-700">
                        {t}
                      </span>
                    ))}
                  </div>
                  {item.classification?.summary && (
                    <p className="text-gray-600 mt-1 italic">
                      {item.classification.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={reset} className="btn btn-primary w-full">
          Import Another File
        </button>
      </div>
    )
  }

  return null
}
