'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Minus, Plus, Search, Filter, Eye, X, Upload, Truck, Ship, FileText, SlidersHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'

interface Contract {
  id: string
  contract_id: string
  buyer: string
  supplier: string
  product: string
  quantity_ordered: number
  unit: string
  incoterm: string
  contract_date: string
  delivery_start_date: string
  delivery_end_date: string
  contract_value: number
  currency: string
  status: string
  group_name: string
  po_number: string
  po_numbers: string
  sto_number: string
  sto_numbers: string
  sto_quantity: number
  unit_price: number
  source_type: string
  contract_type: string
  transport_mode: string
  logistics_classification: string
  po_classification: string
  created_at: string
  total_sto_quantity: number
  outstanding_quantity: number
  po_count: number
  sto_count: number
  company_code?: string
  b2b_flag?: string
  contract_reference_po?: string
  lt_spot?: string
  import_status?: string
  due_date_payment?: string
  dp_date?: string
  payoff_date?: string
  dp_date_deviation_days?: number
  payoff_date_deviation_days?: number
  trucking_count?: number
}

interface DocumentItem {
  id: string
  document_type?: string
  file_name: string
  file_path?: string
  mime_type?: string
  file_size?: number
  contract_id?: string
  created_at?: string
}

export default function ContractsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  // Default view: compact (1 line per contract)
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(() => new Set())
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Desktop table horizontal scroll sync (top + bottom)
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const bottomScrollRef = useRef<HTMLDivElement | null>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(0)
  const isSyncingScroll = useRef(false)
  const [statusFilter, setStatusFilter] = useState<string>('All Status')
  const [companyCodeFilter, setCompanyCodeFilter] = useState<string>('ALL')
  const [b2bFlagFilter, setB2bFlagFilter] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [availableCompanyCodes, setAvailableCompanyCodes] = useState<string[]>([])
  const [availableB2bFlags, setAvailableB2bFlags] = useState<string[]>([])
  const [uploadingId, setUploadingId] = useState<string>('')
  const [docsLoading, setDocsLoading] = useState<boolean>(false)
  const [selectedContractDocs, setSelectedContractDocs] = useState<DocumentItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalContracts, setTotalContracts] = useState(0)
  const contractsPerPage = 100

  // This page mounts even while <Layout> is still checking localStorage.
  // Avoid firing API calls until a token exists.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasToken = () => Boolean(localStorage.getItem('token'))
    if (hasToken()) {
      setAuthReady(true)
      return
    }
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      if (hasToken()) {
        window.clearInterval(interval)
        setAuthReady(true)
      } else if (Date.now() - startedAt > 3000) {
        window.clearInterval(interval)
      }
    }, 150)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!authReady) return
    // Read URL parameters
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    // Reset to page 1 when filters change
    setCurrentPage(1)
    fetchContracts(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, searchParams, statusFilter, companyCodeFilter, b2bFlagFilter, dateFrom, dateTo])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      fetchContracts(newPage)
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedContractIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const collapseAll = () => setExpandedContractIds(new Set())

  const expandAll = (ids: string[]) => setExpandedContractIds(new Set(ids))

  const expandedCount = expandedContractIds.size
  // NOTE: allVisibleIds/allExpanded are derived after filteredContracts is defined (below)

  const columnStorageKey = 'contracts.compact.visibleColumns'
  const sortStorageKey = 'contracts.compact.sort'

  const fetchContracts = async (page: number = currentPage) => {
    try {
      if (!authReady) return
      setLoading(true)
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', contractsPerPage.toString())
      if (statusFilter && statusFilter !== 'All Status') {
        // Map frontend status to backend status
        const statusMap: { [key: string]: string } = {
          'Open': 'ACTIVE',
          'Close': 'CLOSE'
        }
        params.append('status', statusMap[statusFilter] || statusFilter)
      }
      if (companyCodeFilter && companyCodeFilter !== 'ALL') {
        params.append('companyCode', companyCodeFilter)
      }
      if (b2bFlagFilter && b2bFlagFilter !== 'ALL') {
        params.append('b2bFlag', b2bFlagFilter)
      }
      if (dateFrom) {
        params.append('dateFrom', dateFrom)
      }
      if (dateTo) {
        params.append('dateTo', dateTo)
      }
      
      // Check for outstanding parameter from URL
      const outstandingParam = searchParams.get('outstanding')
      if (outstandingParam === 'true') {
        params.append('outstanding', 'true')
      }
      
      const response = await api.get(`/contracts?${params.toString()}`)
      const loadedContracts: Contract[] = response.data?.data?.contracts || []
      console.log('Contracts loaded:', loadedContracts.length)
      console.log('Pagination:', response.data?.data?.pagination)
      setContracts(loadedContracts)
      
      // Update pagination state
      if (response.data.data.pagination) {
        setTotalContracts(response.data.data.pagination.total)
        setTotalPages(response.data.data.pagination.totalPages)
        setCurrentPage(response.data.data.pagination.page)
      }
      
      // Extract unique company codes and B2B flags from contracts
      // Use fresh response data; state updates are async.
      const companyCodes = [...new Set(loadedContracts.map(c => c.company_code).filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
      const b2bFlags = [...new Set(loadedContracts.map(c => c.b2b_flag).filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
      if (companyCodes.length > 0) setAvailableCompanyCodes(companyCodes)
      if (b2bFlags.length > 0) setAvailableB2bFlags(b2bFlags)
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
      const status = (error as any)?.response?.status
      // 401 is handled by axios interceptor (redirects to /login)
      if (status === 401 || status === 403) return
      alert('Failed to load contracts. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  // Fetch filter options on mount
  useEffect(() => {
    if (!authReady) return
    const fetchFilterOptions = async () => {
      try {
        // Fetch all contracts to get unique values (with a higher limit)
        const response = await api.get('/contracts?limit=10000')
        const allContracts: Contract[] = response.data.data.contracts || []
        
        const companyCodes = [...new Set(allContracts.map((c) => c.company_code).filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
        const b2bFlags = [...new Set(allContracts.map((c) => c.b2b_flag).filter((v): v is string => typeof v === 'string' && v.length > 0))].sort()
        
        setAvailableCompanyCodes(companyCodes)
        setAvailableB2bFlags(b2bFlags)
      } catch (error) {
        console.error('Failed to fetch filter options:', error)
      }
    }
    fetchFilterOptions()
  }, [authReady])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Close':
      case 'CLOSE':
      case 'Completed':
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  const getShippingIconColor = (c: Contract) => {
    if (!c.sto_count || c.sto_count === 0) return 'text-gray-400'
    if (c.outstanding_quantity && c.outstanding_quantity > 0) return 'text-green-600'
    return 'text-blue-600'
  }
  const getTruckingIconColor = (c: Contract) => {
    if (!c.trucking_count || c.trucking_count === 0) return 'text-gray-400'
    if (c.outstanding_quantity && c.outstanding_quantity > 0) return 'text-green-600'
    return 'text-blue-600'
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatNumber = (num: number | string) => {
    if (num === null || num === undefined || num === '') return '-'
    const number = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(number)) return '-'
    if (number === 0) return '0'
    return number.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2,
      useGrouping: true
    })
  }

  const formatCurrency = (amount: number | string, currency: string = 'USD') => {
    if (amount === null || amount === undefined || amount === '') return '-'
    const number = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(number)) return '-'
    if (number === 0) return `${currency} 0`
    return `${currency} ${number.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2,
      useGrouping: true
    })}`
  }

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '-'
    // Keep compact and consistent (MM/DD/YYYY)
    return d.toLocaleDateString('en-US')
  }

  const handleFilterChange = () => {
    setCurrentPage(1)
    fetchContracts(1)
  }

  const handleUploadFileChange = async (contract: Contract, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Validate type
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      alert('Only PDF, PNG, or JPEG files are allowed.')
      e.target.value = ''
      return
    }

    setUploadingId(contract.id)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('document_type', 'OTHER')
      form.append('contract_id', contract.id)

      const res = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data?.success) {
        alert('Document uploaded successfully!')
        // If the uploaded doc is for the currently opened contract, refresh docs list
        if (selectedContract && selectedContract.id === contract.id) {
          await fetchContractDocuments(contract.id)
        }
      } else {
        alert(res.data?.error?.message || 'Failed to upload document')
      }
    } catch (err) {
      console.error('Upload document error:', err)
      alert('Failed to upload document. Please try again.')
    } finally {
      setUploadingId('')
      e.target.value = ''
    }
  }

  const fetchContractDocuments = async (contractInternalId: string) => {
    try {
      setDocsLoading(true)
      const params = new URLSearchParams()
      params.append('contractId', contractInternalId)
      const res = await api.get(`/documents?${params.toString()}`)
      const docs: DocumentItem[] = res.data?.data || []
      setSelectedContractDocs(docs)
    } catch (err) {
      console.error('Fetch documents error:', err)
      setSelectedContractDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDownloadDocument = async (docId: string, fileName: string) => {
    try {
      const response = await api.get(`/documents/${docId}/download`, {
        responseType: 'blob'
      })
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download document error:', err)
      alert('Failed to download document. Please try again.')
    }
  }

  useEffect(() => {
    if (selectedContract) {
      fetchContractDocuments(selectedContract.id)
    } else {
      setSelectedContractDocs([])
    }
  }, [selectedContract])

  // Only filter by search term on frontend - all other filters are handled by backend
  const filteredContracts = useMemo(() => contracts.filter(contract => {
    if (searchTerm === '') return true
    
    return contract.contract_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.po_numbers?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.sto_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.sto_numbers?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.product?.toLowerCase().includes(searchTerm.toLowerCase())
  }), [contracts, searchTerm])

  type CompactColumn = {
    id: string
    label: string
    defaultVisible: boolean
    sortable?: boolean
    getSortValue?: (c: Contract) => string | number
    render: (c: Contract) => React.ReactNode
    className?: string
    headerClassName?: string
  }

  const compactColumns: CompactColumn[] = useMemo(() => [
    {
      id: 'contract_id',
      label: 'Contract',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.contract_id || '',
      render: (c) => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{c.contract_id}</div>
          <div className="text-xs text-gray-600 truncate">{c.supplier || '-'} • {c.product || '-'}</div>
        </div>
      )
    },
    {
      id: 'product',
      label: 'Product',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.product || '',
      render: (c) => <span className="text-sm truncate">{c.product || '-'}</span>
    },
    {
      id: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => (c.import_status || c.status || ''),
      render: (c) => (
        <Badge className={getStatusColor(c.import_status || c.status)}>
          {c.import_status || c.status}
        </Badge>
      )
    },
    {
      id: 'contract_date',
      label: 'Contract Date',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.contract_date || '',
      render: (c) => <span className="text-sm">{formatShortDate(c.contract_date)}</span>
    },
    {
      id: 'company_code',
      label: 'Company',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.company_code || '',
      render: (c) => <span className="text-sm font-medium">{c.company_code || '-'}</span>
    },
    {
      id: 'lt_spot',
      label: 'LT/SPOT',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.lt_spot || '',
      render: (c) => <span className="text-sm">{c.lt_spot || '-'}</span>
    },
    {
      id: 'po_number',
      label: 'PO Number',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.po_numbers || c.po_number || '',
      render: (c) => (
        <span className="text-sm truncate block" title={c.po_numbers || c.po_number || ''}>
          {c.po_numbers || c.po_number || '-'}
        </span>
      )
    },
    {
      id: 'sto_number',
      label: 'STO Number',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.sto_numbers || c.sto_number || '',
      render: (c) => (
        <span className="text-sm truncate block" title={c.sto_numbers || c.sto_number || ''}>
          {c.sto_numbers || c.sto_number || '-'}
        </span>
      )
    },
    {
      id: 'contract_qty',
      label: 'Contract Qty',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => (typeof c.quantity_ordered === 'number' ? c.quantity_ordered : 0),
      render: (c) => (
        <span className="text-sm truncate">
          {formatNumber(c.quantity_ordered)} {c.unit}
        </span>
      )
    },
    {
      id: 'outstanding_qty',
      label: 'Outstanding Qty',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => (typeof c.outstanding_quantity === 'number' ? c.outstanding_quantity : 0),
      render: (c) => (
        <span className={`text-sm font-medium ${c.outstanding_quantity < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatNumber(c.outstanding_quantity)} {c.unit}
        </span>
      )
    },
    {
      id: 'delivery_start',
      label: 'Delivery Start',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.delivery_start_date || '',
      render: (c) => <span className="text-sm">{formatShortDate(c.delivery_start_date)}</span>
    },
    {
      id: 'delivery_end',
      label: 'Delivery End',
      defaultVisible: true,
      sortable: true,
      getSortValue: (c) => c.delivery_end_date || '',
      render: (c) => <span className="text-sm">{formatShortDate(c.delivery_end_date)}</span>
    },
    {
      id: 'created_at',
      label: 'Created',
      defaultVisible: false,
      sortable: true,
      getSortValue: (c) => c.created_at || '',
      render: (c) => <span className="text-sm">{formatShortDate(c.created_at)}</span>
    },
  ], [getStatusColor]) // eslint-disable-line react-hooks/exhaustive-deps

  const defaultVisibleColumnIds = useMemo(() => {
    return compactColumns.filter(c => c.defaultVisible).map(c => c.id)
  }, [compactColumns])

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => new Set(defaultVisibleColumnIds))

  // Load persisted columns/sort (client only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(columnStorageKey)
      if (raw) {
        const ids = JSON.parse(raw) as string[]
        if (Array.isArray(ids) && ids.length > 0) setVisibleColumnIds(new Set(ids))
      }
      const rawSort = localStorage.getItem(sortStorageKey)
      if (rawSort) {
        const s = JSON.parse(rawSort) as { key?: string; dir?: 'asc' | 'desc' }
        if (s?.key) setSortKey(s.key)
        if (s?.dir) setSortDir(s.dir)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist columns/sort
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(columnStorageKey, JSON.stringify(Array.from(visibleColumnIds)))
      localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: sortDir }))
    } catch {
      // ignore
    }
  }, [visibleColumnIds, sortKey, sortDir])

  // (scroll width effect is defined after visibleColumns/sortedContracts)

  const visibleColumns = useMemo(() => {
    const visible = compactColumns.filter(c => visibleColumnIds.has(c.id))
    // Ensure Contract + Status are always visible
    const mustHave = ['contract_id', 'status']
    for (const id of mustHave) {
      if (!visible.some(v => v.id === id)) {
        const def = compactColumns.find(c => c.id === id)
        if (def) visible.unshift(def)
      }
    }
    // De-dupe
    const seen = new Set<string>()
    return visible.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)))
  }, [compactColumns, visibleColumnIds])

  const getColumnWidth = (id: string): string => {
    switch (id) {
      case 'contract_id':
        return 'minmax(220px, 1.6fr)'
      case 'product':
        return 'minmax(140px, 1fr)'
      case 'status':
        return 'minmax(110px, 0.8fr)'
      case 'contract_date':
        return 'minmax(120px, 0.9fr)'
      case 'company_code':
        return 'minmax(90px, 0.6fr)'
      case 'lt_spot':
        return 'minmax(90px, 0.6fr)'
      case 'po_number':
      case 'sto_number':
        return 'minmax(150px, 1fr)'
      case 'contract_qty':
      case 'outstanding_qty':
        return 'minmax(150px, 1fr)'
      case 'delivery_start':
      case 'delivery_end':
        return 'minmax(130px, 0.9fr)'
      default:
        return 'minmax(120px, 1fr)'
    }
  }

  const toggleColumn = (id: string) => {
    // Prevent hiding required columns
    if (id === 'contract_id' || id === 'status') return
    setVisibleColumnIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSortHeaderClick = (col: CompactColumn) => {
    if (!col.sortable) return
    setSortKey(prev => {
      if (prev !== col.id) {
        setSortDir('asc')
        return col.id
      }
      // toggle dir
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
      return prev
    })
  }

  const sortedContracts = useMemo(() => {
    const col = compactColumns.find(c => c.id === sortKey)
    if (!col?.sortable || !col.getSortValue) return filteredContracts
    const dirMul = sortDir === 'asc' ? 1 : -1
    const copy = [...filteredContracts]
    copy.sort((a, b) => {
      const av = col.getSortValue!(a)
      const bv = col.getSortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dirMul
      const as = String(av ?? '')
      const bs = String(bv ?? '')
      return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' }) * dirMul
    })
    return copy
  }, [compactColumns, filteredContracts, sortDir, sortKey])

  // Update desktop table scroll width (for top scrollbar)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const calc = () => {
      const el = bottomScrollRef.current
      if (el) setTableScrollWidth(el.scrollWidth)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [visibleColumns, sortedContracts.length])

  const allVisibleIds = useMemo(() => sortedContracts.map(c => c.id), [sortedContracts])
  const allExpanded = expandedCount > 0 && expandedCount === allVisibleIds.length

  // If pagination/filtering changes, drop expansions that aren't on the current view to avoid stale set growth
  useEffect(() => {
    setExpandedContractIds(prev => {
      if (prev.size === 0) return prev
      const visible = new Set(filteredContracts.map(c => c.id))
      const next = new Set<string>()
      for (const id of prev) if (visible.has(id)) next.add(id)
      return next
    })
  }, [filteredContracts])

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
            <p className="text-gray-600 mt-2">
              {totalContracts} total contracts | Showing {filteredContracts.length} on this page
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by Contract ID, PO, Supplier, or Product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="All Status">All Status</option>
                  <option value="Open">Open</option>
                  <option value="Close">Close</option>
                </select>
                <select
                  value={companyCodeFilter}
                  onChange={(e) => setCompanyCodeFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="ALL">All Company Codes</option>
                  {availableCompanyCodes.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <select
                  value={b2bFlagFilter}
                  onChange={(e) => setB2bFlagFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="ALL">All B2B Flags</option>
                  {availableB2bFlags.map(flag => (
                    <option key={flag} value={flag}>{flag}</option>
                  ))}
                </select>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Contract Date:</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40"
                    placeholder="From"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40"
                    placeholder="To"
                  />
                  <Button 
                    onClick={handleFilterChange}
                    variant="outline"
                    size="sm"
                    className="ml-2"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                  {(dateFrom || dateTo) && (
                    <Button 
                      onClick={() => {
                        setDateFrom('')
                        setDateTo('')
                        handleFilterChange()
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contracts List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>All Contracts</CardTitle>
                <Badge variant="outline" className="hidden md:inline-flex">
                  Default view: Compact
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnsMenu(v => !v)}
                    disabled={loading}
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                  {showColumnsMenu && (
                    <div className="absolute right-0 mt-2 w-64 rounded-md border bg-white shadow-md z-50 p-3">
                      <div className="text-xs font-semibold text-gray-600 mb-2">Visible columns</div>
                      <div className="space-y-2 max-h-72 overflow-auto pr-1">
                        {compactColumns
                          .filter(c => c.id !== 'contract_id' && c.id !== 'status')
                          .map(col => (
                            <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                              <Checkbox
                                checked={visibleColumnIds.has(col.id)}
                                onCheckedChange={() => toggleColumn(col.id)}
                              />
                              <span>{col.label}</span>
                            </label>
                          ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVisibleColumnIds(new Set(defaultVisibleColumnIds))}
                        >
                          Reset
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowColumnsMenu(false)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (allExpanded ? collapseAll() : expandAll(allVisibleIds))}
                  disabled={loading || filteredContracts.length === 0}
                >
                  {allExpanded ? (
                    <>
                      <Minus className="h-4 w-4 mr-2" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Expand All
                    </>
                  )}
                </Button>
              </div>
              {/* Pagination Controls - Top */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading contracts...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No contracts found</p>
                {searchTerm && <p className="text-sm mt-2">Try adjusting your search filters</p>}
              </div>
            ) : (
              <>
                {/* Desktop compact table: ONE scroll container + clean rows */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  {/* Top scrollbar (synced) */}
                  <div
                    ref={topScrollRef}
                    className="overflow-x-auto border-b bg-white"
                    onScroll={() => {
                      if (isSyncingScroll.current) return
                      const top = topScrollRef.current
                      const bottom = bottomScrollRef.current
                      if (!top || !bottom) return
                      isSyncingScroll.current = true
                      bottom.scrollLeft = top.scrollLeft
                      window.requestAnimationFrame(() => {
                        isSyncingScroll.current = false
                      })
                    }}
                  >
                    <div style={{ width: tableScrollWidth || 0, height: 1 }} />
                  </div>

                  <div
                    ref={bottomScrollRef}
                    className="overflow-x-auto"
                    onScroll={() => {
                      if (isSyncingScroll.current) return
                      const top = topScrollRef.current
                      const bottom = bottomScrollRef.current
                      if (!top || !bottom) return
                      isSyncingScroll.current = true
                      top.scrollLeft = bottom.scrollLeft
                      window.requestAnimationFrame(() => {
                        isSyncingScroll.current = false
                      })
                    }}
                  >
                    <div className="min-w-[1100px]">
                      {/* Header */}
                      <div
                        className="grid gap-3 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b sticky top-0 z-10"
                        style={{
                          gridTemplateColumns: `28px ${visibleColumns.map(c => getColumnWidth(c.id)).join(' ')} 320px`
                        }}
                      >
                        <div />
                        {visibleColumns.map(col => {
                          const active = sortKey === col.id
                          return (
                            <button
                              key={col.id}
                              type="button"
                              className={`flex items-center gap-1 text-left ${col.sortable ? 'hover:text-gray-900' : ''}`}
                              onClick={() => onSortHeaderClick(col)}
                              title={col.sortable ? 'Sort' : undefined}
                            >
                              <span className="truncate">{col.label}</span>
                              {col.sortable && active && (
                                sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              )}
                            </button>
                          )
                        })}
                        <div className="text-right sticky right-0 bg-gray-50 border-l pl-3 pr-2">Actions</div>
                      </div>

                      {/* Rows */}
                      <div className="divide-y">
                        {sortedContracts.map((contract, idx) => (
                          <div key={contract.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <div className="px-3 py-2">
                              <div
                                className="grid gap-3 items-center"
                                style={{
                                  gridTemplateColumns: `28px ${visibleColumns.map(c => getColumnWidth(c.id)).join(' ')} 320px`
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(contract.id)}
                                  className="p-1 text-gray-500 hover:text-gray-800"
                                  title={expandedContractIds.has(contract.id) ? 'Collapse' : 'Expand'}
                                >
                                  {expandedContractIds.has(contract.id) ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                </button>

                                {visibleColumns.map(col => (
                                  <div key={col.id} className="min-w-0">
                                    {col.render(contract)}
                                  </div>
                                ))}

                                <div className="flex items-center justify-end gap-2 sticky right-0 bg-white border-l pl-3 pr-2 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                                  <button
                                    title="Trucking"
                                    className={`p-1 ${getTruckingIconColor(contract)}`}
                                    onClick={() => {
                                      const firstSto = contract.sto_numbers?.split(',')[0]?.trim() || contract.sto_number
                                      if (firstSto) router.push(`/trucking?sto=${encodeURIComponent(firstSto)}`)
                                      else router.push(`/trucking?contract=${encodeURIComponent(contract.contract_id)}`)
                                    }}
                                  >
                                    <Truck className="h-5 w-5" />
                                  </button>
                                  <button
                                    title="Shipping"
                                    className={`p-1 ${getShippingIconColor(contract)}`}
                                    onClick={() => {
                                      const firstSto = contract.sto_numbers?.split(',')[0]?.trim() || contract.sto_number
                                      if (firstSto) router.push(`/shipments?sto=${encodeURIComponent(firstSto)}`)
                                      else router.push(`/shipments?contract=${encodeURIComponent(contract.contract_id)}`)
                                    }}
                                  >
                                    <Ship className="h-5 w-5" />
                                  </button>
                                  <button
                                    title="Documents"
                                    className="p-1 text-gray-700"
                                    onClick={() => setSelectedContract(contract)}
                                  >
                                    <FileText className="h-5 w-5" />
                                  </button>

                                  <Button variant="outline" size="sm" onClick={() => setSelectedContract(contract)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>

                                  <input
                                    id={`contract-file-${contract.id}`}
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    className="hidden"
                                    onChange={(e) => handleUploadFileChange(contract, e)}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById(`contract-file-${contract.id}`)?.click()}
                                    disabled={uploadingId === contract.id}
                                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                  >
                                    {uploadingId === contract.id ? (
                                      <>
                                        <span className="h-4 w-4 mr-2 inline-block border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded Details (optional) */}
                              {expandedContractIds.has(contract.id) && (
                                <div className="mt-3 p-3 border rounded bg-white">
                                  {/* Main Info Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <div className="text-gray-500">Source</div>
                                      <div className="font-medium">{contract.source_type || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500">Group Name</div>
                                      <div className="font-medium">{contract.group_name || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500">B2B Flag</div>
                                      <div className="font-medium">{contract.b2b_flag || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500">Buyer</div>
                                      <div className="font-medium">{contract.buyer || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500">Transport Mode</div>
                                      <div className="font-medium">{contract.transport_mode || '-'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500">Incoterm</div>
                                      <div className="font-medium">{contract.incoterm || '-'}</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile/tablet cards */}
                <div className="lg:hidden space-y-2">
                  {sortedContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-4">
                      {/* Compact Row (default) - table style on desktop */}
                      <div className="lg:hidden flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(contract.id)}
                            className="p-1 text-gray-500 hover:text-gray-800"
                            title={expandedContractIds.has(contract.id) ? 'Collapse' : 'Expand'}
                          >
                            {expandedContractIds.has(contract.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold truncate">{contract.contract_id}</span>
                              <Badge className={getStatusColor(contract.import_status || contract.status)}>
                                {contract.import_status || contract.status}
                              </Badge>
                              {contract.transport_mode && (
                                <Badge variant="secondary" className="hidden sm:inline-flex">
                                  {contract.transport_mode}
                                </Badge>
                              )}
                              {contract.lt_spot && (
                                <Badge variant="outline" className="hidden md:inline-flex">
                                  {contract.lt_spot}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              <span className="font-medium">{contract.supplier || '-'}</span>
                              {' • '}
                              {contract.product || '-'}
                              {' • '}
                              <span className="text-gray-500">Outstanding:</span>{' '}
                              <span className={contract.outstanding_quantity < 0 ? 'text-red-600' : 'text-gray-800'}>
                                {formatNumber(contract.outstanding_quantity)} {contract.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Icons: Trucking, Shipping, Documents */}
                          <button
                            title="Trucking"
                            className={`p-1 ${getTruckingIconColor(contract)}`}
                            onClick={() => {
                              const firstSto = contract.sto_numbers?.split(',')[0]?.trim() || contract.sto_number
                              if (firstSto) router.push(`/trucking?sto=${encodeURIComponent(firstSto)}`)
                              else router.push(`/trucking?contract=${encodeURIComponent(contract.contract_id)}`)
                            }}
                          >
                            <Truck className="h-5 w-5" />
                          </button>
                          <button
                            title="Shipping"
                            className={`p-1 ${getShippingIconColor(contract)}`}
                            onClick={() => {
                              const firstSto = contract.sto_numbers?.split(',')[0]?.trim() || contract.sto_number
                              if (firstSto) router.push(`/shipments?sto=${encodeURIComponent(firstSto)}`)
                              else router.push(`/shipments?contract=${encodeURIComponent(contract.contract_id)}`)
                            }}
                          >
                            <Ship className="h-5 w-5" />
                          </button>
                          <button
                            title="Documents"
                            className="p-1 text-gray-700"
                            onClick={() => setSelectedContract(contract)}
                          >
                            <FileText className="h-5 w-5" />
                          </button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedContract(contract)}
                            className="hidden md:inline-flex"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>

                          {/* Upload supporting document */}
                          <input
                            id={`contract-file-${contract.id}`}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            className="hidden"
                            onChange={(e) => handleUploadFileChange(contract, e)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`contract-file-${contract.id}`)?.click()}
                            disabled={uploadingId === contract.id}
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hidden md:inline-flex"
                          >
                            {uploadingId === contract.id ? (
                              <>
                                <span className="h-4 w-4 mr-2 inline-block border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details (optional) */}
                      {expandedContractIds.has(contract.id) && (
                        <div className="mt-4">
                          {/* Main Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">Source</div>
                              <div className="font-medium">{contract.source_type || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Group Name</div>
                              <div className="font-medium">{contract.group_name || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">B2B Flag</div>
                              <div className="font-medium">{contract.b2b_flag || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Buyer</div>
                              <div className="font-medium">{contract.buyer || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Transport Mode</div>
                              <div className="font-medium">{contract.transport_mode || '-'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Incoterm</div>
                              <div className="font-medium">{contract.incoterm || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-700">
                  Showing page {currentPage} of {totalPages} ({totalContracts} total contracts)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Details Modal */}
        {selectedContract && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Contract Details</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{selectedContract.contract_id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContract(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Contract ID</div>
                        <div className="font-medium mt-1">{selectedContract.contract_id}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Status</div>
                        <div className="mt-1">
                          <Badge className={getStatusColor(selectedContract.import_status || selectedContract.status)}>
                            {selectedContract.import_status || selectedContract.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Source</div>
                        <div className="font-medium mt-1">{selectedContract.source_type || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Group Name</div>
                        <div className="font-medium mt-1">{selectedContract.group_name || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Company Code</div>
                        <div className="font-medium mt-1">{selectedContract.company_code || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">B2B Flag</div>
                        <div className="font-medium mt-1">{selectedContract.b2b_flag || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">CONTRACT REFF PO</div>
                        <div className="font-medium mt-1">{selectedContract.contract_reference_po || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">LT/SPOT</div>
                        <div className="font-medium mt-1">{selectedContract.lt_spot || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded col-span-2">
                        <div className="text-gray-500">
                          PO Number{selectedContract.po_count > 1 ? `s (${selectedContract.po_count} total)` : ''}
                        </div>
                        <div className="font-medium mt-1 text-xs">
                          {selectedContract.po_numbers || selectedContract.po_number || '-'}
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded col-span-2">
                        <div className="text-gray-500">
                          STO Number{selectedContract.sto_count > 1 ? `s (${selectedContract.sto_count} total)` : ''}
                        </div>
                        <div className="font-medium mt-1 text-xs">
                          {selectedContract.sto_numbers || selectedContract.sto_number || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documents */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Documents</h3>
                    {docsLoading ? (
                      <div className="text-sm text-gray-500">Loading documents...</div>
                    ) : selectedContractDocs.length === 0 ? (
                      <div className="text-sm text-gray-500">No documents uploaded for this contract.</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedContractDocs.map((doc) => {
                          return (
                            <div key={doc.id} className="flex items-center justify-between px-3 py-2 border rounded">
                              <div>
                                <div className="text-sm font-medium">{doc.file_name}</div>
                                <div className="text-xs text-gray-500">
                                  {(doc.document_type || 'FILE')} • {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                              >
                                View
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Parties */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Parties</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Buyer</div>
                        <div className="font-medium mt-1">{selectedContract.buyer}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Supplier</div>
                        <div className="font-medium mt-1">{selectedContract.supplier}</div>
                      </div>
                    </div>
                  </div>

                  {/* Product & Quantity */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Product & Quantity</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Product</div>
                        <div className="font-medium mt-1">{selectedContract.product}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Contract Quantity</div>
                        <div className="font-medium mt-1 text-base">{formatNumber(selectedContract.quantity_ordered)} {selectedContract.unit}</div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded border-2 border-blue-200">
                        <div className="text-gray-500">Total STO Quantity ({selectedContract.sto_count || 0} STO{selectedContract.sto_count > 1 ? 's' : ''})</div>
                        <div className="font-medium mt-1 text-base">{formatNumber(selectedContract.total_sto_quantity)} {selectedContract.unit}</div>
                      </div>
                      <div className={`p-3 rounded border-2 ${selectedContract.outstanding_quantity < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className={`font-semibold ${selectedContract.outstanding_quantity < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                          Outstanding Quantity
                        </div>
                        <div className={`font-bold text-xl mt-1 ${selectedContract.outstanding_quantity < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {formatNumber(selectedContract.outstanding_quantity)} {selectedContract.unit}
                        </div>
                        {selectedContract.outstanding_quantity < 0 && (
                          <div className="text-xs text-red-500 mt-1">Overshipped</div>
                        )}
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Unit Price</div>
                        <div className="font-medium mt-1">{formatCurrency(selectedContract.unit_price, selectedContract.currency)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Contract Value</div>
                        <div className="font-medium mt-1">{formatCurrency(selectedContract.contract_value, selectedContract.currency)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Logistics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Logistics</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Transport Mode</div>
                        <div className="font-medium mt-1">{selectedContract.transport_mode || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Incoterm</div>
                        <div className="font-medium mt-1">{selectedContract.incoterm || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Logistics Classification</div>
                        <div className="font-medium mt-1">{selectedContract.logistics_classification || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">PO Classification</div>
                        <div className="font-medium mt-1">{selectedContract.po_classification || '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Important Dates</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Contract Date</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.contract_date)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Delivery Start</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.delivery_start_date)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Delivery End</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.delivery_end_date)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Created At</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.created_at)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Dates */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Payment Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Due Date Payment</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.due_date_payment as any)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">DP Date</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.dp_date as any)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Payoff Date</div>
                        <div className="font-medium mt-1">{formatDate(selectedContract.payoff_date as any)}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">DP Date Deviation (Days)</div>
                        <div className="font-medium mt-1">{selectedContract.dp_date_deviation_days ?? '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Payoff Date Deviation (Days)</div>
                        <div className="font-medium mt-1">{selectedContract.payoff_date_deviation_days ?? '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Additional Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Source Type</div>
                        <div className="font-medium mt-1">{selectedContract.source_type || '-'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="text-gray-500">Contract Type</div>
                        <div className="font-medium mt-1">{selectedContract.contract_type || '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}

