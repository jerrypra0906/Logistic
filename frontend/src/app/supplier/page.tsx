'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Layout from '@/components/Layout'

interface Supplier {
  id: string
  plant_code: string
  mills: string | null
  group_id: string | null
  parent_company: string | null
  group_holding: string | null
  controlling_shareholder: string | null
  other_shareholders: string | null
  group_type: string | null
  group_scale: string | null
  integrated_status: string | null
  cap: string | null
  cpo_prod_est_month?: number | null
  pk_prod_est_month?: number | null
  pome_prod_est_month?: number | null
  shell_prod_est_month?: number | null
  cpo_prod_est_year?: number | null
  pk_prod_est_year?: number | null
  pome_prod_est_year?: number | null
  shell_prod_est_year?: number | null
  city_regency: string | null
  province: string | null
  island: string | null
  longitude: number | null
  latitude: number | null
  kml_folder: string | null
  map: string | null
  rspo: string | null
  rspo_type: string | null
  ispo: string | null
  iscc: string | null
  year_commence: number | null
  updated_date: string | null
  remarks: string | null
}

const headersOrder = [
  'PLANT CODE','MILLS','GROUP ID','PARENT COMPANY','GROUP / HOLDING','Controlling Shareholder','Other Shareholders','GROUP TYPE','Group Scale','Integrated Status','CAP',
  'CITY / REGENCY','PROVINCE','ISLAND','Long.','Lat.','KML_FOLDER','MAP','RSPO','RSPO Type','ISPO','ISCC','Year Commence','Updated Date','Remarks'
]

