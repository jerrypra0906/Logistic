'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, X, Ship, Package, Save, Loader2, Download, Upload, Check, Edit2, Plus, ChevronDown, ChevronUp, ChevronRight, ArrowDown, ArrowUp, Minus, SlidersHorizontal } from 'lucide-react'
import api from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'
// import * as XLSX from 'xlsx' // Temporarily disabled

interface Shipment {
  id: string
  shipment_id: string
  contract_id: string
  contract_number: string
  vessel_name: string
  vessel_code: string
  voyage_no: string
  vessel_owner: string
  vessel_draft: number | null
  vessel_loa?: number | null
  vessel_capacity: number | null
  vessel_hull_type: string
  vessel_registration_year?: number | null
  charter_type: string
  shipment_date: string
  arrival_date: string
  port_of_loading: string
  port_of_discharge: string
  plant_site: string // Vessel Discharge Port = Plant/Site
  quantity_shipped: number
  quantity_delivered: number
  inbound_weight: number
  outbound_weight: number
  gain_loss_percentage: number
  gain_loss_amount: number
  estimated_km?: number | null
  estimated_nautical_miles?: number | null
  vessel_oa_budget?: number | null
  vessel_oa_actual?: number | null
  bl_quantity?: number | null
  actual_vessel_qty_receive?: number | null
  difference_final_qty_vs_bl_qty?: number | null
  average_vessel_speed?: number | null
  status: string
  sla_days: number
  is_delayed: boolean
  sap_delivery_id: string
  created_at: string
  supplier: string
  buyer: string
  product: string
  group_name: string
  // STO-based aggregation fields
  sto_number: string
  total_quantity_shipped: number
  total_quantity_delivered: number
  total_inbound_weight: number
  total_outbound_weight: number
  avg_gain_loss_percentage: number
  total_gain_loss_amount: number
  contract_numbers: string
  suppliers: string
  buyers: string
  products: string
  group_names: string
  contract_count: number
  // Additional fields for display
  po_numbers?: string
  delivery_start_date?: string
  delivery_end_date?: string
  sto_quantity?: number
  incoterm?: string
  b2b_flag?: string
  source_type?: string
  // Contract details (for expanded view)
  contract_details?: Array<{
    contract_number: string
    contract_qty: number
    outstanding_qty: number
    sto_qty_assigned: number
    po_number?: string
  }>
}

interface VesselLoadingPort {
  id?: string
  shipment_id?: string
  contract_number?: string
  port_name: string
  port_sequence: number
  quantity_at_loading_port: number
  eta_vessel_arrival: string
  ata_vessel_arrival: string
  eta_vessel_berthed: string
  ata_vessel_berthed: string
  eta_loading_start: string
  ata_loading_start: string
  eta_loading_completed: string
  ata_loading_completed: string
  eta_vessel_sailed: string
  ata_vessel_sailed: string
  loading_rate: number
  quality_ffa?: number | null
  quality_mi?: number | null
  quality_dobi?: number | null
  quality_red?: number | null
  quality_ds?: number | null
  quality_stone?: number | null
  is_discharge_port?: boolean
  created_at?: string
  updated_at?: string
}

interface DocumentItem {
  id: string
  document_type?: string
  file_name: string
  file_path?: string
  mime_type?: string
  file_size?: number
  shipment_id?: string
  created_at?: string
}

