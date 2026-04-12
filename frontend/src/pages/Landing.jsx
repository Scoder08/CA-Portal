import { useNavigate } from 'react-router-dom'
import { FileText, Calculator, Bot, ArrowRight, CheckCircle } from 'lucide-react'

const FEATURES = [
  {
    icon: FileText,
    title: 'Invoice Generation',
    desc: 'Upload your Deel statement. Get a tax-ready invoice in seconds.',
  },
  {
    icon: Calculator,
    title: 'Tax Calculator',
    desc: 'New vs old regime. Section 44ADA. Live forex. Slab breakdown.',
  },
  {
    icon: Bot,
    title: 'CA AI Agent',
    desc: 'Ask anything — GST, DTAA, advance tax. Powered by your own data.',
  },
]

const PILLS = ['Section 44ADA', 'GST Filing', 'DTAA Relief', 'Advance Tax', 'ITR-4']

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ink-900 text-ink-50 flex flex-col overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-gold-400 flex items-center justify-center">
            <span className="text-ink-900 font-display font-bold text-sm">S</span>
          </div>
          <span className="font-display font-semibold text-base tracking-tight text-ink-50">
            CA Portal
          </span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-ink-300 hover:text-ink-50 transition-colors font-medium"
        >
          Sign in →
        </button>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center relative">

        {/* Glow blob behind hero */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(201,154,46,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Badge */}
        <div className="animate-fade-up flex items-center gap-2 border border-gold-500/30 bg-gold-400/10 text-gold-400 rounded-full px-3 py-1 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
          Built for Indian freelancers &amp; consultants
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up delay-100 font-display text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-ink-50 max-w-2xl mb-4">
          Your CA practice,{' '}
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #e8b84b, #c99a2e)' }}
          >
            automated.
          </span>
        </h1>

        {/* Subline */}
        <p className="animate-fade-up delay-200 text-ink-400 text-lg max-w-md mb-8 leading-relaxed">
          Invoice generation, tax estimates, GST guidance — all in one place.
          No CA degree required.
        </p>

        {/* CTA */}
        <div className="animate-fade-up delay-300 flex items-center gap-3 mb-12">
          <button
            onClick={() => navigate('/login')}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Get started free <ArrowRight size={15} />
          </button>
        </div>

        {/* Keyword pills */}
        <div className="animate-fade-up delay-300 flex flex-wrap gap-2 justify-center mb-16">
          {PILLS.map(p => (
            <span
              key={p}
              className="flex items-center gap-1.5 border border-ink-700 text-ink-400 rounded-full px-3 py-1 text-xs"
            >
              <CheckCircle size={10} className="text-gold-500" />
              {p}
            </span>
          ))}
        </div>

        {/* ── Feature cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-16">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="animate-fade-up text-left border border-ink-700/60 bg-ink-800/50 rounded-2xl p-5 hover:border-gold-500/40 hover:bg-ink-800 transition-all duration-200"
              style={{ animationDelay: `${0.35 + i * 0.08}s` }}
            >
              <div className="w-9 h-9 rounded-xl bg-gold-400/15 flex items-center justify-center mb-4">
                <Icon size={17} className="text-gold-400" />
              </div>
              <p className="font-semibold text-ink-100 text-sm mb-1">{title}</p>
              <p className="text-ink-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="text-center pb-6 text-xs text-ink-600">
        Private portal · Invite only
      </footer>
    </div>
  )
}
