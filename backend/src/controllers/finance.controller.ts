import { Response } from 'express'
import { query } from '../database/connection'
import { AuthRequest } from '../middleware/auth'
import logger from '../utils/logger'

const toNumber = (value: any) => (value === null || value === undefined ? null : Number(value))

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query as { status?: string; search?: string }

    const params: any[] = []
    const conditions: string[] = []

    if (status) {
      params.push(status.toUpperCase())
      conditions.push(`UPPER(p.payment_status) = $${params.length}`)
    }

    if (search) {
      params.push(`%${search}%`.toLowerCase())
      conditions.push(
        `(LOWER(p.invoice_number) LIKE $${params.length} OR LOWER(c.contract_id) LIKE $${params.length} OR LOWER(c.supplier) LIKE $${params.length})`
      )
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(
      `SELECT
         p.id,
         p.invoice_number,
         p.invoice_date,
         p.payment_amount,
         p.currency,
         p.payment_due_date,
         p.payment_date,
         p.payment_status,
         p.payment_method,
         p.bank_reference,
         p.created_at,
         p.updated_at,
         c.contract_id,
         c.supplier,
         c.product
       FROM payments p
       LEFT JOIN contracts c ON c.id = p.contract_id
       ${whereClause}
       ORDER BY p.payment_due_date NULLS LAST, p.created_at DESC`,
      params
    )

    const payments = result.rows.map((row) => ({
      ...row,
      payment_amount: toNumber(row.payment_amount),
    }))

    return res.json({ success: true, data: payments })
  } catch (error) {
    logger.error('Get payments error:', error)
    return res.status(500).json({ success: false, error: { message: 'Failed to load payments' } })
  }
}

export const getPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT
         p.*,
         c.contract_id,
         c.supplier,
         c.product,
         c.quantity_ordered,
         c.unit,
         c.status AS contract_status
       FROM payments p
       LEFT JOIN contracts c ON c.id = p.contract_id
       WHERE p.id = $1
       LIMIT 1`,
      [id]
    )

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: { message: 'Payment not found' } })
    }

    const row = result.rows[0]
    const payment = {
      ...row,
      payment_amount: toNumber(row.payment_amount),
    }

    return res.json({ success: true, data: payment })
  } catch (error) {
    logger.error('Get payment detail error:', error)
    return res.status(500).json({ success: false, error: { message: 'Failed to load payment details' } })
  }
}

export const getFinanceSummary = async (_req: AuthRequest, res: Response) => {
  try {
    const [totals, statusBreakdown, monthly] = await Promise.all([
      query(
        `SELECT
           COUNT(*) AS total_records,
           COALESCE(SUM(payment_amount), 0) AS total_amount,
           COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'PENDING'), 0) AS pending_amount,
           COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'PARTIAL'), 0) AS partial_amount,
           COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'PAID'), 0) AS paid_amount,
           COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'OVERDUE'), 0) AS overdue_amount
         FROM payments`
      ),
      query(
        `SELECT
           payment_status AS status,
           COUNT(*) AS count,
           COALESCE(SUM(payment_amount), 0) AS amount
         FROM payments
         GROUP BY payment_status`
      ),
      query(
        `SELECT
           TO_CHAR(payment_due_date, 'YYYY-MM') AS month,
           COALESCE(SUM(payment_amount), 0) AS due_amount,
           COALESCE(SUM(payment_amount) FILTER (WHERE payment_status = 'PAID'), 0) AS paid_amount
         FROM payments
         WHERE payment_due_date IS NOT NULL
         GROUP BY TO_CHAR(payment_due_date, 'YYYY-MM')
         ORDER BY month ASC
         LIMIT 12`
      ),
    ])

    const summary = {
      totals: {
        totalRecords: Number(totals.rows[0]?.total_records || 0),
        totalAmount: toNumber(totals.rows[0]?.total_amount),
        pendingAmount: toNumber(totals.rows[0]?.pending_amount),
        partialAmount: toNumber(totals.rows[0]?.partial_amount),
        paidAmount: toNumber(totals.rows[0]?.paid_amount),
        overdueAmount: toNumber(totals.rows[0]?.overdue_amount),
      },
      byStatus: statusBreakdown.rows.map((row) => ({
        status: row.status,
        count: Number(row.count || 0),
        amount: toNumber(row.amount),
      })),
      byMonth: monthly.rows.map((row) => ({
        month: row.month,
        dueAmount: toNumber(row.due_amount),
        paidAmount: toNumber(row.paid_amount),
      })),
    }

    return res.json({ success: true, data: summary })
  } catch (error) {
    logger.error('Get finance summary error:', error)
    return res.status(500).json({ success: false, error: { message: 'Failed to load finance summary' } })
  }
}

