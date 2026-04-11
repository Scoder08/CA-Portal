import { useState, useEffect, useRef } from 'react'
import { Save, Upload, Trash2, User, Building2, CreditCard, FileText, Image, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white/80 border border-ink-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-ink-100">
        <div className="w-7 h-7 rounded-lg bg-ink-100 flex items-center justify-center">
          <Icon size={14} className="text-gold-500" />
        </div>
        <h2 className="font-semibold text-ink-800 text-sm uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', placeholder = '', hint = '' }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition resize-none"
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition font-mono"
        />
      )}
      {hint && <p className="text-[11px] text-ink-300 mt-1">{hint}</p>}
    </div>
  )
}

function ImageUploader({ label, settingKey, currentBase64, onUpdate }) {
  const inputRef = useRef()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', settingKey)
    try {
      await api.post('/admin/settings/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(`${label} uploaded`)
      onUpdate()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleClear() {
    try {
      await api.put('/admin/settings', { [`${settingKey}_base64`]: '' })
      toast.success(`${label} removed`)
      onUpdate()
    } catch {
      toast.error('Failed to clear')
    }
  }

  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-2">{label}</label>
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-28 h-20 rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 flex items-center justify-center overflow-hidden shrink-0">
          {currentBase64
            ? <img src={`data:image/png;base64,${currentBase64}`} alt={label} className="max-w-full max-h-full object-contain p-1" />
            : <Image size={18} className="text-ink-300" />
          }
        </div>
        {/* Controls */}
        <div className="space-y-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-ink-200 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors disabled:opacity-50"
          >
            <Upload size={12} />
            {uploading ? 'Uploading…' : `Upload ${label}`}
          </button>
          {currentBase64 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
          <p className="text-[10px] text-ink-300">PNG, JPG · Transparent PNG recommended</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function AdminPanel() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function loadSettings() {
    try {
      const { data } = await api.get('/admin/settings')
      setSettings(data)
      setDirty(false)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    // Don't send base64 blobs via this route (use image uploader)
    const payload = Object.fromEntries(
      Object.entries(settings).filter(([k]) => !k.endsWith('_base64'))
    )
    try {
      await api.put('/admin/settings', payload)
      toast.success('Settings saved')
      setDirty(false)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefaults() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return
    try {
      await api.post('/admin/settings/reset')
      toast.success('Settings reset to defaults')
      loadSettings()
    } catch {
      toast.error('Reset failed')
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-2">Configuration</p>
          <h1 className="font-display text-3xl font-semibold text-ink-800">Invoice Settings</h1>
          <p className="text-ink-400 text-sm mt-1">These details appear on every generated invoice</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-ink-200 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
          >
            <RefreshCw size={12} /> Reset
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="space-y-4 animate-fade-up delay-100">

        {/* Seller Identity */}
        <Section icon={User} title="Your Details (Bill From)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" name="seller_name" value={settings.seller_name} onChange={update} placeholder="Shresth Saxena" />
            <Field label="Email" name="seller_email" value={settings.seller_email} onChange={update} type="email" placeholder="you@email.com" />
            <Field label="Address Line" name="seller_address" value={settings.seller_address} onChange={update} placeholder="A-109, Kurmanchal Nagar" />
            <Field label="City, State, PIN" name="seller_city" value={settings.seller_city} onChange={update} placeholder="Bareilly, UP 243122" />
            <Field label="Country" name="seller_country" value={settings.seller_country} onChange={update} placeholder="India" />
            <Field label="Phone" name="seller_phone" value={settings.seller_phone} onChange={update} placeholder="+91 xxxxxxxx" />
          </div>
        </Section>

        {/* Tax IDs */}
        <Section icon={Building2} title="Tax Identifiers">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="GSTIN"
              name="seller_gstin"
              value={settings.seller_gstin}
              onChange={update}
              placeholder="09LZPPS4243G1ZL"
              hint="Appears prominently on the invoice as a highlighted badge"
            />
            <Field
              label="PAN"
              name="seller_pan"
              value={settings.seller_pan}
              onChange={update}
              placeholder="ABCDE1234F"
              hint="Optional — shown below GSTIN badge"
            />
          </div>
        </Section>

        {/* Bank Details */}
        <Section icon={CreditCard} title="Bank & Payment Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name" name="bank_name" value={settings.bank_name} onChange={update} placeholder="HDFC Bank" />
            <Field label="Account Number" name="bank_account_number" value={settings.bank_account_number} onChange={update} placeholder="XXXXXXXXXXXX" />
            <Field label="IFSC Code" name="bank_ifsc" value={settings.bank_ifsc} onChange={update} placeholder="HDFC0001234" />
            <Field label="SWIFT Code" name="bank_swift" value={settings.bank_swift} onChange={update} placeholder="HDFCINBB" hint="Required for international wire transfers" />
          </div>
        </Section>

        {/* Invoice Config */}
        <Section icon={FileText} title="Invoice Configuration">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Invoice Number Prefix"
              name="invoice_prefix"
              value={settings.invoice_prefix}
              onChange={update}
              placeholder="INV"
              hint="e.g. INV → generates INV-2026-1"
            />
            <Field
              label="Default Currency"
              name="currency"
              value={settings.currency}
              onChange={update}
              placeholder="USD"
            />
            <Field
              label="Footer Notes"
              name="invoice_notes"
              value={settings.invoice_notes}
              onChange={update}
              type="textarea"
              placeholder="Payment due within 15 days…"
              hint="Appears at the bottom of every invoice"
              className="col-span-2"
            />
          </div>
        </Section>

        {/* Branding */}
        <Section icon={Image} title="Branding">
          <div className="grid grid-cols-2 gap-8">
            <ImageUploader
              label="logo"
              settingKey="logo"
              currentBase64={settings.logo_base64}
              onUpdate={loadSettings}
            />
            <ImageUploader
              label="signature"
              settingKey="signature"
              currentBase64={settings.signature_base64}
              onUpdate={loadSettings}
            />
          </div>
          <p className="text-xs text-ink-300 mt-4 bg-ink-50 rounded-lg px-4 py-3 border border-ink-100">
            💡 If no logo is uploaded, your name will appear as text in the invoice header. Signature appears above the "Authorized Signatory" line.
          </p>
        </Section>

        {/* Sticky save */}
        {dirty && (
          <div className="sticky bottom-6 flex justify-center animate-fade-up">
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold shadow-xl disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