export default function SupplierPage() {
  const router = useRouter()
  const [items, setItems] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [productConfigs, setProductConfigs] = useState<Record<string, any>>({})
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)

  const emptyForm = {
    plant_code: '', mills: '', group_id: '', parent_company: '', group_holding: '',
    controlling_shareholder: '', other_shareholders: '', group_type: '', group_scale: '', integrated_status: '', cap: '',
    cpo_prod_est_month: '', pk_prod_est_month: '', pome_prod_est_month: '', shell_prod_est_month: '',
    cpo_prod_est_year: '', pk_prod_est_year: '', pome_prod_est_year: '', shell_prod_est_year: '',
    city_regency: '', province: '', island: '',
    longitude: '', latitude: '', kml_folder: '', map: '', rspo: '', rspo_type: '', ispo: '', iscc: '', year_commence: '', updated_date: '', remarks: ''
  } as any
  const [form, setForm] = useState<any>(emptyForm)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const fetchProductConfigs = async () => {
    try {
      const res = await api.get('/products?limit=200')
      const map: Record<string, any> = {}
      for (const p of res.data.data.items || []) {
        const key = String(p.product_name || '').toUpperCase()
        if (['CPO','PK','POME','SHELL'].includes(key)) map[key] = p
      }
      setProductConfigs(map)
      console.log('Supplier productConfigs loaded', map)
    } catch {}
  }

  useEffect(() => {
    // Require login
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.push('/login')
      return
    }
    fetchData()
    fetchProductConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Recompute estimates in the form whenever CAP or configs change
  useEffect(() => {
    const capNum = Number(form.cap)
    if (!isFinite(capNum)) {
      // clear computed fields if CAP invalid
      setForm((f: any) => ({
        ...f,
        cpo_prod_est_month: '', pk_prod_est_month: '', pome_prod_est_month: '', shell_prod_est_month: '',
        cpo_prod_est_year: '', pk_prod_est_year: '', pome_prod_est_year: '', shell_prod_est_year: ''
      }))
      return
    }
    const calc = (prod: any, useYear = false) => {
      if (!prod) return ''
      const pct = prod.percent_produce == null ? null : Number(prod.percent_produce) / 100
      const hours = prod.working_hours_per_day == null ? null : Number(prod.working_hours_per_day)
      const days = useYear
        ? prod.working_days_per_year == null ? null : Number(prod.working_days_per_year)
        : prod.working_days_per_month == null ? null : Number(prod.working_days_per_month)
      if (pct == null || hours == null || days == null) return ''
      const v = capNum * pct * hours * days
      return isFinite(v) ? String(v) : ''
    }
    const computed = {
      cpo_prod_est_month: calc(productConfigs['CPO'], false),
      pk_prod_est_month: calc(productConfigs['PK'], false),
      pome_prod_est_month: calc(productConfigs['POME'], false),
      shell_prod_est_month: calc(productConfigs['SHELL'], false),
      cpo_prod_est_year: calc(productConfigs['CPO'], true),
      pk_prod_est_year: calc(productConfigs['PK'], true),
      pome_prod_est_year: calc(productConfigs['POME'], true),
      shell_prod_est_year: calc(productConfigs['SHELL'], true),
    }
    console.log('Supplier auto-calc', { capNum, computed })
    setForm((prev: any) => ({ ...prev, ...computed }))
  }, [form.cap, productConfigs])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('limit', String(limit))
      if (search) params.append('search', search)
      const res = await api.get(`/suppliers?${params.toString()}`)
      setItems(res.data.data.items)
      setTotal(res.data.data.total)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    fetchProductConfigs()
    setShowModal(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({ ...s, updated_date: s.updated_date ? s.updated_date.substring(0,10) : '' })
    setShowModal(true)
  }

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, form)
        setSuccess('Supplier updated')
      } else {
        await api.post('/suppliers', form)
        setSuccess('Supplier created')
      }
      setShowModal(false)
      fetchData()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Save failed')
    }
  }

  const removeSupplier = async (s: Supplier) => {
    if (!confirm(`Delete ${s.plant_code}?`)) return
    try {
      await api.delete(`/suppliers/${s.id}`)
      fetchData()
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || 'Delete failed')
    }
  }

  const handleUpload = async () => {
    setError('')
    setSuccess('')
    if (!file) {
      setError('Please choose a file')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/suppliers/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const r = res.data.data
      const details = r.errors?.length ? r.errors.slice(0, 10).join(' | ') + (r.errors.length > 10 ? ' | ...' : '') : ''
      setSuccess(`Imported: ${r.inserted} inserted, ${r.updated} updated${r.errors?.length ? `, ${r.errors.length} errors` : ''}`)
      if (details) setError(details)
      fetchData()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Import failed')
    }
  }

  const downloadTemplate = () => {
    const header = headersOrder.join(',') + '\n'
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Suppliers_Import_Template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <div className="flex items-center gap-2">
            <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button onClick={() => { setPage(1); fetchData() }}>Search</Button>
            <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload}>Upload</Button>
            <Button onClick={openAdd}>Add Supplier</Button>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-3 font-semibold">Plant Code</th>
                      <th className="p-3 font-semibold">Mills</th>
                      <th className="p-3 font-semibold">Parent Company</th>
                      <th className="p-3 font-semibold">Province</th>
                      <th className="p-3 font-semibold">Island</th>
                      <th className="p-3 font-semibold text-right">CAP</th>
                      <th className="p-3 font-semibold text-right">CPO / Month</th>
                      <th className="p-3 font-semibold text-right">PK / Month</th>
                      <th className="p-3 font-semibold text-right">POME / Month</th>
                      <th className="p-3 font-semibold text-right">SHELL / Month</th>
                      <th className="p-3 font-semibold text-right">CPO / Year</th>
                      <th className="p-3 font-semibold text-right">PK / Year</th>
                      <th className="p-3 font-semibold text-right">POME / Year</th>
                      <th className="p-3 font-semibold text-right">SHELL / Year</th>
                      <th className="p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{s.plant_code}</td>
                        <td className="p-3">{s.mills || '-'}</td>
                        <td className="p-3">{s.parent_company || '-'}</td>
                        <td className="p-3">{s.province || '-'}</td>
                        <td className="p-3">{s.island || '-'}</td>
                        <td className="p-3 text-right">{s.cap ? Number(s.cap).toLocaleString('en-US') : '-'}</td>
                        <td className="p-3 text-right">{s.cpo_prod_est_month ? Number(s.cpo_prod_est_month).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.pk_prod_est_month ? Number(s.pk_prod_est_month).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.pome_prod_est_month ? Number(s.pome_prod_est_month).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.shell_prod_est_month ? Number(s.shell_prod_est_month).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.cpo_prod_est_year ? Number(s.cpo_prod_est_year).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.pk_prod_est_year ? Number(s.pk_prod_est_year).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.pome_prod_est_year ? Number(s.pome_prod_est_year).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 text-right">{s.shell_prod_est_year ? Number(s.shell_prod_est_year).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-3 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingSupplier(s)}>View</Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => removeSupplier(s)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </CardContent>
        </Card>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-md w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <form onSubmit={saveSupplier} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ['plant_code','Plant Code'],['mills','Mills'],['group_id','Group ID'],['parent_company','Parent Company'],['group_holding','Group / Holding'],
                  ['controlling_shareholder','Controlling Shareholder'],['other_shareholders','Other Shareholders'],['group_type','Group Type'],['group_scale','Group Scale'],['integrated_status','Integrated Status'],
                  ['cap','CAP'],
                  ['cpo_prod_est_month','CPO Prod Est / Month'],['pk_prod_est_month','PK Prod Est / Month'],['pome_prod_est_month','POME Prod Est / Month'],['shell_prod_est_month','SHELL Prod Est / Month'],
                  ['cpo_prod_est_year','CPO Prod Est / Year'],['pk_prod_est_year','PK Prod Est / Year'],['pome_prod_est_year','POME Prod Est / Year'],['shell_prod_est_year','SHELL Prod Est / Year'],
                  ['city_regency','City / Regency'],['province','Province'],['island','Island'],['longitude','Longitude'],['latitude','Latitude'],
                  ['kml_folder','KML Folder'],['map','Map'],['rspo','RSPO'],['rspo_type','RSPO Type'],['ispo','ISPO'],['iscc','ISCC'],
                  ['year_commence','Year Commence'],['updated_date','Updated Date'],['remarks','Remarks']
                ].map(([key, label]) => (
                  <div key={key as string} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      type={key === 'updated_date' ? 'date' : (key?.toString().includes('prod_est') || key === 'longitude' || key === 'latitude' || key === 'year_commence' || key === 'cap') ? 'number' : 'text'}
                      value={form[key as string] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (key === 'cap') {
                          const capNum = Number(val)
                          const calc = (prod: any, useYear = false) => {
                            if (!prod || !isFinite(capNum)) return ''
                            const pct = prod.percent_produce == null ? null : Number(prod.percent_produce) / 100
                            const hours = prod.working_hours_per_day == null ? null : Number(prod.working_hours_per_day)
                            const days = useYear
                              ? prod.working_days_per_year == null ? null : Number(prod.working_days_per_year)
                              : prod.working_days_per_month == null ? null : Number(prod.working_days_per_month)
                            if (pct == null || hours == null || days == null) return ''
                            const v = capNum * pct * hours * days
                            return isFinite(v) ? String(v) : ''
                          }
                          setForm((f: any) => ({
                            ...f,
                            cap: val,
                            cpo_prod_est_month: calc(productConfigs['CPO'], false),
                            pk_prod_est_month: calc(productConfigs['PK'], false),
                            pome_prod_est_month: calc(productConfigs['POME'], false),
                            shell_prod_est_month: calc(productConfigs['SHELL'], false),
                            cpo_prod_est_year: calc(productConfigs['CPO'], true),
                            pk_prod_est_year: calc(productConfigs['PK'], true),
                            pome_prod_est_year: calc(productConfigs['POME'], true),
                            shell_prod_est_year: calc(productConfigs['SHELL'], true),
                          }))
                          console.log('Supplier CAP change', { capNum, cfg: productConfigs })
                        } else {
                          setForm((f: any) => ({ ...f, [key as string]: val }))
                        }
                      }}
                      disabled={key?.toString().includes('prod_est')}
                      required={key === 'plant_code'}
                    />
                  </div>
                ))}
                <div className="col-span-full flex justify-end gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewingSupplier && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-md w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Supplier Details - {viewingSupplier.plant_code}</h2>
                <Button variant="outline" onClick={() => setViewingSupplier(null)}>Close</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {[
                  ['plant_code','Plant Code'],['mills','Mills'],['group_id','Group ID'],['parent_company','Parent Company'],['group_holding','Group / Holding'],
                  ['controlling_shareholder','Controlling Shareholder'],['other_shareholders','Other Shareholders'],['group_type','Group Type'],['group_scale','Group Scale'],['integrated_status','Integrated Status'],
                  ['cap','CAP'],
                  ['cpo_prod_est_month','CPO Prod Est / Month'],['pk_prod_est_month','PK Prod Est / Month'],['pome_prod_est_month','POME Prod Est / Month'],['shell_prod_est_month','SHELL Prod Est / Month'],
                  ['cpo_prod_est_year','CPO Prod Est / Year'],['pk_prod_est_year','PK Prod Est / Year'],['pome_prod_est_year','POME Prod Est / Year'],['shell_prod_est_year','SHELL Prod Est / Year'],
                  ['city_regency','City / Regency'],['province','Province'],['island','Island'],['longitude','Longitude'],['latitude','Latitude'],
                  ['kml_folder','KML Folder'],['map','Map'],['rspo','RSPO'],['rspo_type','RSPO Type'],['ispo','ISPO'],['iscc','ISCC'],
                  ['year_commence','Year Commence'],['updated_date','Updated Date'],['remarks','Remarks']
                ].map(([key, label]) => (
                  <div key={key as string} className="space-y-1">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="font-medium break-words">
                      {(() => {
                        const v: any = (viewingSupplier as any)[key as string]
                        if (v == null || v === '') return '-'
                        if (String(key).includes('prod_est')) return Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
                        if (key === 'cap') return Number(v).toLocaleString('en-US')
                        return String(v)
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

