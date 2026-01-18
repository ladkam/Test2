import {
  LayoutDashboard,
  Search,
  MessageSquareText,
  AlertTriangle,
  Upload,
  Settings,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'ask', label: 'Ask AI', icon: MessageSquareText },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'ingest', label: 'Import', icon: Upload },
]

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">Feedback Classifier</h1>
        <p className="text-sm text-gray-400 mt-1">PM Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-4 py-2 text-gray-400 text-sm">
          <Settings size={16} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  )
}