export default function ShipmentsPage() {
  const searchParams = useSearchParams()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<Shipment>>({})
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [vesselFilter, setVesselFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [uploadingId, setUploadingId] = useState<string>('')
  
  // Vessel loading ports state
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [loadingPorts, setLoadingPorts] = useState<VesselLoadingPort[]>([])
  const [shipmentInfo, setShipmentInfo] = useState<any>(null)
  const [showLoadingPorts, setShowLoadingPorts] = useState(false)
  const [editingPort, setEditingPort] = useState<VesselLoadingPort | null>(null)
  const [newPort, setNewPort] = useState<Partial<VesselLoadingPort>>({
    port_name: '',
    port_sequence: 1,
    quantity_at_loading_port: 0,
    eta_vessel_arrival: '',
    ata_vessel_arrival: '',
    eta_vessel_berthed: '',
    ata_vessel_berthed: '',
    eta_loading_start: '',
    ata_loading_start: '',
    eta_loading_completed: '',
    ata_loading_completed: '',
    eta_vessel_sailed: '',
    ata_vessel_sailed: '',
    loading_rate: 0,
    is_discharge_port: false
  })
  
  // Documents state
  const [shipmentDocs, setShipmentDocs] = useState<DocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [showDocs, setShowDocs] = useState(false)

  // Add new shipment state
  const [showAddShipment, setShowAddShipment] = useState(false)
  const [newShipment, setNewShipment] = useState({
    stoNumber: '',
    contractNumbers: [] as string[],
    vesselName: '',
    vesselCode: '',
    voyageNo: '',
    vesselOwner: '',
    vesselDraft: '',
    vesselCapacity: '',
    vesselHullType: '',
    charterType: '',
    portOfLoading: '',
    portOfDischarge: '',
    quantityShipped: '',
    shipmentDate: '',
    arrivalDate: ''
  })
  const [contractSuggestions, setContractSuggestions] = useState<any[]>([])
  const [contractSearchTerm, setContractSearchTerm] = useState('')
  const [showContractSuggestions, setShowContractSuggestions] = useState(false)
  const [stoValidation, setStoValidation] = useState<{exists: boolean, message: string} | null>(null)

  // Compact/Expand view state
  const [expandedShipmentIds, setExpandedShipmentIds] = useState<Set<string>>(() => new Set())
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Desktop table horizontal scroll sync (top + bottom)
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const bottomScrollRef = useRef<HTMLDivElement | null>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(0)
  const isSyncingScroll = useRef(false)

  // Contract details state for expanded view
  const [contractDetailsMap, setContractDetailsMap] = useState<{ [shipmentId: string]: Array<{
    contract_number: string
    contract_qty: number
    outstanding_qty: number
    sto_qty_assigned: number
    po_number?: string
  }> }>({})
  const [loadingContractDetails, setLoadingContractDetails] = useState<{ [shipmentId: string]: boolean }>({})
  const [savingStoQty, setSavingStoQty] = useState<{ [key: string]: boolean }>({})
  
  // Loading ports modal state for shrink/expand
  const [portsListExpanded, setPortsListExpanded] = useState(true)
  const [addPortExpanded, setAddPortExpanded] = useState(true)

  useEffect(() => {
    // Read URL parameters
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setStatusFilter(statusParam)
    }
    // Note: 'delayed' param will be handled directly in fetchShipments
    fetchShipments()
  }, [searchParams])

  const fetchShipments = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter)
      }
      if (vesselFilter) {
        params.append('vessel', vesselFilter)
      }
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      // Check for delayed parameter from URL
      const delayedParam = searchParams.get('delayed')
      if (delayedParam === 'true') {
        params.append('delayed', 'true')
      }
      
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
      
      const response = await api.get(`/shipments?${params.toString()}`)
      setShipments(response.data.data.shipments)
    } catch (error) {
      console.error('Failed to fetch shipments:', error)
      alert('Failed to load shipments. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (shipment: Shipment) => {
    setEditingId(shipment.id)
    setEditedData({ ...shipment })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditedData({})
  }

  const handleSave = async (shipmentId: string) => {
    setSaving(true)
    try {
      const payload: Partial<Shipment> = { ...editedData }

      const currentShipment = shipments.find(s => s.id === shipmentId)

      const actualValue = typeof payload.actual_vessel_qty_receive === 'number'
        ? payload.actual_vessel_qty_receive
        : currentShipment?.actual_vessel_qty_receive ?? null
      const blValue = typeof payload.bl_quantity === 'number'
        ? payload.bl_quantity
        : currentShipment?.bl_quantity ?? null

      if ((payload.actual_vessel_qty_receive !== undefined || payload.bl_quantity !== undefined) && payload.difference_final_qty_vs_bl_qty === undefined) {
        if (actualValue !== null && actualValue !== undefined && blValue !== null && blValue !== undefined) {
          payload.difference_final_qty_vs_bl_qty = actualValue - blValue
        }
      }

      const response = await api.put(`/shipments/${shipmentId}`, payload)
      
      if (response.data.success) {
        setShipments(prev => prev.map(shipment => 
          shipment.id === shipmentId 
            ? { ...shipment, ...response.data.data }
            : shipment
        ))
        setEditingId(null)
        setEditedData({})
        alert('Shipment updated successfully!')
      }
    } catch (error) {
      console.error('Update shipment error:', error)
      alert('Failed to update shipment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof Shipment, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }))
  }

  const downloadTemplate = () => {
    // Build CSV template with headers only (no data, just a clean template for import)
    const headers = [
      'STO Number','Contract Numbers','Status','Vessel Name','Vessel Code','Voyage No','Vessel Owner','Vessel Draft (m)','Vessel LOA (m)','Vessel Capacity (MT)','Hull Type','Charter Type','Vessel OA Budget','Vessel OA Actual','Estimated KM','Estimated NM','Average Vessel Speed','Port of Loading','Port of Discharge','Quantity Shipped (MT)','Quantity Delivered (MT)','B/L Quantity (MT)','Actual Vessel Qty Receive (MT)','Difference Final Qty BL QTY','Inbound Weight (MT)','Outbound Weight (MT)','Gain/Loss %','Gain/Loss Amount (MT)','Shipment Date (YYYY-MM-DD)','Arrival Date (YYYY-MM-DD)','SLA Days','Is Delayed (TRUE/FALSE)','SAP Delivery ID',
      // Loading port groups (1..3)
      'LP1 Port Name','LP1 Quantity (MT)','LP1 ETA Arrival','LP1 ATA Arrival','LP1 ETA Berthed','LP1 ATA Berthed','LP1 ETA Load Start','LP1 ATA Load Start','LP1 ETA Load Completed','LP1 ATA Load Completed','LP1 ETA Sailed','LP1 ATA Sailed','LP1 Loading Rate (MT/h)',
      'LP2 Port Name','LP2 Quantity (MT)','LP2 ETA Arrival','LP2 ATA Arrival','LP2 ETA Berthed','LP2 ATA Berthed','LP2 ETA Load Start','LP2 ATA Load Start','LP2 ETA Load Completed','LP2 ATA Load Completed','LP2 ETA Sailed','LP2 ATA Sailed','LP2 Loading Rate (MT/h)',
      'LP3 Port Name','LP3 Quantity (MT)','LP3 ETA Arrival','LP3 ATA Arrival','LP3 ETA Berthed','LP3 ATA Berthed','LP3 ETA Load Start','LP3 ATA Load Start','LP3 ETA Load Completed','LP3 ATA Load Completed','LP3 ETA Sailed','LP3 ATA Sailed','LP3 Loading Rate (MT/h)'
    ]

    // Sample row with STO Number and Contract Numbers
    const sampleRow = [
      '2587817452','2313586719, 2313586720','PLANNED','MV Example','VES001','V001','Example Shipping Co','12.5','210','50000','Single Hull','Time Charter','75000','72000','1200','650','12.5','Jakarta','Singapore','1000','950','940','930','-10','1000','980','0','0','2025-01-01','2025-01-05','5','FALSE','SAP001',
      'Loading Port 1','500','2025-01-01T08:00','','2025-01-01T10:00','','2025-01-01T11:00','','2025-01-01T18:00','','2025-01-01T20:00','','71.43',
      '','','','','','','','','','','','','',
      '','','','','','','','','','','',''
    ].join(',')

    const csvContent = [headers.join(','), sampleRow].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'Shipments_Import_Template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // Wrap in quotes if contains comma, newline, or quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const exportFilteredData = async () => {
    // Export actual filtered shipments data from the page
    const headers = [
      'STO Number','Contract Numbers','Status','Vessel Name','Vessel Code','Voyage No','Vessel Owner','Vessel Draft (m)','Vessel Capacity (MT)','Hull Type','Charter Type','Port of Loading','Port of Discharge','Quantity Shipped (MT)','Quantity Delivered (MT)','Inbound Weight (MT)','Outbound Weight (MT)','Gain/Loss %','Gain/Loss Amount (MT)','Shipment Date (YYYY-MM-DD)','Arrival Date (YYYY-MM-DD)','SLA Days','Is Delayed (TRUE/FALSE)','SAP Delivery ID',
      // Loading port groups (1..3)
      'LP1 Port Name','LP1 Quantity (MT)','LP1 ETA Arrival','LP1 ATA Arrival','LP1 ETA Berthed','LP1 ATA Berthed','LP1 ETA Load Start','LP1 ATA Load Start','LP1 ETA Load Completed','LP1 ATA Load Completed','LP1 ETA Sailed','LP1 ATA Sailed','LP1 Loading Rate (MT/h)',
      'LP2 Port Name','LP2 Quantity (MT)','LP2 ETA Arrival','LP2 ATA Arrival','LP2 ETA Berthed','LP2 ATA Berthed','LP2 ETA Load Start','LP2 ATA Load Start','LP2 ETA Load Completed','LP2 ATA Load Completed','LP2 ETA Sailed','LP2 ATA Sailed','LP2 Loading Rate (MT/h)',
      'LP3 Port Name','LP3 Quantity (MT)','LP3 ETA Arrival','LP3 ATA Arrival','LP3 ETA Berthed','LP3 ATA Berthed','LP3 ETA Load Start','LP3 ATA Load Start','LP3 ETA Load Completed','LP3 ATA Load Completed','LP3 ETA Sailed','LP3 ATA Sailed','LP3 Loading Rate (MT/h)'
    ]

    // Use the shipments that are currently displayed on the page (filtered by search and other filters)
    const rows: string[] = []
    const data = filteredShipments // Use the filtered shipments that are actually displayed on the page
    
    if (data.length === 0) {
      alert('No shipments to export. Please adjust your filters.')
      return
    }

    for (const s of data) {
      // fetch loading ports for each shipment (sequential to keep it simple)
      let ports: VesselLoadingPort[] = []
      try {
        const res = await api.get(`/shipments/${s.id}/loading-ports`)
        if (res.data.success) ports = res.data.data
      } catch {}

      const differenceValue = s.difference_final_qty_vs_bl_qty ?? ((s.actual_vessel_qty_receive ?? 0) - (s.bl_quantity ?? 0))

      const lp = [1,2,3].map(i => ports.find(p => p.port_sequence === i)).map(p => ([
        p?.port_name || '',
        p?.quantity_at_loading_port ?? '',
        p?.eta_vessel_arrival || '',
        p?.ata_vessel_arrival || '',
        p?.eta_vessel_berthed || '',
        p?.ata_vessel_berthed || '',
        p?.eta_loading_start || '',
        p?.ata_loading_start || '',
        p?.eta_loading_completed || '',
        p?.ata_loading_completed || '',
        p?.eta_vessel_sailed || '',
        p?.ata_vessel_sailed || '',
        p?.loading_rate ?? ''
      ]).flat())

      // Use proper CSV escaping for all fields
      const base = [
        escapeCsvValue(s.sto_number || s.shipment_id),
        escapeCsvValue(s.contract_numbers || s.contract_number || ''),
        escapeCsvValue(s.status),
        escapeCsvValue(s.vessel_name),
        escapeCsvValue(s.vessel_code),
        escapeCsvValue(s.voyage_no),
        escapeCsvValue(s.vessel_owner),
        escapeCsvValue(s.vessel_draft ?? ''),
        escapeCsvValue(s.vessel_loa ?? ''),
        escapeCsvValue(s.vessel_capacity ?? ''),
        escapeCsvValue(s.vessel_hull_type),
        escapeCsvValue(s.charter_type),
        escapeCsvValue(s.vessel_oa_budget ?? ''),
        escapeCsvValue(s.vessel_oa_actual ?? ''),
        escapeCsvValue(s.estimated_km ?? ''),
        escapeCsvValue(s.estimated_nautical_miles ?? ''),
        escapeCsvValue(s.average_vessel_speed ?? ''),
        escapeCsvValue(s.port_of_loading),
        escapeCsvValue(s.port_of_discharge),
        escapeCsvValue(s.quantity_shipped),
        escapeCsvValue(s.quantity_delivered),
        escapeCsvValue(s.bl_quantity ?? ''),
        escapeCsvValue(s.actual_vessel_qty_receive ?? ''),
        escapeCsvValue(differenceValue),
        escapeCsvValue(s.inbound_weight),
        escapeCsvValue(s.outbound_weight),
        escapeCsvValue(s.gain_loss_percentage),
        escapeCsvValue(s.gain_loss_amount),
        escapeCsvValue(s.shipment_date ? String(s.shipment_date).substring(0,10) : ''),
        escapeCsvValue(s.arrival_date ? String(s.arrival_date).substring(0,10) : ''),
        escapeCsvValue(s.sla_days),
        s.is_delayed ? 'TRUE' : 'FALSE',
        escapeCsvValue(s.sap_delivery_id)
      ]

      // Escape loading port data
      const escapedLp = lp.flat().map(v => escapeCsvValue(v))

      rows.push([...base, ...escapedLp].join(','))
    }

    const csvContent = [headers.join(','), ...rows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const timestamp = new Date().toISOString().substring(0,10)
    link.setAttribute('download', `Shipments_Export_${timestamp}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote ("")
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // Field delimiter
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Push last field
    result.push(current.trim())
    return result
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = parseCsvLine(lines[0])
      
      // Debug: Log headers to help identify the issue
      console.log('CSV Headers found:', headers)
      
      let createCount = 0
      let updateCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i])
        if (values.length < 2) continue // At least need STO Number and one more field

        const row: any = {}
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || ''
        })

        // Support both old and new column names
        const stoNumber = row['STO Number'] || row['Shipment ID']
        const contractNumbers = row['Contract Numbers'] || row['Contract Number']
        
        // Debug: Log the first row to see what data we're getting
        if (i === 1) {
          console.log('First row data:', row)
          console.log('STO Number value:', stoNumber)
          console.log('Contract Numbers value:', contractNumbers)
        }
        
        if (!stoNumber) {
          errors.push(`Row ${i + 1}: Missing STO Number (found headers: ${headers.join(', ')})`)
          console.log(`Row ${i + 1} data:`, row)
          console.log(`Row ${i + 1} STO Number:`, stoNumber)
          console.log(`Row ${i + 1} Contract Numbers:`, contractNumbers)
          errorCount++
          continue
        }

        // Check if STO exists
        const existingShipment = shipments.find(s => s.sto_number === stoNumber)

        // Prepare shipment data
        const shipmentData = {
          stoNumber: stoNumber,
          contractNumbers: contractNumbers ? contractNumbers.split(',').map((c: string) => c.trim()).filter((c: string) => c) : [],
          vesselName: row['Vessel Name'] || '',
          vesselCode: row['Vessel Code'] || '',
          voyageNo: row['Voyage No'] || '',
          vesselOwner: row['Vessel Owner'] || '',
          vesselDraft: row['Vessel Draft (m)'] || '',
          vesselCapacity: row['Vessel Capacity (MT)'] || '',
          vesselHullType: row['Hull Type'] || '',
          charterType: row['Charter Type'] || '',
          portOfLoading: row['Port of Loading'] || '',
          portOfDischarge: row['Port of Discharge'] || '',
          quantityShipped: row['Quantity Shipped (MT)'] || '',
          shipmentDate: row['Shipment Date (YYYY-MM-DD)'] || '',
          arrivalDate: row['Arrival Date (YYYY-MM-DD)'] || ''
        }

        try {
          if (existingShipment) {
            // UPDATE existing shipment
            const updateData: any = {
              shipment_id: existingShipment.shipment_id // Add required shipment_id field
            }
        if (row['Status']) updateData.status = row['Status']
        if (row['Vessel Name']) updateData.vessel_name = row['Vessel Name']
        if (row['Vessel Code']) updateData.vessel_code = row['Vessel Code']
        if (row['Voyage No']) updateData.voyage_no = row['Voyage No']
            if (row['Vessel Owner']) updateData.vessel_owner = row['Vessel Owner']
            if (row['Vessel Draft (m)']) updateData.vessel_draft = parseFloat(row['Vessel Draft (m)'])
            if (row['Vessel Capacity (MT)']) updateData.vessel_capacity = parseFloat(row['Vessel Capacity (MT)'])
            if (row['Hull Type']) updateData.vessel_hull_type = row['Hull Type']
            if (row['Charter Type']) updateData.charter_type = row['Charter Type']
        if (row['Port of Loading']) updateData.port_of_loading = row['Port of Loading']
        if (row['Port of Discharge']) updateData.port_of_discharge = row['Port of Discharge']
        if (row['Quantity Shipped (MT)']) updateData.quantity_shipped = parseFloat(row['Quantity Shipped (MT)'])
        if (row['Quantity Delivered (MT)']) updateData.quantity_delivered = parseFloat(row['Quantity Delivered (MT)'])
        if (row['Shipment Date (YYYY-MM-DD)']) updateData.shipment_date = row['Shipment Date (YYYY-MM-DD)']
        if (row['Arrival Date (YYYY-MM-DD)']) updateData.arrival_date = row['Arrival Date (YYYY-MM-DD)']

            console.log(`Updating shipment ${existingShipment.id} with data:`, updateData)
            const response = await api.put(`/shipments/${existingShipment.id}`, updateData)
          if (response.data.success) {
              updateCount++
          } else {
              const errorMsg = response.data.error?.message || 'Update failed'
              errors.push(`Row ${i + 1}: ${errorMsg} for STO ${stoNumber}`)
              console.error(`Update failed for STO ${stoNumber}:`, response.data)
            errorCount++
          }
          } else {
            // CREATE new shipment
            if (!contractNumbers || shipmentData.contractNumbers.length === 0) {
              errors.push(`Row ${i + 1}: Missing Contract Numbers for new STO ${stoNumber}`)
          errorCount++
              continue
            }

            const response = await api.post('/shipments', shipmentData)
            if (response.data.success) {
              createCount++
            } else {
              errors.push(`Row ${i + 1}: ${response.data.error?.message || 'Create failed for STO ' + stoNumber}`)
              errorCount++
            }
          }
        } catch (error: any) {
          const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error'
          errors.push(`Row ${i + 1}: ${errorMsg}`)
          errorCount++
        }
      }

      // Show detailed results
      let message = `Bulk operation completed!\n\n`
      message += `✅ Created: ${createCount}\n`
      message += `✅ Updated: ${updateCount}\n`
      message += `❌ Failed: ${errorCount}`
      
      if (errors.length > 0 && errors.length <= 10) {
        message += `\n\nErrors:\n${errors.join('\n')}`
      } else if (errors.length > 10) {
        message += `\n\nShowing first 10 errors:\n${errors.slice(0, 10).join('\n')}`
      }

      alert(message)
      await fetchShipments() // Refresh the list
    } catch (error) {
      console.error('Bulk upload error:', error)
      alert('Failed to process bulk upload. Please check your CSV file format.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800'
      case 'IN_TRANSIT': return 'bg-yellow-100 text-yellow-800'
      case 'ARRIVED': return 'bg-purple-100 text-purple-800'
      case 'UNLOADING': return 'bg-orange-100 text-orange-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
    fetchShipments()
  }

  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = searchTerm === '' || 
      shipment.shipment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.vessel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.plant_site?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.port_of_discharge?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  // Fetch contract details for a shipment
  const fetchContractDetails = async (shipment: Shipment) => {
    if (!shipment.contract_numbers) return
    // Always fetch to get latest data, but skip if already loading
    if (loadingContractDetails[shipment.id]) return

    setLoadingContractDetails(prev => ({ ...prev, [shipment.id]: true }))
    try {
      const stoNumber = shipment.sto_number || shipment.shipment_id
      const contractNumbers = shipment.contract_numbers.split(', ').filter(c => c.trim())
      
      // Fetch contract details with STO quantity assigned from backend
      const response = await api.get(`/shipments/contracts/details?sto=${encodeURIComponent(stoNumber)}&contractNumbers=${contractNumbers.join(',')}`)
      
      if (response.data.success && response.data.data.length > 0) {
        const details = response.data.data.map((detail: any) => ({
          contract_number: detail.contract_number,
          contract_qty: detail.contract_qty || 0,
          outstanding_qty: detail.outstanding_qty || 0,
          sto_qty_assigned: detail.sto_qty_assigned || 0,
          po_number: detail.po_number || ''
        }))
        setContractDetailsMap(prev => ({ ...prev, [shipment.id]: details }))
      } else {
        // Fallback: fetch from contracts API if new endpoint doesn't return data
        const details = await Promise.all(
          contractNumbers.map(async (contractNumber) => {
            try {
              const contractResponse = await api.get(`/contracts?contract_id=${encodeURIComponent(contractNumber.trim())}&limit=1`)
              if (contractResponse.data.success && contractResponse.data.data.contracts.length > 0) {
                const contract = contractResponse.data.data.contracts[0]
                return {
                  contract_number: contractNumber.trim(),
                  contract_qty: contract.quantity_ordered || 0,
                  outstanding_qty: contract.outstanding_quantity || 0,
                  sto_qty_assigned: 0, // Will be 0 if not available
                  po_number: contract.po_numbers || contract.po_number || ''
                }
              }
            } catch (err) {
              console.error(`Error fetching contract ${contractNumber}:`, err)
            }
            return {
              contract_number: contractNumber.trim(),
              contract_qty: 0,
              outstanding_qty: 0,
              sto_qty_assigned: 0,
              po_number: ''
            }
          })
        )
        setContractDetailsMap(prev => ({ ...prev, [shipment.id]: details }))
      }
    } catch (error) {
      console.error('Error fetching contract details:', error)
      // Fallback on error
      const contractNumbers = shipment.contract_numbers.split(', ').filter(c => c.trim())
      const details = contractNumbers.map((contractNumber) => ({
        contract_number: contractNumber.trim(),
        contract_qty: 0,
        outstanding_qty: 0,
        sto_qty_assigned: 0,
        po_number: ''
      }))
      setContractDetailsMap(prev => ({ ...prev, [shipment.id]: details }))
    } finally {
      setLoadingContractDetails(prev => ({ ...prev, [shipment.id]: false }))
    }
  }

  // Update STO quantity assigned
  const handleUpdateStoQtyAssigned = async (shipmentId: string, contractNumber: string, stoNumber: string, newValue: number) => {
    const key = `${shipmentId}-${contractNumber}`
    setSavingStoQty(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.put('/shipments/contracts/sto-qty', {
        sto: stoNumber,
        contractNumber: contractNumber,
        stoQtyAssigned: newValue
      })
      
      // Update local state
      setContractDetailsMap(prev => {
        const details = prev[shipmentId] || []
        const updated = details.map(d => 
          d.contract_number === contractNumber 
            ? { ...d, sto_qty_assigned: newValue }
            : d
        )
        return { ...prev, [shipmentId]: updated }
      })
    } catch (error) {
      console.error('Error updating STO quantity assigned:', error)
      alert('Failed to update STO quantity assigned. Please try again.')
    } finally {
      setSavingStoQty(prev => ({ ...prev, [key]: false }))
    }
  }

  // Expand/Collapse functions
  const toggleExpanded = (id: string) => {
    setExpandedShipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Fetch contract details when expanding (for both single and multiple contracts)
        const shipment = sortedShipments.find(s => s.id === id)
        if (shipment && shipment.contract_numbers) {
          fetchContractDetails(shipment)
        }
      }
      return next
    })
  }

  const collapseAll = () => setExpandedShipmentIds(new Set())
  const expandAll = (ids: string[]) => setExpandedShipmentIds(new Set(ids))

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
    } catch {
      return '-'
    }
  }

  // Column visibility and sorting
  const columnStorageKey = 'shipments.compact.visibleColumns'
  const sortStorageKey = 'shipments.compact.sort'

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(columnStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Set(parsed)
      }
    } catch {}
    return new Set()
  })

  useEffect(() => {
    if (visibleColumnIds.size > 0) {
      localStorage.setItem(columnStorageKey, JSON.stringify(Array.from(visibleColumnIds)))
    }
  }, [visibleColumnIds])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(sortStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSortKey(parsed.key || 'created_at')
        setSortDir(parsed.dir || 'desc')
      }
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: sortDir }))
  }, [sortKey, sortDir])

  const toggleColumn = (colId: string) => {
    if (colId === 'shipment_id' || colId === 'status') return // Always visible
    setVisibleColumnIds(prev => {
      const next = new Set(prev)
      if (next.has(colId)) {
        next.delete(colId)
      } else {
        next.add(colId)
      }
      return next
    })
  }

  type CompactColumn = {
    id: string
    label: string
    defaultVisible: boolean
    sortable?: boolean
    getSortValue?: (s: Shipment) => string | number
    render: (s: Shipment) => React.ReactNode
    className?: string
    headerClassName?: string
  }

  const compactColumns: CompactColumn[] = useMemo(() => [
    {
      id: 'shipment_id',
      label: 'STO No',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.sto_number || s.shipment_id || '',
      render: (s) => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{s.sto_number || s.shipment_id}</div>
          <div className="text-xs text-gray-600 truncate">{s.vessel_name || '-'} • {s.contract_number || '-'}</div>
        </div>
      )
    },
    {
      id: 'status',
      label: 'Status',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.status || '',
      render: (s) => (
        <Badge className={getStatusColor(s.status)}>
          {s.status}
        </Badge>
      )
    },
    {
      id: 'contract_numbers',
      label: 'Contract Numbers',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.contract_numbers || s.contract_number || '',
      render: (s) => (
        <span className="text-sm truncate block" title={s.contract_numbers || s.contract_number || ''}>
          {s.contract_numbers || s.contract_number || '-'}
        </span>
      )
    },
    {
      id: 'po_numbers',
      label: 'PO No',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.po_numbers || '',
      render: (s) => (
        <span className="text-sm truncate block" title={s.po_numbers || ''}>
          {s.po_numbers || '-'}
        </span>
      )
    },
    {
      id: 'delivery_start',
      label: 'Delivery Start',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.delivery_start_date || '',
      render: (s) => <span className="text-sm">{formatShortDate(s.delivery_start_date || '')}</span>
    },
    {
      id: 'delivery_end',
      label: 'Delivery End',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.delivery_end_date || '',
      render: (s) => <span className="text-sm">{formatShortDate(s.delivery_end_date || '')}</span>
    },
    {
      id: 'vessel_name',
      label: 'Vessel Name',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.vessel_name || '',
      render: (s) => <span className="text-sm truncate">{s.vessel_name || '-'}</span>
    },
    {
      id: 'sto_quantity',
      label: 'STO Quantity',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.sto_quantity || s.total_quantity_shipped || s.quantity_shipped || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {formatNumber(s.sto_quantity || s.total_quantity_shipped || s.quantity_shipped)} MT
        </span>
      )
    },
    {
      id: 'incoterm',
      label: 'Incoterm',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.incoterm || '',
      render: (s) => <span className="text-sm truncate">{s.incoterm || '-'}</span>
    },
    {
      id: 'b2b_flag',
      label: 'B2B Flag',
      defaultVisible: true,
      sortable: true,
      getSortValue: (s) => s.b2b_flag || '',
      render: (s) => <span className="text-sm truncate">{s.b2b_flag || '-'}</span>
    },
    {
      id: 'port_of_loading',
      label: 'Port of Loading',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.port_of_loading || '',
      render: (s) => <span className="text-sm truncate">{s.port_of_loading || '-'}</span>
    },
    {
      id: 'port_of_discharge',
      label: 'Port of Discharge',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.port_of_discharge || s.plant_site || '',
      render: (s) => <span className="text-sm truncate">{s.port_of_discharge || s.plant_site || '-'}</span>
    },
    {
      id: 'quantity_shipped',
      label: 'Quantity Shipped',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.total_quantity_shipped || s.quantity_shipped || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {formatNumber(s.total_quantity_shipped || s.quantity_shipped)} MT
        </span>
      )
    },
    {
      id: 'shipment_date',
      label: 'Shipment Date',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.shipment_date || '',
      render: (s) => <span className="text-sm">{formatShortDate(s.shipment_date)}</span>
    },
    {
      id: 'arrival_date',
      label: 'Arrival Date',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.arrival_date || '',
      render: (s) => <span className="text-sm">{formatShortDate(s.arrival_date)}</span>
    },
    {
      id: 'voyage_no',
      label: 'Voyage No',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.voyage_no || '',
      render: (s) => <span className="text-sm">{s.voyage_no || '-'}</span>
    },
    {
      id: 'vessel_code',
      label: 'Vessel Code',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_code || '',
      render: (s) => <span className="text-sm">{s.vessel_code || '-'}</span>
    },
    {
      id: 'quantity_delivered',
      label: 'Quantity Delivered',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.total_quantity_delivered || s.quantity_delivered || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {formatNumber(s.total_quantity_delivered || s.quantity_delivered)} MT
        </span>
      )
    },
    {
      id: 'estimated_nautical_miles',
      label: 'Estimated NM',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.estimated_nautical_miles || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {formatNumber(s.estimated_nautical_miles)} NM
        </span>
      )
    },
    {
      id: 'vessel_draft',
      label: 'Vessel Draft',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_draft || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {s.vessel_draft ? `${formatNumber(s.vessel_draft)} m` : '-'}
        </span>
      )
    },
    {
      id: 'vessel_loa',
      label: 'Vessel LOA',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_loa || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {s.vessel_loa ? `${formatNumber(s.vessel_loa)} m` : '-'}
        </span>
      )
    },
    {
      id: 'vessel_capacity',
      label: 'Vessel Capacity',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_capacity || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {s.vessel_capacity ? `${formatNumber(s.vessel_capacity)} MT` : '-'}
        </span>
      )
    },
    {
      id: 'vessel_hull_type',
      label: 'Vessel Hull Type',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_hull_type || '',
      render: (s) => <span className="text-sm truncate">{s.vessel_hull_type || '-'}</span>
    },
    {
      id: 'vessel_registration_year',
      label: 'Vessel Registration Year',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.vessel_registration_year || 0,
      render: (s) => <span className="text-sm">{s.vessel_registration_year || '-'}</span>
    },
    {
      id: 'average_vessel_speed',
      label: 'Average Vessel Speed',
      defaultVisible: false,
      sortable: true,
      getSortValue: (s) => s.average_vessel_speed || 0,
      render: (s) => (
        <span className="text-sm truncate">
          {s.average_vessel_speed ? `${formatNumber(s.average_vessel_speed)} knots` : '-'}
        </span>
      )
    }
  ], [])

  const defaultVisibleColumnIds = useMemo(() => {
    return compactColumns.filter(c => c.defaultVisible).map(c => c.id)
  }, [compactColumns])

  useEffect(() => {
    if (visibleColumnIds.size === 0) {
      setVisibleColumnIds(new Set(defaultVisibleColumnIds))
    }
  }, [defaultVisibleColumnIds, visibleColumnIds.size])

  const visibleColumns = useMemo(() => {
    const visible = compactColumns.filter(c => visibleColumnIds.has(c.id))
    // Ensure shipment_id and status are always first
    const ordered = [
      ...visible.filter(c => c.id === 'shipment_id'),
      ...visible.filter(c => c.id === 'status'),
      ...visible.filter(c => c.id !== 'shipment_id' && c.id !== 'status')
    ]
    return ordered
  }, [compactColumns, visibleColumnIds])

  const sortedShipments = useMemo(() => {
    const col = compactColumns.find(c => c.id === sortKey)
    if (!col?.sortable || !col.getSortValue) return filteredShipments

    const sorted = [...filteredShipments].sort((a, b) => {
      const aVal = col.getSortValue!(a)
      const bVal = col.getSortValue!(b)
      const dirMul = sortDir === 'asc' ? 1 : -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dirMul
      }
      return String(aVal).localeCompare(String(bVal)) * dirMul
    })

    return sorted
  }, [compactColumns, filteredShipments, sortDir, sortKey])

  const allVisibleIds = useMemo(() => sortedShipments.map(s => s.id), [sortedShipments])
  const expandedCount = expandedShipmentIds.size
  const allExpanded = expandedCount > 0 && expandedCount === allVisibleIds.length

  // Sync scroll between top and bottom scrollbars
  useEffect(() => {
    const topEl = topScrollRef.current
    const bottomEl = bottomScrollRef.current
    if (!topEl || !bottomEl) return

    const handleTopScroll = () => {
      if (isSyncingScroll.current) return
      isSyncingScroll.current = true
      bottomEl.scrollLeft = topEl.scrollLeft
      setTimeout(() => { isSyncingScroll.current = false }, 50)
    }

    const handleBottomScroll = () => {
      if (isSyncingScroll.current) return
      isSyncingScroll.current = true
      topEl.scrollLeft = bottomEl.scrollLeft
      setTimeout(() => { isSyncingScroll.current = false }, 50)
    }

    topEl.addEventListener('scroll', handleTopScroll)
    bottomEl.addEventListener('scroll', handleBottomScroll)

    return () => {
      topEl.removeEventListener('scroll', handleTopScroll)
      bottomEl.removeEventListener('scroll', handleBottomScroll)
    }
  }, [visibleColumns, sortedShipments.length])

  // Update table scroll width when content changes
  useEffect(() => {
    const bottomEl = bottomScrollRef.current
    if (bottomEl) {
      setTableScrollWidth(bottomEl.scrollWidth)
    }
  }, [visibleColumns, sortedShipments.length])

  // Vessel loading port functions
  const fetchLoadingPorts = async (shipmentId: string) => {
    try {
      const response = await api.get(`/shipments/${shipmentId}/loading-ports`)
      if (response.data.success) {
        // Handle new response structure: { ports: [], shipmentInfo: {} }
        if (response.data.data.ports) {
          setLoadingPorts(response.data.data.ports)
          setShipmentInfo(response.data.data.shipmentInfo)
        } else {
          // Fallback for old response structure (array)
          setLoadingPorts(response.data.data || [])
          setShipmentInfo(null)
        }
      }
    } catch (error) {
      console.error('Error fetching loading ports:', error)
    }
  }

  const handleViewLoadingPorts = async (shipment: Shipment) => {
    setSelectedShipment(shipment)
    setShowLoadingPorts(true)
    await fetchLoadingPorts(shipment.id)
  }

  const handleSaveLoadingPort = async () => {
    if (!selectedShipment) return

    try {
      const portData = editingPort || newPort
      const response = await api.post(`/shipments/${selectedShipment.id}/loading-ports`, portData)
      
      if (response.data.success) {
        await fetchLoadingPorts(selectedShipment.id)
        setEditingPort(null)
        setNewPort({
          port_name: '',
          port_sequence: loadingPorts.length + 1,
          quantity_at_loading_port: 0,
          eta_vessel_arrival: '',
          ata_vessel_arrival: '',
          eta_vessel_berthed: '',
          ata_vessel_berthed: '',
          eta_loading_start: '',
          ata_loading_start: '',
          eta_loading_completed: '',
          ata_loading_completed: '',
          eta_vessel_sailed: '',
          ata_vessel_sailed: '',
          loading_rate: 0,
          is_discharge_port: false
        })
        alert('Loading port saved successfully!')
      }
    } catch (error) {
      console.error('Error saving loading port:', error)
      alert('Failed to save loading port')
    }
  }

  const handleDeleteLoadingPort = async (portId: string) => {
    if (!selectedShipment) return

    try {
      const response = await api.delete(`/shipments/${selectedShipment.id}/loading-ports/${portId}`)
      if (response.data.success) {
        await fetchLoadingPorts(selectedShipment.id)
        alert('Loading port deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting loading port:', error)
      alert('Failed to delete loading port')
    }
  }

  // Document functions
  const handleUploadFileChange = async (shipment: Shipment, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      alert('Only PDF, PNG, or JPEG files are allowed.')
      e.target.value = ''
      return
    }

    setUploadingId(shipment.id)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('document_type', 'OTHER')
      form.append('shipment_id', shipment.id)

      const res = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data?.success) {
        alert('Document uploaded successfully!')
        if (selectedShipment && selectedShipment.id === shipment.id) {
          await fetchShipmentDocuments(shipment.id)
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

  const fetchShipmentDocuments = async (shipmentInternalId: string) => {
    try {
      setDocsLoading(true)
      const params = new URLSearchParams()
      params.append('shipmentId', shipmentInternalId)
      const res = await api.get(`/documents?${params.toString()}`)
      const docs: DocumentItem[] = res.data?.data || []
      setShipmentDocs(docs)
    } catch (err) {
      console.error('Fetch documents error:', err)
      setShipmentDocs([])
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

  const handleViewDocuments = async (shipment: Shipment) => {
    setSelectedShipment(shipment)
    setShowDocs(true)
    await fetchShipmentDocuments(shipment.id)
  }

  // Add new shipment functions
  const handleStoNumberChange = async (stoNumber: string) => {
    setNewShipment(prev => ({ ...prev, stoNumber }))
    
    if (stoNumber.length >= 3) {
      try {
        const response = await api.get(`/shipments/check-sto/${stoNumber}`)
        if (response.data.success) {
          if (response.data.exists) {
            setStoValidation({
              exists: true,
              message: `STO Number ${stoNumber} already exists with contracts: ${response.data.data.contract_numbers}`
            })
          } else {
            setStoValidation({
              exists: false,
              message: `STO Number ${stoNumber} is available`
            })
          }
        }
      } catch (error) {
        console.error('Error checking STO:', error)
        setStoValidation(null)
      }
    } else {
      setStoValidation(null)
    }
  }

  const handleContractSearch = async (searchTerm: string) => {
    setContractSearchTerm(searchTerm)
    
    if (searchTerm.length >= 2) {
      try {
        const response = await api.get(`/shipments/contracts/suggestions?q=${encodeURIComponent(searchTerm)}`)
        if (response.data.success) {
          setContractSuggestions(response.data.data)
          setShowContractSuggestions(true)
        }
      } catch (error) {
        console.error('Error fetching contract suggestions:', error)
        setContractSuggestions([])
      }
    } else {
      setContractSuggestions([])
      setShowContractSuggestions(false)
    }
  }

  const handleAddContract = (contract: any) => {
    if (!newShipment.contractNumbers.includes(contract.contract_id)) {
      setNewShipment(prev => ({
        ...prev,
        contractNumbers: [...prev.contractNumbers, contract.contract_id]
      }))
    }
    setContractSearchTerm('')
    setShowContractSuggestions(false)
  }

  const handleRemoveContract = (contractId: string) => {
    setNewShipment(prev => ({
      ...prev,
      contractNumbers: prev.contractNumbers.filter(id => id !== contractId)
    }))
  }

  const handleCreateShipment = async () => {
    if (!newShipment.stoNumber || newShipment.contractNumbers.length === 0) {
      alert('Please fill in STO Number and at least one Contract Number')
      return
    }

    if (stoValidation?.exists) {
      alert('STO Number already exists. Please update the existing shipment instead.')
      return
    }

    try {
      setSaving(true)
      const response = await api.post('/shipments', newShipment)
      
      if (response.data.success) {
        alert('Shipment created successfully!')
        setShowAddShipment(false)
        setNewShipment({
          stoNumber: '',
          contractNumbers: [],
          vesselName: '',
          vesselCode: '',
          voyageNo: '',
          vesselOwner: '',
          vesselDraft: '',
          vesselCapacity: '',
          vesselHullType: '',
          charterType: '',
          portOfLoading: '',
          portOfDischarge: '',
          quantityShipped: '',
          shipmentDate: '',
          arrivalDate: ''
        })
        setStoValidation(null)
        await fetchShipments() // Refresh the list
      } else {
        alert(response.data.error?.message || 'Failed to create shipment')
      }
    } catch (error: any) {
      console.error('Error creating shipment:', error)
      const errorMsg = error.response?.data?.error?.message || 'Failed to create shipment'
      const errorDetails = error.response?.data?.error?.details
      alert(errorMsg + (errorDetails ? `\n\nDetails: ${errorDetails}` : ''))
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const getColumnWidth = (colId: string): string => {
    const widths: { [key: string]: string } = {
      'shipment_id': '200px',
      'status': '120px',
      'contract_numbers': '180px',
      'po_numbers': '150px',
      'delivery_start': '120px',
      'delivery_end': '120px',
      'vessel_name': '180px',
      'sto_quantity': '140px',
      'incoterm': '120px',
      'b2b_flag': '100px',
      'port_of_loading': '160px',
      'port_of_discharge': '160px',
      'quantity_shipped': '140px',
      'shipment_date': '120px',
      'arrival_date': '120px',
      'voyage_no': '120px',
      'vessel_code': '120px',
      'quantity_delivered': '140px'
    }
    return widths[colId] || '150px'
  }

  const onSortHeaderClick = (col: CompactColumn) => {
    if (!col.sortable) return
    if (sortKey === col.id) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col.id)
      setSortDir('asc')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold">Shipments</h1>
            <p className="text-gray-600 mt-1">
              Manage and track all shipments - {filteredShipments.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddShipment(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Shipment
            </Button>
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button
              onClick={exportFilteredData}
              variant="outline"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <>
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkUpload}
                className="hidden"
                disabled={uploading}
                id="bulk-upload-input"
              />
              <Button
                onClick={() => document.getElementById('bulk-upload-input')?.click()}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
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
            </>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by Shipment ID, Contract, Vessel, or Supplier..."
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
                <option value="IN_TRANSIT">In Transit</option>
                <option value="ARRIVED">Arrived</option>
                <option value="UNLOADING">Unloading</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <Input
                placeholder="Filter by vessel name..."
                value={vesselFilter}
                onChange={(e) => setVesselFilter(e.target.value)}
                className="w-48"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Shipment Date:</span>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                <span className="text-gray-500">to</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button onClick={handleFilterChange} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Apply
              </Button>
              {(statusFilter !== 'ALL' || vesselFilter || dateFrom || dateTo) && (
                <Button 
                  onClick={() => {
                    setStatusFilter('ALL')
                    setVesselFilter('')
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

        {/* Shipments List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>All Shipments</CardTitle>
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
                          .filter(c => c.id !== 'shipment_id' && c.id !== 'status')
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
                  disabled={loading || sortedShipments.length === 0}
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
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading shipments...</div>
            ) : sortedShipments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p>No shipments found</p>
                {searchTerm && <p className="text-sm mt-2">Try adjusting your search filters</p>}
              </div>
            ) : (
              <>
                {/* Desktop compact table */}
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
                        {sortedShipments.map((shipment, idx) => {
                          const isEditing = editingId === shipment.id
                          return (
                            <div key={shipment.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <div className="px-3 py-2">
                                <div
                                  className="grid gap-3 items-center"
                                  style={{
                                    gridTemplateColumns: `28px ${visibleColumns.map(c => getColumnWidth(c.id)).join(' ')} 320px`
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(shipment.id)}
                                    className="p-1 text-gray-500 hover:text-gray-800"
                                    title={expandedShipmentIds.has(shipment.id) ? 'Collapse' : 'Expand'}
                                  >
                                    {expandedShipmentIds.has(shipment.id) ? (
                                      <ChevronDown className="h-5 w-5" />
                                    ) : (
                                      <ChevronRight className="h-5 w-5" />
                                    )}
                                  </button>

                                  {visibleColumns.map(col => (
                                    <div key={col.id} className="min-w-0">
                                      {col.id === 'vessel_name' && isEditing ? (
                                        <Input
                                          value={editedData.vessel_name ?? shipment.vessel_name ?? ''}
                                          onChange={(e) => handleFieldChange('vessel_name', e.target.value)}
                                          className="h-8 text-sm"
                                          placeholder="Vessel Name"
                                        />
                                      ) : (
                                        col.render(shipment)
                                      )}
                                    </div>
                                  ))}

                                  <div className="flex items-center justify-end gap-2 sticky right-0 bg-white border-l pl-3 pr-2 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
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
                                          onClick={() => handleSave(shipment.id)}
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
                                          onClick={() => handleEdit(shipment)}
                                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                        >
                                          <Edit2 className="h-4 w-4 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleViewLoadingPorts(shipment)}
                                          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                        >
                                          <Ship className="h-4 w-4 mr-1" />
                                          Ports
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleViewDocuments(shipment)}
                                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                        >
                                          <Package className="h-4 w-4 mr-1" />
                                          Docs
                                        </Button>
                                        <input
                                          id={`shipment-file-${shipment.id}`}
                                          type="file"
                                          accept="application/pdf,image/png,image/jpeg"
                                          className="hidden"
                                          onChange={(e) => handleUploadFileChange(shipment, e)}
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => document.getElementById(`shipment-file-${shipment.id}`)?.click()}
                                          disabled={uploadingId === shipment.id}
                                          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                        >
                                          {uploadingId === shipment.id ? (
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

                                {/* Expanded Details */}
                                {expandedShipmentIds.has(shipment.id) && (
                                  <div className="mt-3 p-3 border rounded bg-white">
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4 pb-4 border-b">
                                      <div>
                                        <div className="text-gray-500">Source</div>
                                        <div className="font-medium">{shipment.source_type || shipment.supplier || '-'}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Buyer</div>
                                        <div className="font-medium">{shipment.buyer || shipment.buyers || '-'}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Group Name</div>
                                        <div className="font-medium">{shipment.group_name || shipment.group_names || '-'}</div>
                                      </div>
                                    </div>

                                    {/* Contract Details */}
                                    {contractDetailsMap[shipment.id] && contractDetailsMap[shipment.id].length > 0 ? (
                                      <div className="space-y-3">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Contract Details ({shipment.contract_count} contracts)</div>
                                        {contractDetailsMap[shipment.id].map((detail, idx) => (
                                          <div key={idx} className="border rounded p-3 bg-gray-50">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                              <div>
                                                <div className="text-gray-500">Contract Number</div>
                                                <div className="font-medium">{detail.contract_number}</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Contract Qty</div>
                                                <div className="font-medium">{formatNumber(detail.contract_qty)} MT</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Outstanding Qty</div>
                                                <div className={`font-medium ${detail.outstanding_qty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                  {formatNumber(detail.outstanding_qty)} MT
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500 mb-1">Contract Qty assign to STO</div>
                                                <div className="flex items-center gap-2">
                                                  <Input
                                                    type="number"
                                                    value={detail.sto_qty_assigned || 0}
                                                    onChange={(e) => {
                                                      const newValue = parseFloat(e.target.value) || 0
                                                      const stoNumber = shipment.sto_number || shipment.shipment_id
                                                      handleUpdateStoQtyAssigned(shipment.id, detail.contract_number, stoNumber, newValue)
                                                    }}
                                                    className="h-8 text-sm w-32"
                                                    disabled={savingStoQty[`${shipment.id}-${detail.contract_number}`]}
                                                  />
                                                  <span className="text-sm text-gray-500">MT</span>
                                                  {savingStoQty[`${shipment.id}-${detail.contract_number}`] && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Contract Details</div>
                                        <div className="border rounded p-3 bg-gray-50">
                                          {contractDetailsMap[shipment.id] && contractDetailsMap[shipment.id].length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                              <div>
                                                <div className="text-gray-500">Contract Number</div>
                                                <div className="font-medium">{contractDetailsMap[shipment.id][0].contract_number}</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Contract Qty</div>
                                                <div className="font-medium">{formatNumber(contractDetailsMap[shipment.id][0].contract_qty)} MT</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Outstanding Qty</div>
                                                <div className={`font-medium ${contractDetailsMap[shipment.id][0].outstanding_qty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                  {formatNumber(contractDetailsMap[shipment.id][0].outstanding_qty)} MT
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500 mb-1">Contract Qty assign to STO</div>
                                                <div className="flex items-center gap-2">
                                                  <Input
                                                    type="number"
                                                    value={contractDetailsMap[shipment.id][0].sto_qty_assigned || 0}
                                                    onChange={(e) => {
                                                      const newValue = parseFloat(e.target.value) || 0
                                                      const stoNumber = shipment.sto_number || shipment.shipment_id
                                                      handleUpdateStoQtyAssigned(shipment.id, contractDetailsMap[shipment.id][0].contract_number, stoNumber, newValue)
                                                    }}
                                                    className="h-8 text-sm w-32"
                                                    disabled={savingStoQty[`${shipment.id}-${contractDetailsMap[shipment.id][0].contract_number}`]}
                                                  />
                                                  <span className="text-sm text-gray-500">MT</span>
                                                  {savingStoQty[`${shipment.id}-${contractDetailsMap[shipment.id][0].contract_number}`] && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                              <div>
                                                <div className="text-gray-500">Contract Numbers</div>
                                                <div className="font-medium">{shipment.contract_numbers || shipment.contract_number || '-'}</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Contract Qty</div>
                                                <div className="font-medium">-</div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500">Outstanding Qty</div>
                                                <div className="font-medium">-</div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {loadingContractDetails[shipment.id] && (
                                      <div className="text-center py-2 text-sm text-gray-500">
                                        <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                                        Loading contract details...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile/tablet cards */}
                <div className="lg:hidden space-y-2">
                  {sortedShipments.map((shipment) => {
                    const isEditing = editingId === shipment.id
                    return (
                      <div
                        key={shipment.id}
                        className={`border rounded-lg transition-colors ${isEditing ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(shipment.id)}
                                className="p-1 text-gray-500 hover:text-gray-800"
                                title={expandedShipmentIds.has(shipment.id) ? 'Collapse' : 'Expand'}
                              >
                                {expandedShipmentIds.has(shipment.id) ? (
                                  <ChevronDown className="h-5 w-5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{shipment.sto_number || shipment.shipment_id}</div>
                                <div className="text-xs text-gray-600 truncate">{shipment.vessel_name || '-'} • {shipment.contract_number || '-'}</div>
                              </div>
                              <Badge className={getStatusColor(shipment.status)}>
                                {shipment.status}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {isEditing ? (
                                <>
                                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => handleSave(shipment.id)} disabled={saving} className="bg-green-600 hover:bg-green-700">
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
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(shipment)} className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                                    <Edit2 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleViewLoadingPorts(shipment)} className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                                    <Ship className="h-4 w-4 mr-1" />
                                    Ports
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleViewDocuments(shipment)} className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                                    <Package className="h-4 w-4 mr-1" />
                                    Docs
                                  </Button>
                                  <input
                                    id={`shipment-file-${shipment.id}`}
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    className="hidden"
                                    onChange={(e) => handleUploadFileChange(shipment, e)}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById(`shipment-file-${shipment.id}`)?.click()}
                                    disabled={uploadingId === shipment.id}
                                    className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                  >
                                    {uploadingId === shipment.id ? (
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

                          {/* Expanded Details */}
                          {expandedShipmentIds.has(shipment.id) && (
                            <div className="mt-4">
                              {/* Basic Info */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4 pb-4 border-b">
                                <div>
                                  <div className="text-gray-500">Source</div>
                                  <div className="font-medium">{shipment.source_type || shipment.supplier || '-'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Buyer</div>
                                  <div className="font-medium">{shipment.buyer || shipment.buyers || '-'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Group Name</div>
                                  <div className="font-medium">{shipment.group_name || shipment.group_names || '-'}</div>
                                </div>
                              </div>

                              {/* Contract Details */}
                              {contractDetailsMap[shipment.id] && contractDetailsMap[shipment.id].length > 0 ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-gray-700 mb-2">Contract Details ({shipment.contract_count} contracts)</div>
                                  {contractDetailsMap[shipment.id].map((detail, idx) => (
                                    <div key={idx} className="border rounded p-3 bg-gray-50">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <div className="text-gray-500">Contract Number</div>
                                          <div className="font-medium">{detail.contract_number}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Contract Qty</div>
                                          <div className="font-medium">{formatNumber(detail.contract_qty)} MT</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Outstanding Qty</div>
                                          <div className={`font-medium ${detail.outstanding_qty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                            {formatNumber(detail.outstanding_qty)} MT
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 mb-1">Contract Qty assign to STO</div>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="number"
                                              value={detail.sto_qty_assigned || 0}
                                              onChange={(e) => {
                                                const newValue = parseFloat(e.target.value) || 0
                                                const stoNumber = shipment.sto_number || shipment.shipment_id
                                                handleUpdateStoQtyAssigned(shipment.id, detail.contract_number, stoNumber, newValue)
                                              }}
                                              className="h-8 text-sm w-32"
                                              disabled={savingStoQty[`${shipment.id}-${detail.contract_number}`]}
                                            />
                                            <span className="text-sm text-gray-500">MT</span>
                                            {savingStoQty[`${shipment.id}-${detail.contract_number}`] && (
                                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-gray-700 mb-2">Contract Details</div>
                                  <div className="border rounded p-3 bg-gray-50">
                                    {contractDetailsMap[shipment.id] && contractDetailsMap[shipment.id].length > 0 ? (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <div className="text-gray-500">Contract Number</div>
                                          <div className="font-medium">{contractDetailsMap[shipment.id][0].contract_number}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Contract Qty</div>
                                          <div className="font-medium">{formatNumber(contractDetailsMap[shipment.id][0].contract_qty)} MT</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Outstanding Qty</div>
                                          <div className={`font-medium ${contractDetailsMap[shipment.id][0].outstanding_qty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                            {formatNumber(contractDetailsMap[shipment.id][0].outstanding_qty)} MT
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 mb-1">Contract Qty assign to STO</div>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="number"
                                              value={contractDetailsMap[shipment.id][0].sto_qty_assigned || 0}
                                              onChange={(e) => {
                                                const newValue = parseFloat(e.target.value) || 0
                                                const stoNumber = shipment.sto_number || shipment.shipment_id
                                                handleUpdateStoQtyAssigned(shipment.id, contractDetailsMap[shipment.id][0].contract_number, stoNumber, newValue)
                                              }}
                                              className="h-8 text-sm w-32"
                                              disabled={savingStoQty[`${shipment.id}-${contractDetailsMap[shipment.id][0].contract_number}`]}
                                            />
                                            <span className="text-sm text-gray-500">MT</span>
                                            {savingStoQty[`${shipment.id}-${contractDetailsMap[shipment.id][0].contract_number}`] && (
                                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <div className="text-gray-500">Contract Numbers</div>
                                          <div className="font-medium">{shipment.contract_numbers || shipment.contract_number || '-'}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Contract Qty</div>
                                          <div className="font-medium">-</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500">Outstanding Qty</div>
                                          <div className="font-medium">-</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {loadingContractDetails[shipment.id] && (
                                <div className="text-center py-2 text-sm text-gray-500">
                                  <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                                  Loading contract details...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading Ports Modal */}
      {showLoadingPorts && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-6xl rounded-lg shadow-lg p-6 my-4 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Vessel Loading Ports — {selectedShipment.vessel_name || selectedShipment.shipment_id}</h3>
              <Button variant="ghost" onClick={() => setShowLoadingPorts(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {/* Shipment-Level Information */}
              {shipmentInfo && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-sm mb-3">Shipment Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Quantity Delivery</div>
                      <div className="font-medium">{formatNumber(shipmentInfo.quantity_delivered)} MT</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Quantity Receive</div>
                      <div className="font-medium">{formatNumber(shipmentInfo.actual_vessel_qty_receive)} MT</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Vessel Loading Port 1</div>
                      <div className="font-medium">{shipmentInfo.vessel_loading_port_1 || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Vessel OA Actual</div>
                      <div className="font-medium">{formatNumber(shipmentInfo.vessel_oa_actual)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Vessel OA Budget</div>
                      <div className="font-medium">{formatNumber(shipmentInfo.vessel_oa_budget)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">B/L Quantity</div>
                      <div className="font-medium">{formatNumber(shipmentInfo.bl_quantity)} MT</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Arrival at Loading Port</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_arrival_at_loading_port)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Berthed at Loading Port</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_berthed_at_loading_port)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Start Loading</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_start_loading)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Completed Loading</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_completed_loading)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Sailed from Loading Port</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_sailed_from_loading_port)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Arrive at Discharge Port</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_arrive_at_discharge_port)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Berthed at Discharge Port</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_berthed_at_discharge_port)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Start Discharging</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_start_discharging)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">ATA Vessel Complete Discharge</div>
                      <div className="font-medium">{formatDateTime(shipmentInfo.ata_vessel_complete_discharge)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Ports List */}
              <div
                className={[
                  'border rounded-lg flex flex-col min-h-0',
                  portsListExpanded ? 'flex-1' : 'flex-none'
                ].join(' ')}
              >
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
                  onClick={() => setPortsListExpanded(!portsListExpanded)}
                >
                  <h4 className="font-semibold text-sm">Vessel Loading Port Information</h4>
                  {portsListExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                {portsListExpanded && (
                <div className="space-y-3 overflow-auto p-4 flex-1 min-h-0">
                {loadingPorts.length === 0 ? (
                  <div className="text-gray-500">No loading ports yet.</div>
                ) : (
                  loadingPorts.map((port) => {
                    const quantityLabel = port.is_discharge_port ? 'Received Quantity (MT)' : 'Quantity at Loading Port (MT)'
                    const rateLabel = port.is_discharge_port ? 'Discharge Rate (MT/hour)' : 'Loading Rate (MT/hour)'
                    // Determine quality label prefix based on port location
                    const qualityPrefix = port.is_discharge_port 
                      ? 'Quality at Discharge Port'
                      : port.port_sequence === 1
                        ? 'Quality at Loading Loc 1'
                        : port.port_sequence === 2
                          ? 'Quality at Loading Loc 2'
                          : port.port_sequence === 3
                            ? 'Quality at Loading Loc 3'
                            : `Quality at Loading Loc ${port.port_sequence}`
                    const qualityValues: Array<[string, number | null | undefined]> = [
                      [`${qualityPrefix} FFA`, port.quality_ffa],
                      [`${qualityPrefix} M&I`, port.quality_mi],
                      [`${qualityPrefix} DOBI`, port.quality_dobi],
                      [`${qualityPrefix} RED`, port.quality_red],
                      [`${qualityPrefix} D&S`, port.quality_ds],
                      [`${qualityPrefix} Stone`, port.quality_stone]
                    ]
                    const hasQuality = qualityValues.some(([, value]) => value !== null && value !== undefined)

                    return (
                      <div key={port.id ?? `${port.port_name}-${port.port_sequence}`} className="border rounded-md p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">
                                {port.is_discharge_port
                                  ? `Discharge Port — ${port.port_name || '-'}`
                                  : `${port.port_sequence}. ${port.port_name || '-'}`}
                              </div>
                              {port.is_discharge_port && (
                                <Badge className="bg-amber-100 text-amber-700">Discharge</Badge>
                              )}
                            </div>
                            {port.contract_number && (
                              <div className="text-xs text-gray-500 mt-1">Contract: {port.contract_number}</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPort(port)
                                setAddPortExpanded(true)
                              }}
                            >
                              Edit
                            </Button>
                            {port.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteLoadingPort(port.id!)}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500">{quantityLabel}</div>
                            <div className="font-medium">
                              {port.quantity_at_loading_port !== null && port.quantity_at_loading_port !== undefined
                                ? formatNumber(port.quantity_at_loading_port)
                                : '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">ETA Vessel Arrival</div>
                            <div className="font-medium">{formatDateTime(port.eta_vessel_arrival)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ATA Vessel Arrival</div>
                            <div className="font-medium">{formatDateTime(port.ata_vessel_arrival)}</div>
                          </div>

                          <div>
                            <div className="text-gray-500">ETA Vessel Berthed</div>
                            <div className="font-medium">{formatDateTime(port.eta_vessel_berthed)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ATA Vessel Berthed</div>
                            <div className="font-medium">{formatDateTime(port.ata_vessel_berthed)}</div>
                          </div>

                          <div>
                            <div className="text-gray-500">ETA Loading Start</div>
                            <div className="font-medium">{formatDateTime(port.eta_loading_start)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ATA Loading Start</div>
                            <div className="font-medium">{formatDateTime(port.ata_loading_start)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ETA Loading Completed</div>
                            <div className="font-medium">{formatDateTime(port.eta_loading_completed)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ATA Loading Completed</div>
                            <div className="font-medium">{formatDateTime(port.ata_loading_completed)}</div>
                          </div>

                          <div>
                            <div className="text-gray-500">ETA Vessel Sailed</div>
                            <div className="font-medium">{formatDateTime(port.eta_vessel_sailed)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">ATA Vessel Sailed</div>
                            <div className="font-medium">{formatDateTime(port.ata_vessel_sailed)}</div>
                          </div>

                          <div>
                            <div className="text-gray-500">{rateLabel}</div>
                            <div className="font-semibold text-blue-700">
                              {port.loading_rate !== null && port.loading_rate !== undefined ? formatNumber(port.loading_rate) : '-'}
                            </div>
                            {!port.is_discharge_port && (
                              <div className="text-xs text-gray-500 mt-1">Formula: (ATA Loading Completed - ATA Loading Start) / Quantity</div>
                            )}
                          </div>
                        </div>

                        {hasQuality && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-3 border-t pt-3">
                            {qualityValues.map(([label, value]) => (
                              <div key={label}>
                                <div className="text-gray-500">{label}</div>
                                <div className="font-medium">{value !== null && value !== undefined ? formatNumber(value) : '-'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                </div>
                )}
              </div>

              {/* Add / Edit Loading Port */}
              <div
                className={[
                  'border rounded-lg flex flex-col min-h-0',
                  addPortExpanded ? 'flex-1' : 'flex-none'
                ].join(' ')}
              >
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 rounded-t-lg"
                  onClick={() => setAddPortExpanded(!addPortExpanded)}
                >
                  <h4 className="font-semibold text-sm">{editingPort ? 'Edit Loading Port' : 'Add Loading Port'}</h4>
                  {addPortExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                {addPortExpanded && (
                <div className="p-4 overflow-auto flex-1 min-h-0">
                  {editingPort && (
                    <div className="flex items-center justify-end mb-3">
                      <Button variant="ghost" onClick={() => setEditingPort(null)}>
                        <X className="h-4 w-4 mr-1" /> Cancel Edit
                      </Button>
                    </div>
                  )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Port Name</div>
                  <Input
                    value={(editingPort?.port_name ?? newPort.port_name) as string}
                    onChange={(e) => editingPort ? setEditingPort({ ...editingPort!, port_name: e.target.value }) : setNewPort({ ...newPort, port_name: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="e.g., Loading Port 1"
                  />
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Sequence</div>
                  <Input
                    type="number"
                    value={(editingPort?.port_sequence ?? newPort.port_sequence) as number}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '1')
                      if (editingPort) setEditingPort({ ...editingPort!, port_sequence: v })
                      else setNewPort({ ...newPort, port_sequence: v })
                    }}
                    className="h-8 text-sm"
                    min={1}
                  />
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Quantity (MT)</div>
                  <Input
                    type="number"
                    value={(editingPort?.quantity_at_loading_port ?? newPort.quantity_at_loading_port) as number}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value || '0')
                      if (editingPort) setEditingPort({ ...editingPort!, quantity_at_loading_port: v })
                      else setNewPort({ ...newPort, quantity_at_loading_port: v })
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Loading Rate (MT/hour)</div>
                  <Input
                    type="number"
                    step="0.01"
                    value={(editingPort?.loading_rate ?? newPort.loading_rate) as number}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value || '0')
                      if (editingPort) setEditingPort({ ...editingPort!, loading_rate: v })
                      else setNewPort({ ...newPort, loading_rate: v })
                    }}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="col-span-full">
                  <div className="text-gray-500 mb-2 font-medium">Date & Time Fields</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ['ETA Vessel Arrival', 'eta_vessel_arrival'],
                  ['ATA Vessel Arrival', 'ata_vessel_arrival'],
                  ['ETA Vessel Berthed', 'eta_vessel_berthed'],
                  ['ATA Vessel Berthed', 'ata_vessel_berthed'],
                  ['ETA Loading Start', 'eta_loading_start'],
                  ['ATA Loading Start', 'ata_loading_start'],
                  ['ETA Loading Completed', 'eta_loading_completed'],
                  ['ATA Loading Completed', 'ata_loading_completed'],
                  ['ETA Vessel Sailed', 'eta_vessel_sailed'],
                  ['ATA Vessel Sailed', 'ata_vessel_sailed']
                ].map(([label, key]) => (
                  <div key={key as string}>
                    <div className="text-gray-500 mb-1">{label}</div>
                    <Input
                      type="datetime-local"
                      value={(
                        ((editingPort as any)?.[key] ?? (newPort as any)[key]) 
                          ? String(((editingPort as any)?.[key] ?? (newPort as any)[key])).slice(0, 16)
                          : ''
                      )}
                      onChange={(e) => {
                        const v = e.target.value
                        if (editingPort) setEditingPort({ ...(editingPort as any), [key]: v } as any)
                        else setNewPort({ ...(newPort as any), [key]: v } as any)
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingPort(null)
                    setNewPort({
                      port_name: '',
                      port_sequence: loadingPorts.length + 1,
                      quantity_at_loading_port: 0,
                      eta_vessel_arrival: '',
                      ata_vessel_arrival: '',
                      eta_vessel_berthed: '',
                      ata_vessel_berthed: '',
                      eta_loading_start: '',
                      ata_loading_start: '',
                      eta_loading_completed: '',
                      ata_loading_completed: '',
                      eta_vessel_sailed: '',
                      ata_vessel_sailed: '',
                      loading_rate: 0,
                      is_discharge_port: false
                    })
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button onClick={handleSaveLoadingPort} className="bg-green-600 hover:bg-green-700">
                  {false ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Loading Port
                </Button>
              </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocs && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Documents — {selectedShipment.vessel_name || selectedShipment.shipment_id}</h3>
              <Button variant="ghost" onClick={() => setShowDocs(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {docsLoading ? (
              <div className="text-sm text-gray-500 py-8 text-center">Loading documents...</div>
            ) : shipmentDocs.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No documents uploaded for this shipment.</div>
            ) : (
              <div className="space-y-2">
                {shipmentDocs.map((doc) => (
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

      {/* Add New Shipment Modal */}
      {showAddShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Add New Shipment</h3>
              <Button variant="ghost" onClick={() => setShowAddShipment(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Form Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Required:</strong> STO Number and at least one Contract Number<br/>
                  <strong>Optional:</strong> Port of Loading, Plant/Site (Discharge Port), Shipment Date, and Arrival Date
                </p>
              </div>

              {/* STO Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  STO Number *
                </label>
                <Input
                  value={newShipment.stoNumber}
                  onChange={(e) => handleStoNumberChange(e.target.value)}
                  placeholder="Enter STO Number"
                  className="w-full"
                />
                {stoValidation && (
                  <div className={`mt-2 text-sm ${stoValidation.exists ? 'text-red-600' : 'text-green-600'}`}>
                    {stoValidation.message}
                  </div>
                )}
              </div>

              {/* Contract Numbers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Numbers *
                </label>
                <div className="relative">
                  <Input
                    value={contractSearchTerm}
                    onChange={(e) => handleContractSearch(e.target.value)}
                    onFocus={() => setShowContractSuggestions(true)}
                    placeholder="Search and add contract numbers"
                    className="w-full"
                  />
                  {showContractSuggestions && contractSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {contractSuggestions.map((contract) => (
                        <div
                          key={contract.contract_id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b"
                          onClick={() => handleAddContract(contract)}
                        >
                          <div className="font-medium">{contract.contract_id}</div>
                          <div className="text-sm text-gray-500">
                            {contract.supplier} • {contract.product}
                            {contract.sto_number && ` • STO: ${contract.sto_number}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Selected Contracts */}
                {newShipment.contractNumbers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {newShipment.contractNumbers.map((contractId) => (
                      <Badge
                        key={contractId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {contractId}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveContract(contractId)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Vessel Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Name
                  </label>
                  <Input
                    value={newShipment.vesselName}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselName: e.target.value }))}
                    placeholder="Enter vessel name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Code
                  </label>
                  <Input
                    value={newShipment.vesselCode}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselCode: e.target.value }))}
                    placeholder="Enter vessel code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voyage No
                  </label>
                  <Input
                    value={newShipment.voyageNo}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, voyageNo: e.target.value }))}
                    placeholder="Enter voyage number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Owner
                  </label>
                  <Input
                    value={newShipment.vesselOwner}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselOwner: e.target.value }))}
                    placeholder="Enter vessel owner"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Draft (m)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newShipment.vesselDraft}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselDraft: e.target.value }))}
                    placeholder="Enter vessel draft"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Capacity (MT)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newShipment.vesselCapacity}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselCapacity: e.target.value }))}
                    placeholder="Enter vessel capacity"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hull Type
                  </label>
                  <Input
                    value={newShipment.vesselHullType}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, vesselHullType: e.target.value }))}
                    placeholder="Enter hull type"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Charter Type
                  </label>
                  <Input
                    value={newShipment.charterType}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, charterType: e.target.value }))}
                    placeholder="Enter charter type"
                  />
                </div>
              </div>

              {/* Port Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Port of Loading (Optional)
                  </label>
                  <Input
                    value={newShipment.portOfLoading}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, portOfLoading: e.target.value }))}
                    placeholder="Enter loading port"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Plant/Site (Discharge Port) (Optional)
                  </label>
                  <Input
                    value={newShipment.portOfDischarge}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, portOfDischarge: e.target.value }))}
                    placeholder="Enter discharge port"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Shipped (MT)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newShipment.quantityShipped}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, quantityShipped: e.target.value }))}
                    placeholder="Enter quantity shipped"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Shipment Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={newShipment.shipmentDate}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, shipmentDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Arrival Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={newShipment.arrivalDate}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, arrivalDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowAddShipment(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateShipment}
                  disabled={saving || stoValidation?.exists}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Shipment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
