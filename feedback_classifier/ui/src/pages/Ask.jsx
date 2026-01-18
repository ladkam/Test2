import { useState } from 'react'
import { Send, Sparkles, MessageSquare, Lightbulb } from 'lucide-react'
import { LoadingOverlay } from '../components/Loading'
import { api } from '../hooks/useApi'

const exampleQuestions = [
  "What are the main complaints from enterprise users?",
  "Summarize feature requests from the last month",
  "What are users saying about pricing?",
  "Are there any urgent security concerns?",
  "What do promoters love about our product?",
  "What's frustrating users the most this week?",
]

export default function Ask() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const handleAsk = async (q = question) => {
    if (!q.trim()) return

    setLoading(true)
    setAnswer('')

    try {
      const response = await api.ask(q)
      setAnswer(response.answer || response)

      setHistory((prev) => [
        { question: q, answer: response.answer || response },
        ...prev.slice(0, 9),
      ])
    } catch (error) {
      console.error('Ask failed:', error)
      setAnswer('Sorry, there was an error processing your question. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const handleExampleClick = (example) => {
    setQuestion(example)
    handleAsk(example)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
          <Sparkles size={32} className="text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Ask AI</h1>
        <p className="text-gray-500 mt-1">
          Ask questions about your customer feedback in natural language
        </p>
      </div>

      {/* Example Questions */}
      {!answer && history.length === 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-yellow-500" />
            <span className="text-sm font-medium text-gray-600">
              Try asking:
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exampleQuestions.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-4 card hover:shadow-md transition-shadow text-gray-700 hover:text-indigo-600"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question Input */}
      <div className="card p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your feedback..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              rows={2}
            />
          </div>
          <button
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="btn btn-primary self-end disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Current Answer */}
      {answer && (
        <div className="card p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <MessageSquare size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-2">Answer:</p>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-800 whitespace-pre-wrap">{answer}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Previous Questions
          </h2>
          <div className="space-y-4">
            {history.slice(1).map((item, index) => (
              <div key={index} className="card p-4">
                <p className="font-medium text-gray-700 mb-2">
                  Q: {item.question}
                </p>
                <p className="text-gray-600 text-sm line-clamp-3">
                  A: {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingOverlay text="Analyzing feedback..." />}
    </div>
  )
}
