import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Download, RefreshCw, CheckCircle, ChevronDown, ChevronUp, Edit3, Eye, Settings } from 'lucide-react'

import toast from 'react-hot-toast'
import api from '../lib/api'

// ── Editable field component ──────────────────────────────────────────────────
function EditableField({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={`group ${className}`}>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-white border border-ink-200 rounded text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400 transition font-mono"
      />
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Step({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 text-sm transition-colors ${done ? 'text-gold-500' : active ? 'text-ink-800' : 'text-ink-300'
      }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${done
        ? 'bg-gold-400 border-gold-400 text-ink-900'
        : active
          ? 'border-ink-800 text-ink-800'
          : 'border-ink-200 text-ink-300'
        }`}>
        {done ? '✓' : number}
      </div>
      <span className="font-medium">{label}</span>
    </div>
  )
}

export default function InvoiceGenerator() {

  const [step, setStep] = useState(1) // 1=upload 2=review 3=preview 4=done
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfFileName, setPdfFileName] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [fileName, setFileName] = useState('')

  // ── Upload & parse ──────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file')
      return
    }

    setFileName(file.name)
    setUploading(true)
    setParsedData(null)
    setStep(1)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await api.post('/invoice/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setParsedData(data.data)
      setStep(2)
      toast.success('Invoice parsed successfully')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to parse invoice')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  })

  // ── Field updates ───────────────────────────────────────────────────────────
  function updateField(path, value) {
    setParsedData(prev => {
      const next = { ...prev }
      const keys = path.split('.')
      let obj = next
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] }
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      return next
    })
  }

  function updateLineItem(index, field, value) {
    setParsedData(prev => {
      const items = [...prev.line_items]
      items[index] = { ...items[index], [field]: value }
      // Recalculate amount
      if (field === 'rate' || field === 'quantity') {
        items[index].amount = (parseFloat(items[index].rate) || 0) * (parseFloat(items[index].quantity) || 0)
      }
      // Recalculate totals
      const subtotal = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
      const tax_amount = subtotal * ((prev.tax_rate || 0) / 100)
      return { ...prev, line_items: items, subtotal, tax_amount, total: subtotal + tax_amount }
    })
  }

  // ── Generate PDF (preview) ──────────────────────────────────────────────────
  async function generatePDF() {
    setGenerating(true)
    try {
      const response = await api.post('/invoice/generate', parsedData, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      const url = URL.createObjectURL(blob)
      const name = `invoice-${parsedData.invoice_number || 'generated'}.pdf`
      setPdfUrl(url)
      setPdfFileName(name)
      setStep(3)
      toast.success('Preview ready!')
    } catch {
      toast.error('Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  function downloadPDF() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = pdfFileName
    a.click()
    setStep(4)
    toast.success('Invoice downloaded!')
  }

  function reset() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setPdfFileName('')
    setParsedData(null)
    setStep(1)
    setFileName('')
    setShowRaw(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-8 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-2">STPI SOFTEX</p>
        <h1 className="font-display text-3xl font-semibold text-ink-800">Invoice Generator</h1>
        <p className="text-ink-400 text-sm mt-1">Upload your Deel invoice to generate a GSTIN-compliant invoice</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-6 mb-8 animate-fade-up delay-100">
        <Step number={1} label="Upload Deel PDF" active={step === 1} done={step > 1} />
        <div className="h-px flex-1 bg-ink-200" />
        <Step number={2} label="Review & Edit" active={step === 2} done={step > 2} />
        <div className="h-px flex-1 bg-ink-200" />
        <Step number={3} label="Preview" active={step === 3} done={step > 3} />
        <div className="h-px flex-1 bg-ink-200" />
        <Step number={4} label="Download" active={step === 4} done={step > 4} />
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="animate-fade-up delay-200">
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all ${isDragActive
              ? 'border-gold-400 bg-gold-300/10'
              : uploading
                ? 'border-ink-200 bg-ink-50/50 cursor-wait'
                : 'border-ink-200 hover:border-gold-400 hover:bg-gold-300/5'
              }`}
          >
            <input {...getInputProps()} />

            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
                <div>
                  <p className="font-semibold text-ink-700">Parsing with AI…</p>
                  <p className="text-sm text-ink-400 mt-1">Extracting invoice fields from {fileName}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center">
                  <Upload size={24} className="text-ink-400" />
                </div>
                <div>
                  <p className="font-semibold text-ink-700 text-lg">
                    {isDragActive ? 'Drop your Deel invoice here' : 'Drop your Deel invoice PDF'}
                  </p>
                  <p className="text-sm text-ink-400 mt-1">or <span className="text-gold-500 font-medium">click to browse</span></p>
                </div>
                <p className="text-xs text-ink-300 bg-ink-100 px-3 py-1.5 rounded-full">
                  PDF files only · Max 16MB
                </p>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="mt-4 p-4 bg-white/60 border border-ink-200 rounded-lg flex items-start gap-3">
            <FileText size={16} className="text-gold-500 mt-0.5 shrink-0" />
            <div className="text-sm text-ink-500">
              <span className="font-medium text-ink-700">How it works: </span>
              AI reads your Deel invoice and extracts all fields — dates, amounts, client details — then generates your GSTIN-compliant invoice ready for STPI SOFTEX filing.
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Review & Edit ── */}
      {step === 2 && parsedData && (
        <div className="animate-fade-up space-y-4">

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <CheckCircle size={14} className="text-green-500" />
              Parsed from <span className="font-mono text-xs bg-ink-100 px-2 py-0.5 rounded">{fileName}</span>
            </div>
            <button onClick={reset} className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1.5 transition-colors">
              <RefreshCw size={13} /> Upload different file
            </button>
          </div>

          {/* Invoice meta */}
          <div className="bg-white/80 border border-ink-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Edit3 size={14} className="text-gold-500" />
              <h2 className="font-semibold text-ink-800 text-sm uppercase tracking-wider">Invoice Details</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <EditableField label="Invoice Number" value={parsedData.invoice_number} onChange={v => updateField('invoice_number', v)} />
              <EditableField label="Issue Date" value={parsedData.issue_date} onChange={v => updateField('issue_date', v)} type="date" />
              <EditableField label="Due Date" value={parsedData.due_date} onChange={v => updateField('due_date', v)} type="date" />
              <EditableField label="Period Start" value={parsedData.period_start} onChange={v => updateField('period_start', v)} type="date" />
              <EditableField label="Period End" value={parsedData.period_end} onChange={v => updateField('period_end', v)} type="date" />
              <EditableField label="Currency" value={parsedData.currency} onChange={v => updateField('currency', v)} />
            </div>
          </div>

          {/* Bill To */}
          <div className="bg-white/80 border border-ink-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Edit3 size={14} className="text-gold-500" />
              <h2 className="font-semibold text-ink-800 text-sm uppercase tracking-wider">Bill To (Client)</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EditableField label="Company Name" value={parsedData.bill_to_name} onChange={v => updateField('bill_to_name', v)} />
              <EditableField label="Address" value={parsedData.bill_to_address} onChange={v => updateField('bill_to_address', v)} />
              <EditableField label="City / State / ZIP" value={parsedData.bill_to_city} onChange={v => updateField('bill_to_city', v)} />
              <EditableField label="Country" value={parsedData.bill_to_country} onChange={v => updateField('bill_to_country', v)} />
              <EditableField label="VAT ID" value={parsedData.bill_to_vat_id} onChange={v => updateField('bill_to_vat_id', v)} />
              <EditableField label="Team / Group" value={parsedData.bill_to_group} onChange={v => updateField('bill_to_group', v)} />
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white/80 border border-ink-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Edit3 size={14} className="text-gold-500" />
              <h2 className="font-semibold text-ink-800 text-sm uppercase tracking-wider">Line Items</h2>
            </div>

            {(parsedData.line_items || []).map((item, i) => (
              <div key={i} className="border border-ink-100 rounded-lg p-4 mb-3 bg-ink-50/50">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <EditableField
                    label="Description"
                    value={item.description}
                    onChange={v => updateLineItem(i, 'description', v)}
                    className="col-span-2"
                  />
                  <EditableField label="Contract Type" value={item.contract_type} onChange={v => updateLineItem(i, 'contract_type', v)} />
                  <EditableField label="HSN/SAC Code" value={item.hsn || '9983'} onChange={v => updateLineItem(i, 'hsn', v)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <EditableField label="Quantity" value={item.quantity} onChange={v => updateLineItem(i, 'quantity', parseFloat(v) || 1)} type="number" />
                  <EditableField label="Rate (USD)" value={item.rate} onChange={v => updateLineItem(i, 'rate', parseFloat(v) || 0)} type="number" />
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1">Total</label>
                    <div className="px-2.5 py-1.5 bg-ink-100 border border-ink-200 rounded text-sm font-mono font-semibold text-ink-700">
                      {(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Totals summary */}
            <div className="mt-4 flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{parsedData.currency} {(parsedData.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-ink-500">
                  <span>IGST ({parsedData.tax_rate || 0}%)</span>
                  <span className="font-mono">{parsedData.currency} {(parsedData.tax_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-ink-800 border-t border-ink-200 pt-2">
                  <span>Total Due</span>
                  <span className="font-mono">{parsedData.currency} {(parsedData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw JSON toggle */}
          <div className="bg-white/60 border border-ink-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm text-ink-500 hover:text-ink-800 transition-colors"
            >
              <span className="font-medium">Raw parsed data (for debugging)</span>
              {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showRaw && (
              <pre className="px-5 pb-5 text-xs font-mono text-ink-500 overflow-x-auto bg-ink-50">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            )}
          </div>

          {/* Generate button */}
          <div className="pt-2">
            <button
              onClick={generatePDF}
              disabled={generating}
              className="btn-primary w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-ink-900/30 border-t-ink-900 rounded-full animate-spin" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <Eye size={16} />
                  Preview Invoice PDF
                </>
              )}
            </button>
            <p className="text-center text-xs text-ink-300 mt-2">
              Your GSTIN and seller details are pulled from Settings
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && pdfUrl && (
        <div className="animate-fade-up space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Eye size={14} className="text-gold-500" />
              <span>Preview — looks good? Download or go back to edit.</span>
            </div>
            <button onClick={() => setStep(2)} className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1.5 transition-colors">
              <Edit3 size={13} /> Back to edit
            </button>
          </div>

          <iframe
            src={pdfUrl}
            title="Invoice Preview"
            className="w-full rounded-xl border border-ink-200 shadow-sm"
            style={{ height: '75vh' }}
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={downloadPDF}
              className="btn-primary flex-1 py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Download Invoice
            </button>
            <button
              onClick={() => window.open('/admin', '_blank')}
              className="px-5 py-3.5 rounded-xl font-medium border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors text-sm flex items-center gap-2"
            >
              <Settings size={15} />
              Update Settings
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 4 && (
        <div className="animate-fade-up text-center py-16">
          <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-800 mb-2">Invoice Downloaded!</h2>
          <p className="text-ink-400 text-sm mb-8">Your SOFTEX-ready invoice has been saved.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="btn-primary px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              <Upload size={15} />
              Generate Another
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 rounded-xl font-medium border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors text-sm flex items-center gap-2"
            >
              <Download size={14} />
              Re-download Same
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
