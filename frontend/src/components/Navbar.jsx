import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Settings, LogOut } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('ca_token')
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="border-b border-ink-200 bg-white/70 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-ink-800 flex items-center justify-center">
            <span className="text-gold-400 font-display font-bold text-sm">S</span>
          </div>
          <span className="font-display text-ink-800 font-semibold text-base tracking-tight">
            CA Portal
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isActive('/')
                ? 'bg-ink-100 text-ink-800'
                : 'text-ink-500 hover:text-ink-800 hover:bg-ink-50'
            }`}
          >
            <FileText size={14} />
            Invoices
          </Link>
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isActive('/admin')
                ? 'bg-ink-100 text-ink-800'
                : 'text-ink-500 hover:text-ink-800 hover:bg-ink-50'
            }`}
          >
            <Settings size={14} />
            Settings
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-ink-400 hover:text-ink-800 hover:bg-ink-50 transition-colors ml-2"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
