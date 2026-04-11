import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'register') {
      if (!form.name.trim()) return toast.error('Name is required')
      if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
      if (form.password !== form.confirm) return toast.error('Passwords do not match')
    }

    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password }

      const { data } = await api.post(endpoint, payload)
      localStorage.setItem('ca_token', data.token)
      localStorage.setItem('ca_user', JSON.stringify({ name: data.name, email: data.email }))
      toast.success(mode === 'login' ? `Welcome back, ${data.name}!` : `Account created! Welcome, ${data.name}!`)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || (mode === 'login' ? 'Invalid credentials' : 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m)
    setForm({ name: '', email: '', password: '', confirm: '' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-ink-800 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-gold-400 font-display font-bold text-2xl">S</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-800 mb-1">CA Portal</h1>
          <p className="text-ink-400 text-sm">Invoice & Document Management</p>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-ink-100 rounded-lg p-1 mb-6">
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-all capitalize ${
                mode === m ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur border border-ink-200 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">

            {mode === 'register' && (
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Full name"
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="Email address"
                autoFocus={mode === 'login'}
                className="w-full pl-9 pr-4 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
              />
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type={show ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Password"
                className="w-full pl-9 pr-10 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  type={show ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={set('confirm')}
                  placeholder="Confirm password"
                  className="w-full pl-9 pr-4 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed !mt-5"
            >
              {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-300 mt-6">
          SOFTEX Invoice Portal
        </p>
      </div>
    </div>
  )
}
