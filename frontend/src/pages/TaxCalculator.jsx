import { useState, useEffect } from 'react'
import { Calculator, RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

// ── Tax slab logic ─────────────────────────────────────────────────────────────

const NEW_SLABS = [
  { upto: 300000, rate: 0 },
  { upto: 700000, rate: 0.05 },
  { upto: 1000000, rate: 0.10 },
  { upto: 1200000, rate: 0.15 },
  { upto: 1500000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
]

const OLD_SLABS = [
  { upto: 250000, rate: 0 },
  { upto: 500000, rate: 0.05 },
  { upto: 1000000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
]

function calcTax(income, slabs) {
  let tax = 0
  let prev = 0
  const breakdown = []
  for (const { upto, rate } of slabs) {
    if (income <= prev) break
    const taxable = Math.min(income, upto) - prev
    const slab_tax = taxable * rate
    if (taxable > 0) breakdown.push({ from: prev, to: Math.min(income, upto), rate, taxable, tax: slab_tax })
    tax += slab_tax
    prev = upto
  }
  return { tax, breakdown }
}

function computeTax(grossInr, otherInr, regime, is44ADA) {
  // 44ADA applies only to professional income
  const professionalTaxable = is44ADA ? grossInr * 0.5 : grossInr
  // Other income is always 100% taxable
  const totalTaxable = professionalTaxable + otherInr

  const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS
  let { tax, breakdown } = calcTax(totalTaxable, slabs)

  const stdDeduction = regime === 'old' ? 50000 : 0

  // Rebate u/s 87A
  let rebate = 0
  if (regime === 'new' && totalTaxable <= 700000) rebate = Math.min(tax, 25000)
  if (regime === 'old' && totalTaxable <= 500000) rebate = Math.min(tax, 12500)

  const taxAfterRebate = Math.max(0, tax - rebate)
  const cess = taxAfterRebate * 0.04
  const totalTax = taxAfterRebate + cess

  return { professionalTaxable, otherInr, totalTaxable, breakdown, tax, rebate, cess, totalTax, stdDeduction }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (r) => `${(r * 100).toFixed(0)}%`

function ResultRow({ label, value, bold, highlight }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${bold ? 'font-bold text-ink-800 border-t border-ink-200 mt-1 pt-3' : 'text-ink-600'} ${highlight ? 'text-gold-600' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaxCalculator() {
  const [grossUSD, setGrossUSD] = useState('')
  const [forexRate, setForexRate] = useState('')
  const [loadingForex, setLoadingForex] = useState(false)
  const [is44ADA, setIs44ADA] = useState(true)
  const [otherSources, setOtherSources] = useState([])
  const [result, setResult] = useState(null)

  // Auto-fill from invoice stats
  useEffect(() => {
    api.get('/invoice/stats')
      .then(({ data }) => { if (data.total > 0) setGrossUSD(data.total.toFixed(2)) })
      .catch(() => {})
    fetchForex()
  }, [])

  async function fetchForex() {
    setLoadingForex(true)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await res.json()
      setForexRate(data.rates?.INR?.toFixed(2) || '')
    } catch {
      toast.error('Could not fetch live forex rate — enter manually')
    } finally {
      setLoadingForex(false)
    }
  }

  function addOtherSource() {
    setOtherSources(prev => [...prev, { id: Date.now(), label: '', amount: '' }])
  }

  function updateOtherSource(id, field, value) {
    setOtherSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeOtherSource(id) {
    setOtherSources(prev => prev.filter(s => s.id !== id))
  }

  function calculate() {
    const usd = parseFloat(grossUSD)
    const rate = parseFloat(forexRate)
    if (!usd || !rate) return toast.error('Enter gross income and forex rate')

    const grossInr = usd * rate
    const otherInr = otherSources.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
    const newResult = computeTax(grossInr, otherInr, 'new', is44ADA)
    const oldResult = computeTax(grossInr, otherInr, 'old', is44ADA)
    setResult({ grossInr, otherInr, newResult, oldResult })
  }

  const RegimeCard = ({ label, res, recommended }) => (
    <div className={`bg-white/80 border rounded-xl p-5 flex-1 ${recommended ? 'border-gold-400 shadow-sm' : 'border-ink-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ink-800 text-sm uppercase tracking-wider">{label}</h3>
        {recommended && <span className="text-[10px] bg-gold-400 text-ink-900 font-bold px-2 py-0.5 rounded-full">BETTER</span>}
      </div>
      <div className="space-y-0.5">
        <ResultRow label="Gross Income (Professional)" value={fmtINR(result.grossInr)} />
        {is44ADA && <ResultRow label="44ADA (50% taxable)" value={fmtINR(res.professionalTaxable)} highlight />}
        {!is44ADA && res.stdDeduction > 0 && <ResultRow label="Std. Deduction" value={`− ${fmtINR(res.stdDeduction)}`} />}
        {res.otherInr > 0 && <ResultRow label="Other Income" value={`+ ${fmtINR(res.otherInr)}`} />}
        {(is44ADA || res.otherInr > 0) && <ResultRow label="Total Taxable Income" value={fmtINR(res.totalTaxable)} bold />}
        <div className="border-t border-ink-100 my-2" />
        {res.breakdown.map((b, i) => (
          <div key={i} className="flex justify-between text-xs text-ink-400 py-0.5">
            <span>{fmtINR(b.from)} – {b.to === Infinity ? '∞' : fmtINR(b.to)} @ {fmtPct(b.rate)}</span>
            <span className="font-mono">{fmtINR(b.tax)}</span>
          </div>
        ))}
        <div className="border-t border-ink-100 my-2" />
        <ResultRow label="Tax Before Rebate" value={fmtINR(res.tax)} />
        {res.rebate > 0 && <ResultRow label="Rebate u/s 87A" value={`− ${fmtINR(res.rebate)}`} highlight />}
        <ResultRow label="Health & Edu Cess (4%)" value={fmtINR(res.cess)} />
        <ResultRow label="Total Tax Payable" value={fmtINR(res.totalTax)} bold />
        <div className="mt-3 p-2.5 bg-ink-50 rounded text-xs text-ink-500 text-center">
          Effective rate: {result.grossInr > 0 ? ((res.totalTax / result.grossInr) * 100).toFixed(1) : 0}%
        </div>
      </div>
    </div>
  )

  const betterRegime = result
    ? (result.newResult.totalTax <= result.oldResult.totalTax ? 'new' : 'old')
    : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-2">FY 2025-26</p>
        <h1 className="font-display text-3xl font-semibold text-ink-800">Tax Calculator</h1>
        <p className="text-ink-400 text-sm mt-1">Estimate your income tax — new vs old regime, with 44ADA support</p>
      </div>

      {/* Input card */}
      <div className="bg-white/80 border border-ink-200 rounded-xl p-6 mb-6 animate-fade-up delay-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Gross income */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1.5">
              Gross Income (USD)
            </label>
            <input
              type="number"
              value={grossUSD}
              onChange={e => setGrossUSD(e.target.value)}
              placeholder="e.g. 25200"
              className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
            />
            <p className="text-[10px] text-ink-400 mt-1">Auto-filled from your invoice history</p>
          </div>

          {/* Forex rate */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1.5">
              USD → INR Rate
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={forexRate}
                onChange={e => setForexRate(e.target.value)}
                placeholder="e.g. 84.50"
                className="flex-1 px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
              />
              <button
                onClick={fetchForex}
                disabled={loadingForex}
                title="Fetch live rate"
                className="px-2.5 border border-ink-200 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={loadingForex ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-[10px] text-ink-400 mt-1">Live rate from open.er-api.com</p>
          </div>

          {/* INR equivalent */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1.5">
              Gross Income (INR)
            </label>
            <div className="px-3 py-2 bg-ink-100 border border-ink-200 rounded-lg text-sm font-mono font-semibold text-ink-700">
              {grossUSD && forexRate
                ? fmtINR(parseFloat(grossUSD) * parseFloat(forexRate))
                : '—'}
            </div>
          </div>
        </div>

        {/* Other income sources */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
              Other Income Sources <span className="normal-case text-ink-300">(not eligible for 44ADA)</span>
            </label>
            <button onClick={addOtherSource}
              className="text-xs text-gold-500 hover:text-gold-600 font-semibold transition-colors">
              + Add Source
            </button>
          </div>
          {otherSources.length === 0 && (
            <p className="text-xs text-ink-300 italic">e.g. interest income, rent, salary, capital gains…</p>
          )}
          <div className="space-y-2">
            {otherSources.map(src => (
              <div key={src.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={src.label}
                  onChange={e => updateOtherSource(src.id, 'label', e.target.value)}
                  placeholder="Source (e.g. Interest income)"
                  className="flex-[2] px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
                />
                <input
                  type="number"
                  value={src.amount}
                  onChange={e => updateOtherSource(src.id, 'amount', e.target.value)}
                  placeholder="Amount (INR)"
                  className="flex-1 px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm font-mono text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition"
                />
                <button onClick={() => removeOtherSource(src.id)}
                  className="p-2 text-ink-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
              </div>
            ))}
          </div>
          {otherSources.length > 0 && (
            <div className="flex justify-end mt-2 text-xs text-ink-500">
              Total other income: <span className="font-mono font-semibold ml-1">
                {fmtINR(otherSources.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0))}
              </span>
            </div>
          )}
        </div>

        {/* 44ADA toggle */}
        <div className="flex items-start gap-3 p-4 bg-gold-400/5 border border-gold-400/30 rounded-lg mb-5">
          <input
            type="checkbox"
            id="44ada"
            checked={is44ADA}
            onChange={e => setIs44ADA(e.target.checked)}
            className="mt-0.5 accent-gold-400 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="44ada" className="cursor-pointer">
            <p className="text-sm font-semibold text-ink-800">Section 44ADA — Presumptive Taxation</p>
            <p className="text-xs text-ink-500 mt-0.5">
              For specified professionals (IT, CA, etc.) with gross receipts under ₹75L.
              Only <strong>50% of gross receipts</strong> is treated as taxable income — no need to maintain detailed books.
            </p>
          </label>
        </div>

        <button
          onClick={calculate}
          className="btn-primary w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Calculator size={16} />
          Calculate Tax
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <Info size={14} className="text-ink-400" />
            <p className="text-xs text-ink-400">
              Gross ₹{(result.grossInr / 100000).toFixed(2)}L
              {is44ADA && ` → 44ADA taxable ₹${(result.newResult.professionalTaxable / 100000).toFixed(2)}L`}
              {result.otherInr > 0 && ` + other income ₹${(result.otherInr / 100000).toFixed(2)}L`}
              {' '}· FY 2025-26 slabs · 4% cess included
            </p>
          </div>
          <div className="flex gap-4">
            <RegimeCard label="New Regime" res={result.newResult} recommended={betterRegime === 'new'} />
            <RegimeCard label="Old Regime" res={result.oldResult} recommended={betterRegime === 'old'} />
          </div>
          <p className="text-center text-xs text-ink-300 mt-4">
            This is an estimate. Consult a CA for accurate tax planning.
          </p>
        </div>
      )}
    </div>
  )
}
