import { useState, useEffect } from 'react'
import { FileText, TrendingUp, CheckCircle, Clock, IndianRupee, Download, Trash2, CheckSquare, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

function StatCard({ icon: Icon, label, value, sub, color = 'gold' }) {
  const colors = {
    gold: 'text-gold-500 bg-gold-400/10',
    green: 'text-green-500 bg-green-500/10',
    red: 'text-red-400 bg-red-400/10',
    ink: 'text-ink-500 bg-ink-100',
  }
  return (
    <div className="bg-white/80 border border-ink-200 rounded-xl p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-1">{label}</p>
      <p className="text-xl font-bold font-mono text-ink-800">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewInv, setPreviewInv] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [h, s] = await Promise.all([api.get('/invoice/history'), api.get('/invoice/stats')])
      setInvoices(h.data)
      setStats(s.data)
    } catch {
      toast.error('Failed to load invoice history')
    } finally {
      setLoading(false)
    }
  }

  const filtered = invoices.filter(i => filter === 'all' || i.status === filter)

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(i => i.id)))
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Single actions ──────────────────────────────────────────────────────────
  async function toggleStatus(inv) {
    const newStatus = inv.status === 'paid' ? 'unpaid' : 'paid'
    try {
      const { data } = await api.patch(`/invoice/${inv.id}/status`, { status: newStatus })
      setInvoices(prev => prev.map(i => i.id === inv.id ? data : i))
      setStats(prev => {
        const delta = inv.amount * (newStatus === 'paid' ? 1 : -1)
        return { ...prev, paid: prev.paid + delta, unpaid: prev.unpaid - delta }
      })
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function deleteSingle(inv) {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return
    try {
      await api.delete(`/invoice/${inv.id}`)
      setInvoices(prev => prev.filter(i => i.id !== inv.id))
      setSelected(prev => { const n = new Set(prev); n.delete(inv.id); return n })
      toast.success('Invoice deleted')
      loadData() // refresh stats
    } catch {
      toast.error('Failed to delete invoice')
    }
  }

  async function downloadPDF(inv) {
    try {
      const resp = await api.get(`/invoice/${inv.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF not available for this invoice')
    }
  }

  async function previewPDF(inv) {
    try {
      const resp = await api.get(`/invoice/${inv.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      setPreviewUrl(url)
      setPreviewInv(inv)
    } catch {
      toast.error('PDF not available for this invoice')
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewInv(null)
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────
  async function bulkSetStatus(status) {
    setBulkLoading(true)
    try {
      await api.patch('/invoice/bulk-status', { ids: [...selected], status })
      setInvoices(prev => prev.map(i => selected.has(i.id) ? { ...i, status } : i))
      setSelected(new Set())
      toast.success(`Marked ${selected.size} invoice(s) as ${status}`)
      loadData()
    } catch {
      toast.error('Bulk update failed')
    } finally {
      setBulkLoading(false)
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} invoice(s)? This cannot be undone.`)) return
    setBulkLoading(true)
    try {
      await api.post('/invoice/bulk-delete', { ids: [...selected] })
      setInvoices(prev => prev.filter(i => !selected.has(i.id)))
      setSelected(new Set())
      toast.success(`Deleted ${selected.size} invoice(s)`)
      loadData()
    } catch {
      toast.error('Bulk delete failed')
    } finally {
      setBulkLoading(false)
    }
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto px-6 py-10 flex justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* PDF Preview Modal */}
      {previewUrl && previewInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
              <div>
                <span className="font-semibold text-ink-800 text-sm">{previewInv.invoice_number}</span>
                <span className="text-ink-400 text-xs ml-2">· {previewInv.client_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadPDF(previewInv)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink-800 text-white hover:bg-ink-700 transition-colors">
                  <Download size={12} /> Download
                </button>
                <button onClick={closePreview}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe src={previewUrl} title="Invoice Preview" className="flex-1 rounded-b-2xl" />
          </div>
        </div>
      )}
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-2">Earnings</p>
        <h1 className="font-display text-3xl font-semibold text-ink-800">Invoice History</h1>
        <p className="text-ink-400 text-sm mt-1">All your generated invoices and earnings summary</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up delay-100">
          <StatCard icon={TrendingUp} label="Total Earned" value={fmt(stats.total)} sub={`${stats.count} invoice${stats.count !== 1 ? 's' : ''}`} color="gold" />
          <StatCard icon={CheckCircle} label="Paid" value={fmt(stats.paid)} color="green" />
          <StatCard icon={Clock} label="Unpaid" value={fmt(stats.unpaid)} color="red" />
          <StatCard icon={IndianRupee} label="Avg Invoice" value={fmt(stats.count ? stats.total / stats.count : 0)} color="ink" />
        </div>
      )}

      {/* Monthly chart */}
      {stats?.monthly?.length > 0 && (
        <div className="bg-white/80 border border-ink-200 rounded-xl p-6 mb-6 animate-fade-up delay-150">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Monthly Earnings</h2>
          <div className="flex items-end gap-2 h-24">
            {stats.monthly.map(m => {
              const max = Math.max(...stats.monthly.map(x => x.amount))
              const pct = max ? (m.amount / max) * 100 : 0
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-ink-400 font-mono">${(m.amount / 1000).toFixed(1)}k</span>
                  <div className="w-full rounded-t overflow-hidden" style={{ height: '72px' }}>
                    <div className="w-full bg-gold-400 rounded-t opacity-80 transition-all" style={{ height: `${Math.max(pct, 4)}%`, marginTop: `${100 - Math.max(pct, 4)}%` }} />
                  </div>
                  <span className="text-[9px] text-ink-400">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invoice table */}
      <div className="bg-white/80 border border-ink-200 rounded-xl overflow-hidden animate-fade-up delay-200">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink-700">Invoices</h2>
            {someSelected && (
              <span className="text-xs text-ink-400">{selected.size} selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex gap-1">
              {['all', 'paid', 'unpaid'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    filter === f ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-gold-400/10 border-b border-gold-400/20">
            <CheckSquare size={14} className="text-gold-500" />
            <span className="text-xs font-semibold text-ink-700 mr-2">{selected.size} selected</span>
            <button onClick={() => bulkSetStatus('paid')} disabled={bulkLoading}
              className="px-3 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
              Mark Paid
            </button>
            <button onClick={() => bulkSetStatus('unpaid')} disabled={bulkLoading}
              className="px-3 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50">
              Mark Unpaid
            </button>
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="px-3 py-1 rounded text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50">
              Delete
            </button>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-ink-400 hover:text-ink-600">
              Clear
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={32} className="text-ink-200 mx-auto mb-3" />
            <p className="text-ink-400 text-sm">No invoices yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-400 text-xs uppercase tracking-wider border-b border-ink-100">
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="accent-gold-400 w-3.5 h-3.5 cursor-pointer" />
                </th>
                <th className="px-3 py-3 font-semibold">Invoice #</th>
                <th className="px-3 py-3 font-semibold">Client</th>
                <th className="px-3 py-3 font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Issue Date</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => (
                <tr key={inv.id}
                  className={`border-b border-ink-50 transition-colors ${
                    selected.has(inv.id) ? 'bg-gold-400/5' : 'hover:bg-ink-50/50'
                  } ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-4 py-3.5">
                    <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)}
                      className="accent-gold-400 w-3.5 h-3.5 cursor-pointer" />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs text-ink-600">{inv.invoice_number}</td>
                  <td className="px-3 py-3.5 text-ink-800 font-medium">{inv.client_name || '—'}</td>
                  <td className="px-3 py-3.5 font-mono font-semibold text-ink-800">{fmt(inv.amount, inv.currency)}</td>
                  <td className="px-3 py-3.5 text-ink-500">{inv.issue_date || '—'}</td>
                  <td className="px-3 py-3.5">
                    <button onClick={() => toggleStatus(inv)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        inv.status === 'paid'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}>
                      {inv.status}
                    </button>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => previewPDF(inv)} title="Preview PDF"
                        className="p-1.5 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => downloadPDF(inv)} title="Download PDF"
                        className="p-1.5 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors">
                        <Download size={13} />
                      </button>
                      <button onClick={() => deleteSingle(inv)} title="Delete"
                        className="p-1.5 rounded text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
