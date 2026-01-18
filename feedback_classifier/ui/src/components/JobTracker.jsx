import { useState, useEffect, useRef } from 'react'
import { Upload, X, StopCircle, CheckCircle, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'

const API_BASE = '/api'

export default function JobTracker() {
  const [jobs, setJobs] = useState([])
  const [minimized, setMinimized] = useState(false)
  const pollIntervalRef = useRef(null)

  // Poll for active jobs
  useEffect(() => {
    const checkJobs = async () => {
      try {
        // Get jobs from localStorage
        const storedJobs = JSON.parse(localStorage.getItem('activeJobs') || '[]')
        if (storedJobs.length === 0) {
          setJobs([])
          return
        }

        // Check status of each job
        const updatedJobs = await Promise.all(
          storedJobs.map(async (jobId) => {
            try {
              const response = await fetch(`${API_BASE}/csv/import/${jobId}/status`)
              if (response.ok) {
                const data = await response.json()
                return { id: jobId, ...data }
              }
              return null
            } catch {
              return null
            }
          })
        )

        // Filter out null jobs and completed ones (after showing for a bit)
        const activeJobs = updatedJobs.filter(
          (job) => job && !['completed', 'failed', 'cancelled'].includes(job.status)
        )
        const completedJobs = updatedJobs.filter(
          (job) => job && ['completed', 'failed', 'cancelled'].includes(job.status)
        )

        // Update localStorage with only active jobs
        localStorage.setItem('activeJobs', JSON.stringify(activeJobs.map((j) => j.id)))

        // Show completed jobs briefly
        setJobs([...activeJobs, ...completedJobs])

        // Remove completed jobs from display after 5 seconds
        if (completedJobs.length > 0) {
          setTimeout(() => {
            setJobs((prev) =>
              prev.filter((j) => !['completed', 'failed', 'cancelled'].includes(j.status))
            )
          }, 5000)
        }
      } catch (error) {
        console.error('Error checking jobs:', error)
      }
    }

    checkJobs()
    pollIntervalRef.current = setInterval(checkJobs, 2000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const handleCancel = async (jobId) => {
    try {
      await fetch(`${API_BASE}/csv/import/${jobId}/cancel`, { method: 'POST' })
    } catch (error) {
      console.error('Error cancelling job:', error)
    }
  }

  const handleDismiss = (jobId) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
    const storedJobs = JSON.parse(localStorage.getItem('activeJobs') || '[]')
    localStorage.setItem(
      'activeJobs',
      JSON.stringify(storedJobs.filter((id) => id !== jobId))
    )
  }

  // Don't render if no jobs
  if (jobs.length === 0) return null

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />
      case 'failed':
      case 'cancelled':
        return <AlertCircle size={16} className="text-red-500" />
      default:
        return <Upload size={16} className="text-indigo-500 animate-pulse" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
      case 'cancelled':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-white border-gray-200'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Header */}
      <div
        className="bg-gray-900 text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <Upload size={16} />
          <span className="font-medium">
            {jobs.length} Import{jobs.length !== 1 ? 's' : ''}
          </span>
        </div>
        {minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {/* Job List */}
      {!minimized && (
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg shadow-lg max-h-64 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`p-3 border-b last:border-b-0 ${getStatusColor(job.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(job.status)}
                  <span className="text-sm font-medium capitalize">
                    {job.status === 'running' ? 'Importing...' : job.status}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {job.status === 'running' && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Cancel import"
                    >
                      <StopCircle size={16} />
                    </button>
                  )}
                  {['completed', 'failed', 'cancelled'].includes(job.status) && (
                    <button
                      onClick={() => handleDismiss(job.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Dismiss"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress */}
              {job.progress && (
                <>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>
                      {job.progress.current || 0} / {job.progress.total || 0}
                    </span>
                    <span>{(job.progress.percentage || 0).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        job.status === 'completed'
                          ? 'bg-green-500'
                          : job.status === 'failed' || job.status === 'cancelled'
                          ? 'bg-red-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${job.progress.percentage || 0}%` }}
                    />
                  </div>
                  {job.progress.message && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{job.progress.message}</p>
                  )}
                </>
              )}

              {/* Result summary */}
              {job.result && job.status === 'completed' && (
                <p className="text-xs text-green-700 mt-1">
                  Imported {job.result.imported_count} items
                  {job.result.error_count > 0 && ` (${job.result.error_count} errors)`}
                </p>
              )}

              {/* Error message */}
              {job.error && (
                <p className="text-xs text-red-600 mt-1 truncate">{job.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function to register a new job (call this when starting an import)
export function registerJob(jobId) {
  const storedJobs = JSON.parse(localStorage.getItem('activeJobs') || '[]')
  if (!storedJobs.includes(jobId)) {
    storedJobs.push(jobId)
    localStorage.setItem('activeJobs', JSON.stringify(storedJobs))
  }
}
