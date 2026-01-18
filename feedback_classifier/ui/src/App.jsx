import { useState } from 'react'
import Sidebar from './components/Sidebar'
import JobTracker from './components/JobTracker'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import Ask from './pages/Ask'
import Alerts from './pages/Alerts'
import Ingest from './pages/Ingest'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'search':
        return <Search />
      case 'ask':
        return <Ask />
      case 'alerts':
        return <Alerts />
      case 'ingest':
        return <Ingest />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
      <JobTracker />
    </div>
  )
}
