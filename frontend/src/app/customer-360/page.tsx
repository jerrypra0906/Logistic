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

export default function Customer360Page() {
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
  const [islandTotals, setIslandTotals] = useState<any[]>([])
  const [provinceTotals, setProvinceTotals] = useState<any[]>([])
  const [parentCompanyTotals, setParentCompanyTotals] = useState<any[]>([])
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
      console.log('Customer360 productConfigs loaded', map)
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
    // fetch aggregates
    ;(async () => {
      try {
        const [islandRes, provinceRes, parentRes] = await Promise.all([
          api.get('/suppliers/aggregates/by-island'),
          api.get('/suppliers/aggregates/by-province'),
          api.get('/suppliers/aggregates/by-parent-company'),
        ])
        setIslandTotals(islandRes.data.data || [])
        setProvinceTotals(provinceRes.data.data || [])
        setParentCompanyTotals(parentRes.data.data || [])
      } catch {}
    })()
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
    console.log('Customer360 auto-calc', { capNum, computed })
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Production Estimates by Island (Per Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {islandTotals.length === 0 ? (
              <div className="text-sm text-gray-500">No data</div>
            ) : (
              <div className="overflow-x-auto">
                <IslandStackedChart
                  title="Per Month"
                  data={islandTotals}
                  labelField="island"
                  filterField="island"
                  onBarClick={(value) => { setSearch(value); setPage(1); fetchData(); }}
                  categories={[
                    { key: 'cpo_month', label: 'CPO / Month', color: '#2563eb' },
                    { key: 'pk_month', label: 'PK / Month', color: '#16a34a' },
                    { key: 'pome_month', label: 'POME / Month', color: '#f59e0b' },
                    { key: 'shell_month', label: 'SHELL / Month', color: '#ef4444' },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Estimates by Island (Per Year)</CardTitle>
          </CardHeader>
          <CardContent>
            {islandTotals.length === 0 ? (
              <div className="text-sm text-gray-500">No data</div>
            ) : (
              <div className="overflow-x-auto">
                <IslandStackedChart
                  title="Per Year"
                  data={islandTotals}
                  labelField="island"
                  filterField="island"
                  onBarClick={(value) => { setSearch(value); setPage(1); fetchData(); }}
                  categories={[
                    { key: 'cpo_year', label: 'CPO / Year', color: '#2563eb' },
                    { key: 'pk_year', label: 'PK / Year', color: '#16a34a' },
                    { key: 'pome_year', label: 'POME / Year', color: '#f59e0b' },
                    { key: 'shell_year', label: 'SHELL / Year', color: '#ef4444' },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Production Estimates by Province</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {provinceTotals.length === 0 ? (
              <div className="text-sm text-gray-500">No data</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <IslandStackedChart
                    title="Per Month"
                    data={provinceTotals}
                    labelField="province"
                    filterField="province"
                    onBarClick={(value) => { setSearch(value); setPage(1); fetchData(); }}
                    categories={[
                      { key: 'cpo_month', label: 'CPO / Month', color: '#2563eb' },
                      { key: 'pk_month', label: 'PK / Month', color: '#16a34a' },
                      { key: 'pome_month', label: 'POME / Month', color: '#f59e0b' },
                      { key: 'shell_month', label: 'SHELL / Month', color: '#ef4444' },
                    ]}
                  />
                </div>
                <div className="overflow-x-auto">
                  <IslandStackedChart
                    title="Per Year"
                    data={provinceTotals}
                    labelField="province"
                    filterField="province"
                    onBarClick={(value) => { setSearch(value); setPage(1); fetchData(); }}
                    categories={[
                      { key: 'cpo_year', label: 'CPO / Year', color: '#2563eb' },
                      { key: 'pk_year', label: 'PK / Year', color: '#16a34a' },
                      { key: 'pome_year', label: 'POME / Year', color: '#f59e0b' },
                      { key: 'shell_year', label: 'SHELL / Year', color: '#ef4444' },
                    ]}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Estimates by Parent Company</CardTitle>
          </CardHeader>
          <CardContent>
            {parentCompanyTotals.length === 0 ? (
              <div className="text-sm text-gray-500">No data</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-3 font-semibold">Parent Company</th>
                      <th className="p-3 font-semibold text-right">CPO / Month</th>
                      <th className="p-3 font-semibold text-right">PK / Month</th>
                      <th className="p-3 font-semibold text-right">POME / Month</th>
                      <th className="p-3 font-semibold text-right">SHELL / Month</th>
                      <th className="p-3 font-semibold text-right">CPO / Year</th>
                      <th className="p-3 font-semibold text-right">PK / Year</th>
                      <th className="p-3 font-semibold text-right">POME / Year</th>
                      <th className="p-3 font-semibold text-right">SHELL / Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parentCompanyTotals.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{row.parent_company || 'UNKNOWN'}</td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.cpo_month || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.pk_month || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.pome_month || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.shell_month || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.cpo_year || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.pk_year || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.pome_year || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right cursor-pointer hover:text-blue-600 hover:underline" onClick={() => { setSearch(String(row.parent_company || '')); setPage(1); fetchData(); }}>
                          {Number(row.shell_year || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

function IslandStackedChart({ 
  data, 
  categories, 
  title, 
  labelField = 'island',
  filterField = 'island',
  onBarClick,
  onValueClick
}: { 
  data: any[]
  categories: { key: string; label: string; color: string }[]
  title: string
  labelField?: string
  filterField?: string
  onBarClick?: (value: string) => void
  onValueClick?: (filterValue: string, categoryKey: string, categoryLabel: string) => void
}) {
  const maxVal = Math.max(
    1,
    ...data.map((d) => categories.reduce((sum, c) => sum + Number(d[c.key] || 0), 0))
  )
  const groupWidth = 80
  const groupGap = 40
  const height = 400
  const chartWidth = Math.max(600, data.length * (groupWidth + groupGap))
  const [hoveredBar, setHoveredBar] = useState<{group: number, category: string} | null>(null)

  const handleBarClick = (value: string | null | undefined) => {
    if (onBarClick && value) {
      onBarClick(String(value))
    }
  }

  const handleValueClick = (e: React.MouseEvent, filterValue: string | null | undefined, categoryKey: string, categoryLabel: string) => {
    e.stopPropagation()
    if (onValueClick && filterValue) {
      onValueClick(String(filterValue), categoryKey, categoryLabel)
    }
  }

  return (
    <div className="min-w-full">
      <div className="flex items-center gap-4 flex-wrap mb-3">
        <div className="text-sm font-medium mr-2">{title}</div>
        {categories.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span style={{ backgroundColor: c.color }} className="inline-block w-3 h-3 rounded-sm"></span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <svg width={chartWidth} height={height} className="overflow-visible">
        {data.map((d, gi) => {
          const total = categories.reduce((sum, c) => sum + Number(d[c.key] || 0), 0)
          let yCursor = height - 60
          const x = gi * (groupWidth + groupGap)
          const filterValue = d[filterField] || d[labelField]
          const isHovered = hoveredBar?.group === gi
          
          return (
            <g 
              key={gi} 
              transform={`translate(${x}, 0)`}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
              onClick={() => handleBarClick(filterValue)}
              onMouseEnter={() => setHoveredBar({group: gi, category: ''})}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {categories.map((c, ci) => {
                const v = Number(d[c.key] || 0)
                const h = Math.max(1, Math.round(((v / maxVal) * (height - 100))))
                const y = yCursor - h
                yCursor = y
                const formattedVal = v.toLocaleString('en-US', { maximumFractionDigits: 0 })
                const canFitInside = h >= 20
                
                return (
                  <g key={c.key}>
                    <rect 
                      x={0} 
                      y={y} 
                      width={groupWidth} 
                      height={h} 
                      fill={c.color} 
                      rx={3}
                      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBarClick(filterValue)
                      }}
                    />
                    {v > 0 && (
                      <>
                        {canFitInside ? (
                          <text 
                            x={groupWidth / 2} 
                            y={y + h / 2 + 5} 
                            textAnchor="middle" 
                            className="text-xs font-semibold fill-white pointer-events-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                          >
                            {formattedVal}
                          </text>
                        ) : (
                          <text 
                            x={groupWidth + 4} 
                            y={y + h / 2 + 4} 
                            textAnchor="start" 
                            className="text-[10px] font-medium fill-gray-700 pointer-events-none"
                          >
                            {formattedVal}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                )
              })}
              <text 
                x={groupWidth / 2} 
                y={height - 25} 
                textAnchor="middle" 
                className="text-xs font-medium fill-gray-700 pointer-events-none"
              >
                {String(d[labelField] || '').length > 15 
                  ? String(d[labelField] || '').substring(0, 13) + '...'
                  : d[labelField]
                }
              </text>
            </g>
          )
        })}
        {/* baseline */}
        <line x1={0} y1={height - 60} x2={chartWidth} y2={height - 60} stroke="#e5e7eb" strokeWidth={2} />
      </svg>
    </div>
  )
}


