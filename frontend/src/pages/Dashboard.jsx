import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, History, Calculator,
  TrendingUp, CheckCircle, Clock, ArrowRight,
  Zap,
} from 'lucide-react'
import api from '../lib/api'

const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency,
    maximumFractionDigits: 0,
  }).format(n)

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    gold:  { bg: 'bg-gold-400/10',   icon: 'text-gold-500'   },
    green: { bg: 'bg-green-500/10',  icon: 'text-green-500'  },
    amber: { bg: 'bg-amber-400/10',  icon: 'text-amber-400'  },
    ink:   { bg: 'bg-ink-100',       icon: 'text-ink-500'    },
  }
  const c = colors[color] || colors.gold
  return (
    <div className="bg-white/80 border border-ink-200 rounded-xl p-5 animate-fade-up">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.bg}`}>
        <Icon size={16} className={c.icon} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400 mb-1">{label}</p>
      <p className="text-xl font-bold font-mono text-ink-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Feature action card ───────────────────────────────────────────────────────
function ActionCard({ icon: Icon, title, desc, to, badge, delay }) {
  return (
    <Link
      to={to}
      className="group bg-white/80 border border-ink-200 rounded-xl p-5 flex flex-col gap-3 hover:border-gold-400/60 hover:shadow-md hover:shadow-gold-400/5 transition-all duration-200 animate-fade-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center group-hover:bg-gold-400 transition-colors duration-200">
          <Icon size={17} className="text-gold-400 group-hover:text-ink-900 transition-colors duration-200" />
        </div>
        {badge && (
          <span className="text-[10px] font-semibold bg-gold-400/15 text-gold-600 border border-gold-400/30 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold text-ink-800 text-sm mb-0.5">{title}</p>
        <p className="text-xs text-ink-400 leading-relaxed">{desc}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-ink-400 group-hover:text-gold-500 transition-colors mt-auto">
        Open <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const user = JSON.parse(localStorage.getItem('ca_user') || '{}')

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    api.get('/invoice/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const totalEarned  = stats?.total  ?? 0
  const paidAmount   = stats?.paid   ?? 0
  const unpaidAmount = stats?.unpaid ?? 0
  const invoiceCount = stats?.count  ?? 0

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-ink-800 leading-tight">
          {greeting}{user.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-ink-400 text-sm mt-1">Here's what's happening with your practice.</p>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={TrendingUp}
          label="Total Earned"
          value={fmt(totalEarned)}
          sub="all time"
          color="gold"
        />
        <StatCard
          icon={CheckCircle}
          label="Paid"
          value={fmt(paidAmount)}
          sub="collected"
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Outstanding"
          value={unpaidAmount > 0 ? fmt(unpaidAmount) : '—'}
          sub={unpaidAmount > 0 ? 'pending payment' : 'All clear'}
          color={unpaidAmount > 0 ? 'amber' : 'ink'}
        />
        <StatCard
          icon={FileText}
          label="Total Invoices"
          value={invoiceCount}
          sub="generated"
          color="ink"
        />
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">Quick actions</span>
        <div className="flex-1 h-px bg-ink-200" />
      </div>

      {/* ── Action cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <ActionCard
          icon={FileText}
          title="Generate Invoice"
          desc="Upload your Deel PDF and get a tax-ready invoice instantly."
          to="/invoices"
          delay="0.05s"
        />
        <ActionCard
          icon={History}
          title="Invoice History"
          desc="View, download, and manage all your past invoices."
          to="/history"
          delay="0.1s"
        />
        <ActionCard
          icon={Calculator}
          title="Tax Calculator"
          desc="Estimate your tax under new & old regime with live forex."
          to="/tax"
          delay="0.15s"
        />
      </div>

      {/* ── Tips strip ───────────────────────────────────────────────────── */}
      {unpaidAmount > 0 && (
        <div className="animate-fade-up delay-300 flex items-start gap-3 border border-amber-300/40 rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.06)' }}>
          <Zap size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink-800">
              {fmt(unpaidAmount)} is outstanding
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              Follow up with clients to keep your cash flow healthy.{' '}
              <Link to="/history" className="text-gold-600 hover:underline">View invoices →</Link>
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
