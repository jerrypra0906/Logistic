'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, X, Truck, Package, Save, Loader2, Download, Upload, Edit2 } from 'lucide-react'
import api from '@/lib/api'

interface TruckingOperation {
  id: string
  operation_id: string
  contract_id: string
  contract_number: string
  sto_number: string
  location: string
  trucking_owner: string
  cargo_readiness_date: string
  truck_loading_date: string
  truck_unloading_date: string
  trucking_start_date: string
  trucking_completion_date: string
  quantity_sent: number
  quantity_delivered: number
  gain_loss_percentage: number
  gain_loss_amount: number
  oa_budget: number
  oa_actual: number
  status: string
  created_at: string
  supplier: string
  buyer: string
  product: string
  group_name: string
}

interface DocumentItem {
  id: string
  document_type?: string
  file_name: string
  file_path?: string
  mime_type?: string
  file_size?: number
  trucking_operation_id?: string
  created_at?: string
}

export default function TruckingPage() {
  const searchParams = useSearchParams()
  const [truckingOperations, setTruckingOperations] = useState<TruckingOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<TruckingOperation>>({})
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [locationFilter, setLocationFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [uploadingId, setUploadingId] = useState<string>('')
  
  // Documents state
  const [selectedOperation, setSelectedOperation] = useState<TruckingOperation | null>(null)
  const [operationDocs, setOperationDocs] = useState<DocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [showDocs, setShowDocs] = useState(false)

  useEffect(() => {
    // Read URL parameters
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    fetchTruckingOperations()
  }, [searchParams])

  const fetchTruckingOperations = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', '200') // Increased to show more records
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter)
      }
      if (locationFilter) {
        params.append('location', locationFilter)
      }
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      // Check for STO parameter from URL
      const stoParam = searchParams.get('sto')
      if (stoParam) {
        params.append('sto', stoParam)
      }
      
      // Check for contract parameter from URL
      const contractParam = searchParams.get('contract')
      if (contractParam) {
        params.append('contract', contractParam)
      }
      
      const response = await api.get(`/trucking?${params.toString()}`)
      setTruckingOperations(response.data.data.truckingOperations || [])
    } catch (error) {
      console.error('Failed to fetch trucking operations:', error)
      alert('Failed to load trucking operations. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (operation: TruckingOperation) => {
    setEditingId(operation.id)
    setEditedData({ ...operation })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditedData({})
  }

  const handleSave = async (operationId: string) => {
    setSaving(true)
    try {
      const response = await api.put(`/trucking/${operationId}`, editedData)
      
      if (response.data.success) {
        setTruckingOperations(prev => prev.map(operation => 
          operation.id === operationId 
            ? { ...operation, ...response.data.data }
            : operation
        ))
        setEditingId(null)
        setEditedData({})
        alert('Trucking operation updated successfully!')
      }
    } catch (error) {
      console.error('Update trucking operation error:', error)
      alert('Failed to update trucking operation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof TruckingOperation, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }))
  }

  const downloadTemplate = async () => {
    const headers = [
      'Operation ID','Status','Location','Trucking Owner',
      'Cargo Readiness Date at Starting Location (YYYY-MM-DD)','Truck Loading Date at Starting Location (YYYY-MM-DD)','Plant/Site (Truck Unloading at Starting Location) (YYYY-MM-DD)',
      'Trucking Start Date at Starting Location (YYYY-MM-DD)','Trucking Completion Date at Starting Location (YYYY-MM-DD)',
      'Quantity Sent via Trucking (Based on Surat Jalan) (MT)','Quantity Delivered via Trucking (MT)','Gain/Loss %','Gain/Loss Amount (MT)','Trucking OA Budget at Starting Location','Trucking OA Actual at Starting Location',
      'Contract Number','STO Number','Supplier','Product','Group'
    ]

    const rows: string[] = []
    const data = truckingOperations.filter(op =>
      (searchTerm === '' || op.operation_id?.toLowerCase().includes(searchTerm.toLowerCase()) || op.trucking_owner?.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    for (const t of data) {
      rows.push([
        t.operation_id, t.status, t.location, t.trucking_owner,
        t.cargo_readiness_date?.substring(0,10) || '', t.truck_loading_date?.substring(0,10) || '', t.truck_unloading_date?.substring(0,10) || '',
        t.trucking_start_date?.substring(0,10) || '', t.trucking_completion_date?.substring(0,10) || '',
        t.quantity_sent ?? '', t.quantity_delivered ?? '', t.gain_loss_percentage ?? '', t.gain_loss_amount ?? '', t.oa_budget ?? '', t.oa_actual ?? '',
        t.contract_number || '', t.sto_number || '', t.supplier || '', t.product || '', t.group_name || ''
      ].join(','))
    }

    const csvContent = [headers.join(','), ...(rows.length ? rows : [
      'TRUCK001,PLANNED,Starting Location,Truck Owner 1,2025-01-01,2025-01-02,2025-01-03,2025-01-02,2025-01-03,1000,1000,0,0,5000,4500,CTR001,STO001,Supplier A,CPKO,Group X'
    ])].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'Trucking_Export.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800'
      case 'LOADING': return 'bg-orange-100 text-orange-800'
      case 'IN_TRANSIT': return 'bg-purple-100 text-purple-800'
      case 'UNLOADING': return 'bg-indigo-100 text-indigo-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Document functions
  const handleUploadFileChange = async (operation: TruckingOperation, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      alert('Only PDF, PNG, or JPEG files are allowed.')
      e.target.value = ''
      return
    }

    setUploadingId(operation.id)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('document_type', 'OTHER')
      form.append('trucking_operation_id', operation.id)

      const res = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data?.success) {
        alert('Document uploaded successfully!')
        if (selectedOperation && selectedOperation.id === operation.id) {
          await fetchOperationDocuments(operation.id)
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

  const fetchOperationDocuments = async (operationInternalId: string) => {
    try {
      setDocsLoading(true)
      const params = new URLSearchParams()
      params.append('truckingOperationId', operationInternalId)
      const res = await api.get(`/documents?${params.toString()}`)
      const docs: DocumentItem[] = res.data?.data || []
      setOperationDocs(docs)
    } catch (err) {
      console.error('Fetch documents error:', err)
      setOperationDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDownloadDocument = async (docId: string, fileName: string) => {
    try {
      const response = await api.get(`/documents/${docId}/download`, {
        responseType: 'blob'
      })
      
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

  const handleViewDocuments = async (operation: TruckingOperation) => {
    setSelectedOperation(operation)
    setShowDocs(true)
    await fetchOperationDocuments(operation.id)
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  const handleFilterChange = () => {
    fetchTruckingOperations()
  }

  const filteredOperations = truckingOperations.filter(operation => {
    const matchesSearch = searchTerm === '' || 
      operation.operation_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operation.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operation.sto_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operation.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operation.trucking_owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operation.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trucking Operations</h1>
            <p className="text-gray-600 mt-1">
              Manage and track all trucking operations - {filteredOperations.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={() => alert('CSV upload feature coming soon!')}
                className="hidden"
                disabled={uploading}
              />
              <Button
                as="span"
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Update
                  </>
                )}
              </Button>
            </label>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by Operation ID, Contract, Location, Owner, or Supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="LOADING">Loading</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="UNLOADING">Unloading</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <Input
                placeholder="Filter by location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-48"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Start Date:</span>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                <span className="text-gray-500">to</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={handleFilterChange} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Apply
              </Button>
              {(statusFilter !== 'ALL' || locationFilter || dateFrom || dateTo) && (
                <Button 
                  onClick={() => {
                    setStatusFilter('ALL')
                    setLocationFilter('')
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
          </CardContent>
        </Card>

        {/* Trucking Operations List */}
        <Card>
          <CardHeader>
            <CardTitle>Trucking Operations (Inline Editable)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading trucking operations...</div>
            ) : filteredOperations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p>No trucking operations found</p>
                {searchTerm && <p className="text-sm mt-2">Try adjusting your search filters</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOperations.map((operation) => {
                  const isEditing = editingId === operation.id
                  const currentData = isEditing ? editedData : operation

                  return (
                    <div
                      key={operation.id}
                      className={`border rounded-lg transition-colors ${isEditing ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="p-4">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{operation.operation_id}</h3>
                            {isEditing ? (
                              <select
                                value={currentData.status}
                                onChange={(e) => handleFieldChange('status', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="PLANNED">Planned</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="LOADING">Loading</option>
                                <option value="IN_TRANSIT">In Transit</option>
                                <option value="UNLOADING">Unloading</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            ) : (
                              <Badge className={getStatusColor(operation.status)}>
                                {operation.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(operation.id)}
                                  disabled={saving}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-1" />
                                      Save
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(operation)}
                                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                >
                                  <Edit2 className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDocuments(operation)}
                                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                >
                                  <Package className="h-4 w-4 mr-1" />
                                  Documents
                                </Button>
                                {/* Upload Document */}
                                <input
                                  id={`trucking-file-${operation.id}`}
                                  type="file"
                                  accept="application/pdf,image/png,image/jpeg"
                                  className="hidden"
                                  onChange={(e) => handleUploadFileChange(operation, e)}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`trucking-file-${operation.id}`)?.click()}
                                  disabled={uploadingId === operation.id}
                                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                >
                                  {uploadingId === operation.id ? (
                                    <>
                                      <span className="h-4 w-4 mr-2 inline-block border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-1" />
                                      Upload
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Contract Info (Read-only) */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3 pb-3 border-b">
                          <div>
                            <div className="text-gray-500">Contract Number</div>
                            <div className="font-medium">{operation.contract_number || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">STO Number</div>
                            <div className="font-medium">{operation.sto_number || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Supplier</div>
                            <div className="font-medium">{operation.supplier || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Product</div>
                            <div className="font-medium">{operation.product || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Group</div>
                            <div className="font-medium">{operation.group_name || '-'}</div>
                          </div>
                        </div>

                        {/* Location & Owner (Editable) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-gray-500 mb-1">Location</div>
                            {isEditing ? (
                              <Input
                                value={currentData.location || ''}
                                onChange={(e) => handleFieldChange('location', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{operation.location || '-'}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Trucking Owner</div>
                            {isEditing ? (
                              <Input
                                value={currentData.trucking_owner || ''}
                                onChange={(e) => handleFieldChange('trucking_owner', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{operation.trucking_owner || '-'}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Quantity Sent (MT)</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.quantity_sent || ''}
                                onChange={(e) => handleFieldChange('quantity_sent', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.quantity_sent)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Quantity Delivered (MT)</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.quantity_delivered || ''}
                                onChange={(e) => handleFieldChange('quantity_delivered', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.quantity_delivered)}</div>
                            )}
                          </div>
                        </div>

                        {/* Additional Fields (Editable) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-gray-500 mb-1">Gain/Loss %</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.gain_loss_percentage || ''}
                                onChange={(e) => handleFieldChange('gain_loss_percentage', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.gain_loss_percentage)}%</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Gain/Loss Amount (MT)</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.gain_loss_amount || ''}
                                onChange={(e) => handleFieldChange('gain_loss_amount', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.gain_loss_amount)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">OA Budget</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.oa_budget || ''}
                                onChange={(e) => handleFieldChange('oa_budget', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.oa_budget)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">OA Actual</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={currentData.oa_actual || ''}
                                onChange={(e) => handleFieldChange('oa_actual', parseFloat(e.target.value))}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatNumber(operation.oa_actual)}</div>
                            )}
                          </div>
                        </div>

                        {/* Dates (Editable) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3 border-t">
                          <div>
                            <div className="text-gray-500 mb-1">Cargo Readiness at Starting Location</div>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={currentData.cargo_readiness_date ? currentData.cargo_readiness_date.split('T')[0] : ''}
                                onChange={(e) => handleFieldChange('cargo_readiness_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatDate(operation.cargo_readiness_date)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Truck Loading at Starting Location</div>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={currentData.truck_loading_date ? currentData.truck_loading_date.split('T')[0] : ''}
                                onChange={(e) => handleFieldChange('truck_loading_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatDate(operation.truck_loading_date)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Plant/Site (Truck Unloading at Starting Location)</div>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={currentData.truck_unloading_date ? currentData.truck_unloading_date.split('T')[0] : ''}
                                onChange={(e) => handleFieldChange('truck_unloading_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatDate(operation.truck_unloading_date)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Trucking Completion Date at Starting Location</div>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={currentData.trucking_completion_date ? currentData.trucking_completion_date.split('T')[0] : ''}
                                onChange={(e) => handleFieldChange('trucking_completion_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatDate(operation.trucking_completion_date)}</div>
                            )}
                          </div>
                        </div>

                        {/* Additional Date Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3">
                          <div>
                            <div className="text-gray-500 mb-1">Trucking Start Date at Starting Location</div>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={currentData.trucking_start_date ? currentData.trucking_start_date.split('T')[0] : ''}
                                onChange={(e) => handleFieldChange('trucking_start_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            ) : (
                              <div className="font-medium">{formatDate(operation.trucking_start_date)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents Modal */}
      {showDocs && selectedOperation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Documents — {selectedOperation.operation_id}</h3>
              <Button variant="ghost" onClick={() => setShowDocs(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {docsLoading ? (
              <div className="text-sm text-gray-500 py-8 text-center">Loading documents...</div>
            ) : operationDocs.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No documents uploaded for this operation.</div>
            ) : (
              <div className="space-y-2">
                {operationDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-4 py-3 border rounded hover:bg-gray-50">
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
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
