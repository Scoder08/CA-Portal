import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function Login() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { password })
      localStorage.setItem('ca_token', data.token)
      toast.success('Welcome back')
      navigate('/')
    } catch {
      toast.error('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-ink-800 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-gold-400 font-display font-bold text-2xl">S</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 mb-1">CA Portal</h1>
          <p className="text-ink-400 text-sm">Invoice & Document Management</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur border border-ink-200 rounded-xl p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-6">
            Enter Password
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Portal password"
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-300 mt-6">
          Shresth Saxena · SOFTEX Invoice Portal
        </p>
      </div>
    </div>
  )
}
