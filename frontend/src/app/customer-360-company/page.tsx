'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Company {
  id?: string
  name: string
  primary_contact?: string
  email?: string
  phone?: string
  latest_interaction_notes?: string
}

interface ProductStat { product: string; total_quantity: number; outstanding_quantity: number }

export default function Customer360CompanyPage() {
  const [company, setCompany] = useState<Company>({ name: '' })
  const [companies, setCompanies] = useState<Company[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [companySearch, setCompanySearch] = useState('')

  // computed stats
  const [totalContracts, setTotalContracts] = useState(0)
  const [activeContracts, setActiveContracts] = useState(0)
  const [byProduct, setByProduct] = useState<ProductStat[]>([])
  const [capacity, setCapacity] = useState<{[k:string]: number}>({})
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState<{id:string; note:string; created_at:string; user_full_name?: string}[]>([])
  // View-only modal; no add here

  const isEmailValid = useMemo(() => {
    if (!company.email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)
  }, [company.email])

  const isPhoneValid = useMemo(() => {
    if (!company.phone) return true
    return /^\+?[0-9]+$/.test(company.phone)
  }, [company.phone])

  const loadCompanies = async () => {
    try {
      const res = await api.get('/companies')
      setCompanies(res.data.data || [])
    } catch {}
  }

  const loadStats = async (name: string) => {
    if (!name) return
    try {
      const res = await api.get(`/companies/stats?name=${encodeURIComponent(name)}`)
      if (res.data.success) {
        const d = res.data.data
        setTotalContracts(d.totalContracts || 0)
        setActiveContracts(d.totalActiveContracts || 0)
        setByProduct(d.byProduct || [])
        setCapacity(d.capacity || {})
      }
    } catch {}
  }

  const loadNotes = async (companyId?: string) => {
    try {
      if (!companyId) { setNotes([]); return }
      const res = await api.get(`/companies/${companyId}/notes`)
      setNotes(res.data.data || [])
    } catch { setNotes([]) }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    loadStats(company.name)
    loadNotes(company.id)
  }, [company.id])

  const openNotes = async () => {
    await loadNotes(company.id)
    setNotesOpen(true)
  }

  const save = async () => {
    setError('')
    setSuccess('')
    if (!isEmailValid) { setError('Invalid email'); return }
    if (!isPhoneValid) { setError('Phone must contain only + and digits'); return }
    try {
      setSaving(true)
      // If id is missing but there is an existing company with same name, update instead
      let targetId = company.id
      if (!targetId && company.name) {
        const existing = companies.find((c) => c.name === company.name)
        if (existing) targetId = existing.id
      }

      if (targetId) {
        const res = await api.put(`/companies/${targetId}`, company)
        setCompany(res.data.data)
        setSuccess('Company updated')
        if (company.latest_interaction_notes && company.latest_interaction_notes.trim()) {
          try { await api.post(`/companies/${res.data.data.id}/notes`, { note: company.latest_interaction_notes }) } catch {}
        }
      } else {
        const res = await api.post('/companies', company)
        setCompany(res.data.data)
        setSuccess('Company created')
        if (company.latest_interaction_notes && company.latest_interaction_notes.trim()) {
          try { await api.post(`/companies/${res.data.data.id}/notes`, { note: company.latest_interaction_notes }) } catch {}
        }
      }
      await loadCompanies()
      setIsEditing(false)
    } catch (e:any) {
      setError(e?.response?.data?.error?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Customer 360</h1>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search parent company..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="h-10 w-64"
            />
            <select
              className="h-10 border rounded px-3"
              value={company.id || ''}
              onChange={(e) => {
                const sel = companies.find((x) => x.id === e.target.value)
                if (sel) setCompany({ ...sel })
                else setCompany({ name: '' })
                setIsEditing(false)
              }}
            >
              <option value="">Select Parent Company</option>
              {companies.filter(c => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())).map((c) => (
                <option key={c.id} value={c.id as string}>{c.name}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => { setCompany({ name: '' }); setIsEditing(true) }}>New</Button>
            <Button variant="outline" disabled={!company.id} onClick={() => setIsEditing(true)}>Update</Button>
            <Button variant="outline" disabled={!isEditing} onClick={() => { setIsEditing(false); const sel = companies.find(x => x.id === company.id); if (sel) setCompany({ ...sel }) }}>Cancel</Button>
            <Button variant="outline" onClick={() => {
              // download template CSV
              const headers = ['Parent Company Name','Primary Contact','Email','Phone','Latest Interaction Notes']
              const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'Companies_Import_Template.csv'
              document.body.appendChild(a); a.click(); document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}>Download Template</Button>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  const form = new FormData()
                  form.append('file', f)
                  const res = await api.post('/companies/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }})
                  const d = res.data.data
                  alert(`Upload completed. Created: ${d.created}, Updated: ${d.updated}, Failed: ${d.failed}${d.errors?.length ? '\n\nErrors:\n' + d.errors.join('\n') : ''}`)
                  await loadCompanies()
                } catch (err:any) {
                  alert(err?.response?.data?.error?.message || 'Upload failed')
                } finally {
                  e.currentTarget.value = ''
                }
              }} />
              <Button variant="outline">Upload</Button>
            </label>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Parent Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Parent Company Name</Label>
                <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} disabled={!isEditing} />
              </div>
              <div>
                <Label>Primary Contact</Label>
                <Input value={company.primary_contact || ''} onChange={(e) => setCompany({ ...company, primary_contact: e.target.value })} disabled={!isEditing} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={company.email || ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={!isEmailValid ? 'border-red-500' : ''} disabled={!isEditing} />
                {!isEmailValid && <div className="text-xs text-red-600 mt-1">Invalid email format</div>}
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={company.phone || ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={!isPhoneValid ? 'border-red-500' : ''} disabled={!isEditing} />
                {!isPhoneValid && <div className="text-xs text-red-600 mt-1">Only + and digits are allowed</div>}
              </div>
              <div className="md:col-span-2">
                <Label className="cursor-pointer" onClick={openNotes}>Latest Interaction Notes</Label>
                <textarea
                  maxLength={5096}
                  className="w-full h-32 border rounded px-3 py-2"
                  value={company.latest_interaction_notes || ''}
                  onChange={(e) => setCompany({ ...company, latest_interaction_notes: e.target.value })}
                  disabled={!isEditing}
                />
                {isEditing && company.id && (
                  <div className="flex justify-end mt-2">
                    <Button variant="outline" onClick={async () => {
                      if (!company.latest_interaction_notes?.trim()) return
                      await api.post(`/companies/${company.id}/notes`, { note: company.latest_interaction_notes })
                      await loadNotes(company.id)
                      setNotesOpen(true)
                    }}>Add to Notes</Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <div className="flex gap-2">
                 <Button variant="outline" onClick={openNotes} disabled={!company.id}>View Notes</Button>
                <Button onClick={save} disabled={saving || !isEditing}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contracts Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-gray-500">Total Contracts</div>
                  <div className="text-xl font-semibold">{totalContracts}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-gray-500">Total Active Contracts</div>
                  <div className="text-xl font-semibold">{activeContracts}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capacity vs Quantity (Per Product)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Capacity / Year</th>
                    <th className="px-3 py-2 text-right">Total Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {['CPO','PK','POME','SHELL'].map(p => {
                    const q = byProduct.find(b => (b.product || '').toUpperCase() === p)
                    return (
                      <tr key={p}>
                        <td className="px-3 py-2">{p}</td>
                        <td className="px-3 py-2 text-right">{Number(capacity[p] || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-right">{Number(q?.total_quantity || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quantities by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Total Quantity</th>
                  <th className="px-3 py-2 text-right">Outstanding Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byProduct.map((row) => (
                  <tr key={row.product}>
                    <td className="px-3 py-2">{row.product}</td>
                    <td className="px-3 py-2 text-right">{Number(row.total_quantity || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right">{Number(row.outstanding_quantity || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      {/* Notes Modal */}
      {notesOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Interaction Notes — {company.name}</h2>
              <Button variant="outline" onClick={() => setNotesOpen(false)}>Close</Button>
            </div>
            <div className="space-y-3">
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {notes.map(n => (
                      <tr key={n.id}>
                        <td className="px-3 py-2">{new Date(n.created_at).toLocaleString()}{n.user_full_name ? ` • ${n.user_full_name}` : ''}</td>
                        <td className="px-3 py-2">{n.note}</td>
                      </tr>
                    ))}
                    {notes.length === 0 && (
                      <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={2}>No notes yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}


