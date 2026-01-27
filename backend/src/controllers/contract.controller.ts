import { Response } from 'express';
import { query } from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

export const getContracts = async (req: AuthRequest, res: Response) => {
  try {
    const { status, supplier, buyer, dateFrom, dateTo, outstanding, companyCode, b2bFlag, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Updated query to group contracts by contract_id
    // Outstanding Quantity = Contract Quantity - Total STO Quantity from contracts table
    // STO Numbers come from sap_processed_data table via subquery
    let queryText = `
      SELECT 
        c.contract_id,
        (array_agg(c.id ORDER BY c.created_at DESC))[1] as id,
        MAX(c.buyer) as buyer,
        MAX(c.supplier) as supplier,
        MAX(c.group_name) as group_name,
        MAX(c.product) as product,
        MAX(c.quantity_ordered) as quantity_ordered,
        MAX(c.unit) as unit,
        MAX(c.contract_date) as contract_date,
        MAX(c.delivery_start_date) as delivery_start_date,
        MAX(c.delivery_end_date) as delivery_end_date,
        MAX(c.contract_value) as contract_value,
        MAX(c.unit_price) as unit_price,
        MAX(c.currency) as currency,
        MAX(c.status) as status,
        MAX(c.incoterm) as incoterm,
        MAX(c.transport_mode) as transport_mode,
        MAX(c.source_type) as source_type,
        MAX(c.contract_type) as contract_type,
        MAX(c.logistics_classification) as logistics_classification,
        MAX(c.po_classification) as po_classification,
        MAX(c.created_at) as created_at,
        STRING_AGG(DISTINCT c.po_number, ', ' ORDER BY c.po_number) FILTER (WHERE c.po_number IS NOT NULL AND c.po_number != '') as po_numbers,
        (SELECT STRING_AGG(DISTINCT sto_number, ', ' ORDER BY sto_number) 
         FROM sap_processed_data 
         WHERE contract_number = c.contract_id AND sto_number IS NOT NULL AND sto_number != '') as sto_numbers,
        COALESCE((SELECT SUM(CAST(REPLACE(REPLACE(data->'contract'->>'sto_quantity', ',', ''), ' ', '') AS NUMERIC))
         FROM sap_processed_data 
         WHERE contract_number = c.contract_id 
         AND sto_number IS NOT NULL 
         AND data->'contract'->>'sto_quantity' IS NOT NULL), 0) as total_sto_quantity,
        COALESCE(MAX(c.quantity_ordered) - COALESCE((SELECT SUM(CAST(REPLACE(REPLACE(data->'contract'->>'sto_quantity', ',', ''), ' ', '') AS NUMERIC))
         FROM sap_processed_data 
         WHERE contract_number = c.contract_id 
         AND sto_number IS NOT NULL 
         AND data->'contract'->>'sto_quantity' IS NOT NULL), 0), MAX(c.quantity_ordered)) as outstanding_quantity,
        COUNT(DISTINCT c.po_number) FILTER (WHERE c.po_number IS NOT NULL) as po_count,
        (SELECT COUNT(DISTINCT sto_number) 
         FROM sap_processed_data 
         WHERE contract_number = c.contract_id AND sto_number IS NOT NULL) as sto_count,
        -- Latest processed row JSON for this contract (for display-only fields)
        (SELECT COALESCE(
                  spd.data->'contract'->>'company_code',
                  spd.data->'raw'->>'Company Code',
                  spd.data->'raw'->>'company code',
                  spd.data->>'Company Code',
                  spd.data->>'company code'
                )
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS company_code,
        (SELECT COALESCE(
                  spd.data->'contract'->>'contract_type',         -- normalized from 'B2B Flag'
                  spd.data->>'B2B Flag'
                )
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS b2b_flag,
        (SELECT COALESCE(
                  spd.data->'contract'->>'contract_reference_po',
                  spd.data->>'CONTRACT REFF PO'
                )
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS contract_reference_po,
        -- LT/SPOT display (prefer normalized ltc_spot from JSON if present, else contract_type column)
        (SELECT COALESCE(
                  spd.data->'contract'->>'ltc_spot',
                  MAX(c.contract_type)::text
                )
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS lt_spot,
        -- Status from import JSON for display (does not override DB enum)
        (SELECT spd.data->'contract'->>'status'
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS import_status,
        -- Payment dates from SAP Import data
        (SELECT CASE
                  WHEN COALESCE(
                         NULLIF(spd.data->'payment'->>'due_date_payment', ''), 
                         NULLIF(spd.data->>'due date payment', '')
                       ) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN COALESCE(
                         NULLIF(spd.data->'payment'->>'due_date_payment', ''), 
                         NULLIF(spd.data->>'due date payment', '')
                       )::date
                  ELSE NULL
                END
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS due_date_payment,
        (SELECT CASE
                  WHEN COALESCE(
                         NULLIF(spd.data->'payment'->>'dp_date', ''),
                         NULLIF(spd.data->>'dp date', '')
                       ) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN COALESCE(
                         NULLIF(spd.data->'payment'->>'dp_date', ''),
                         NULLIF(spd.data->>'dp date', '')
                       )::date
                  ELSE NULL
                END
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS dp_date,
        (SELECT CASE
                  WHEN COALESCE(
                         NULLIF(spd.data->'payment'->>'payoff_date', ''),
                         NULLIF(spd.data->>'payoff date', '')
                       ) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN COALESCE(
                         NULLIF(spd.data->'payment'->>'payoff_date', ''),
                         NULLIF(spd.data->>'payoff date', '')
                       )::date
                  ELSE NULL
                END
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS payoff_date,
        -- DP Date Deviation (Days) = DP Date - Due Date Payment
        (SELECT CASE
                  WHEN COALESCE(NULLIF(spd.data->'payment'->>'dp_date', ''), NULLIF(spd.data->>'dp date', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                   AND COALESCE(NULLIF(spd.data->'payment'->>'due_date_payment', ''), NULLIF(spd.data->>'due date payment', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN (
                    COALESCE(NULLIF(spd.data->'payment'->>'dp_date', ''), NULLIF(spd.data->>'dp date', ''))::date
                    -
                    COALESCE(NULLIF(spd.data->'payment'->>'due_date_payment', ''), NULLIF(spd.data->>'due date payment', ''))::date
                  )
                  ELSE NULL
                END
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS dp_date_deviation_days,
        -- Payoff Date Deviation (Days) = Payoff Date - Due Date Payment
        (SELECT CASE
                  WHEN COALESCE(NULLIF(spd.data->'payment'->>'payoff_date', ''), NULLIF(spd.data->>'payoff date', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                   AND COALESCE(NULLIF(spd.data->'payment'->>'due_date_payment', ''), NULLIF(spd.data->>'due date payment', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN (
                    COALESCE(NULLIF(spd.data->'payment'->>'payoff_date', ''), NULLIF(spd.data->>'payoff date', ''))::date
                    -
                    COALESCE(NULLIF(spd.data->'payment'->>'due_date_payment', ''), NULLIF(spd.data->>'due date payment', ''))::date
                  )
                  ELSE NULL
                END
           FROM sap_processed_data spd
           WHERE spd.contract_number = c.contract_id
           ORDER BY spd.created_at DESC NULLS LAST
           LIMIT 1) AS payoff_date_deviation_days,
        -- Trucking operations count (to drive icon status)
        (SELECT COUNT(*) 
           FROM trucking_operations t
          WHERE t.contract_id = (SELECT id FROM contracts c2 WHERE c2.contract_id = c.contract_id ORDER BY created_at DESC LIMIT 1)
        ) AS trucking_count
      FROM contracts c
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      // Handle both ACTIVE/CLOSE and Open/Close
      // Priority: Use SAP import status if available, otherwise use contracts table status
      // Open = SAP status = 'Open'/'ACTIVE' OR (no SAP status AND contracts.status = 'ACTIVE')
      // Close = SAP status = 'Close'/'CLOSE'/'COMPLETED'/'CLOSED' OR (no SAP status AND contracts.status IN ('CLOSE', 'COMPLETED', 'CLOSED'))
      if (status === 'Open' || status === 'ACTIVE') {
        queryText += ` AND (
          EXISTS (
            SELECT 1 FROM sap_processed_data spd 
            WHERE spd.contract_number = c.contract_id 
            AND (spd.data->'contract'->>'status' = 'Open' OR UPPER(spd.data->'contract'->>'status') = 'ACTIVE')
            ORDER BY spd.created_at DESC LIMIT 1
          )
          OR (
            NOT EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id
            )
            AND c.status = 'ACTIVE'
          )
        )`;
        // No parameter to push for this case
      } else if (status === 'Close' || status === 'CLOSE') {
        // For Close, prioritize SAP import status, fallback to contracts table status
        queryText += ` AND (
          EXISTS (
            SELECT 1 FROM sap_processed_data spd 
            WHERE spd.contract_number = c.contract_id 
            AND (
              spd.data->'contract'->>'status' = 'Close' 
              OR UPPER(spd.data->'contract'->>'status') IN ('CLOSE', 'COMPLETED', 'CLOSED')
            )
            ORDER BY spd.created_at DESC LIMIT 1
          )
          OR (
            NOT EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id
            )
            AND c.status IN ('CLOSE', 'COMPLETED', 'CLOSED')
          )
        )`;
        // No parameter to push for this case
      } else {
        const statusValue = status as string;
        queryText += ` AND (c.status = $${paramIndex} OR EXISTS (
          SELECT 1 FROM sap_processed_data spd 
          WHERE spd.contract_number = c.contract_id 
          AND spd.data->'contract'->>'status' = $${paramIndex}
          ORDER BY spd.created_at DESC LIMIT 1
        ))`;
        queryParams.push(statusValue);
        paramIndex++;
      }
    }

    if (supplier) {
      queryText += ` AND c.supplier ILIKE $${paramIndex}`;
      queryParams.push(`%${supplier}%`);
      paramIndex++;
    }

    if (buyer) {
      queryText += ` AND c.buyer ILIKE $${paramIndex}`;
      queryParams.push(`%${buyer}%`);
      paramIndex++;
    }

    if (dateFrom) {
      queryText += ` AND c.contract_date >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      queryText += ` AND c.contract_date <= $${paramIndex}`;
      queryParams.push(dateTo);
      paramIndex++;
    }

    queryText += ` GROUP BY c.contract_id`;
    
    // Add filters for company_code and b2b_flag after GROUP BY (using HAVING)
    if (companyCode) {
      queryText += ` HAVING EXISTS (
        SELECT 1 FROM sap_processed_data spd 
        WHERE spd.contract_number = c.contract_id 
        AND (
          COALESCE(spd.data->'contract'->>'company_code', '') = $${paramIndex}
          OR COALESCE(spd.data->'raw'->>'Company Code', '') = $${paramIndex}
          OR COALESCE(spd.data->'raw'->>'company code', '') = $${paramIndex}
          OR COALESCE(spd.data->>'Company Code', '') = $${paramIndex}
          OR COALESCE(spd.data->>'company code', '') = $${paramIndex}
        )
        ORDER BY spd.created_at DESC LIMIT 1
      )`;
      queryParams.push(companyCode);
      paramIndex++;
    }
    
    if (b2bFlag) {
      queryText += ` HAVING EXISTS (
        SELECT 1 FROM sap_processed_data spd 
        WHERE spd.contract_number = c.contract_id 
        AND (
          COALESCE(spd.data->'contract'->>'contract_type', '') = $${paramIndex}
          OR COALESCE(spd.data->>'B2B Flag', '') = $${paramIndex}
        )
        ORDER BY spd.created_at DESC LIMIT 1
      )`;
      queryParams.push(b2bFlag);
      paramIndex++;
    }
    
    // Filter for outstanding contracts (after aggregation)
    if (outstanding === 'true') {
      queryText += ` HAVING COALESCE(MAX(c.quantity_ordered) - COALESCE((SELECT SUM(CAST(REPLACE(REPLACE(data->'contract'->>'sto_quantity', ',', ''), ' ', '') AS NUMERIC))
         FROM sap_processed_data 
         WHERE contract_number = c.contract_id 
         AND sto_number IS NOT NULL 
         AND data->'contract'->>'sto_quantity' IS NOT NULL), 0), MAX(c.quantity_ordered)) > 0`;
    }
    
    queryText += ` ORDER BY MAX(c.created_at) DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(Number(limit), offset);

    const result = await query(queryText, queryParams);
    
    // Debug logging
    logger.info('Contracts query result:', { 
      rowsReturned: result.rows.length,
      firstRow: result.rows[0] ? {
        contract_id: result.rows[0].contract_id,
        sto_numbers: result.rows[0].sto_numbers,
        sto_count: result.rows[0].sto_count,
        total_sto_quantity: result.rows[0].total_sto_quantity
      } : null
    });

    // Get total count (count distinct contract_ids)
    let countQuery = ''
    const countParams: any[] = [];
    
    if (outstanding === 'true') {
      // For outstanding, we need to use a subquery with GROUP BY and HAVING
      countQuery = `
        SELECT COUNT(*) as count FROM (
          SELECT c.contract_id
          FROM contracts c
          WHERE 1=1
      `;
      let countParamIndex = 1;
      
      if (status) {
        if (status === 'Open' || status === 'ACTIVE') {
          countQuery += ` AND (
            EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id 
              AND (spd.data->'contract'->>'status' = 'Open' OR UPPER(spd.data->'contract'->>'status') = 'ACTIVE')
              ORDER BY spd.created_at DESC LIMIT 1
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM sap_processed_data spd 
                WHERE spd.contract_number = c.contract_id
              )
              AND c.status = 'ACTIVE'
            )
          )`;
          // No parameter to push for this case
        } else if (status === 'Close' || status === 'CLOSE') {
          countQuery += ` AND (
            EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id 
              AND (
                spd.data->'contract'->>'status' = 'Close' 
                OR UPPER(spd.data->'contract'->>'status') IN ('CLOSE', 'COMPLETED', 'CLOSED')
              )
              ORDER BY spd.created_at DESC LIMIT 1
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM sap_processed_data spd 
                WHERE spd.contract_number = c.contract_id
              )
              AND c.status IN ('CLOSE', 'COMPLETED', 'CLOSED')
            )
          )`;
          // No parameter to push for this case
        } else {
          const statusValue = status as string;
          countQuery += ` AND (c.status = $${countParamIndex} OR EXISTS (
            SELECT 1 FROM sap_processed_data spd 
            WHERE spd.contract_number = c.contract_id 
            AND spd.data->'contract'->>'status' = $${countParamIndex}
            ORDER BY spd.created_at DESC LIMIT 1
          ))`;
          countParams.push(statusValue);
          countParamIndex++;
        }
      }
      
      if (supplier) {
        countQuery += ` AND c.supplier ILIKE $${countParamIndex}`;
        countParams.push(`%${supplier}%`);
        countParamIndex++;
      }

      if (buyer) {
        countQuery += ` AND c.buyer ILIKE $${countParamIndex}`;
        countParams.push(`%${buyer}%`);
        countParamIndex++;
      }

      if (dateFrom) {
        countQuery += ` AND c.contract_date >= $${countParamIndex}`;
        countParams.push(dateFrom);
        countParamIndex++;
      }

      if (dateTo) {
        countQuery += ` AND c.contract_date <= $${countParamIndex}`;
        countParams.push(dateTo);
        countParamIndex++;
      }
      
      countQuery += `
          GROUP BY c.contract_id
          HAVING COALESCE(MAX(c.quantity_ordered) - COALESCE((SELECT SUM(CAST(REPLACE(REPLACE(data->'contract'->>'sto_quantity', ',', ''), ' ', '') AS NUMERIC))
             FROM sap_processed_data 
             WHERE contract_number = c.contract_id 
             AND sto_number IS NOT NULL 
             AND data->'contract'->>'sto_quantity' IS NOT NULL), 0), MAX(c.quantity_ordered)) > 0`;
      
      // Add company_code and b2b_flag filters for outstanding query
      if (companyCode) {
        countQuery += ` AND EXISTS (
          SELECT 1 FROM sap_processed_data spd 
          WHERE spd.contract_number = c.contract_id 
          AND (
            COALESCE(spd.data->'contract'->>'company_code', '') = $${countParamIndex}
            OR COALESCE(spd.data->'raw'->>'Company Code', '') = $${countParamIndex}
            OR COALESCE(spd.data->'raw'->>'company code', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'Company Code', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'company code', '') = $${countParamIndex}
          )
          ORDER BY spd.created_at DESC LIMIT 1
        )`;
        countParams.push(companyCode);
        countParamIndex++;
      }
      
      if (b2bFlag) {
        countQuery += ` AND EXISTS (
          SELECT 1 FROM sap_processed_data spd 
          WHERE spd.contract_number = c.contract_id 
          AND (
            COALESCE(spd.data->'contract'->>'contract_type', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'B2B Flag', '') = $${countParamIndex}
          )
          ORDER BY spd.created_at DESC LIMIT 1
        )`;
        countParams.push(b2bFlag);
        countParamIndex++;
      }
      
      countQuery += `
        ) AS outstanding_contracts
      `;
    } else {
      countQuery = 'SELECT COUNT(DISTINCT c.contract_id) as count FROM contracts c WHERE 1=1';
      let countParamIndex = 1;
      
      if (status) {
        if (status === 'Open' || status === 'ACTIVE') {
          countQuery += ` AND (
            EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id 
              AND (spd.data->'contract'->>'status' = 'Open' OR UPPER(spd.data->'contract'->>'status') = 'ACTIVE')
              ORDER BY spd.created_at DESC LIMIT 1
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM sap_processed_data spd 
                WHERE spd.contract_number = c.contract_id
              )
              AND c.status = 'ACTIVE'
            )
          )`;
          // No parameter to push for this case
        } else if (status === 'Close' || status === 'CLOSE') {
          countQuery += ` AND (
            EXISTS (
              SELECT 1 FROM sap_processed_data spd 
              WHERE spd.contract_number = c.contract_id 
              AND (
                spd.data->'contract'->>'status' = 'Close' 
                OR UPPER(spd.data->'contract'->>'status') IN ('CLOSE', 'COMPLETED', 'CLOSED')
              )
              ORDER BY spd.created_at DESC LIMIT 1
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM sap_processed_data spd 
                WHERE spd.contract_number = c.contract_id
              )
              AND c.status IN ('CLOSE', 'COMPLETED', 'CLOSED')
            )
          )`;
          // No parameter to push for this case
        } else {
          const statusValue = status as string;
          countQuery += ` AND (c.status = $${countParamIndex} OR EXISTS (
            SELECT 1 FROM sap_processed_data spd 
            WHERE spd.contract_number = c.contract_id 
            AND spd.data->'contract'->>'status' = $${countParamIndex}
            ORDER BY spd.created_at DESC LIMIT 1
          ))`;
          countParams.push(statusValue);
          countParamIndex++;
        }
      }

      if (supplier) {
        countQuery += ` AND c.supplier ILIKE $${countParamIndex}`;
        countParams.push(`%${supplier}%`);
        countParamIndex++;
      }

      if (buyer) {
        countQuery += ` AND c.buyer ILIKE $${countParamIndex}`;
        countParams.push(`%${buyer}%`);
        countParamIndex++;
      }

      if (dateFrom) {
        countQuery += ` AND c.contract_date >= $${countParamIndex}`;
        countParams.push(dateFrom);
        countParamIndex++;
      }

      if (dateTo) {
        countQuery += ` AND c.contract_date <= $${countParamIndex}`;
        countParams.push(dateTo);
        countParamIndex++;
      }
      
      // For non-outstanding queries, we need GROUP BY if we have companyCode or b2bFlag filters
      if (companyCode || b2bFlag) {
        countQuery += ` GROUP BY c.contract_id`;
      }
      
      // Add company_code and b2b_flag filters to count query
      if (companyCode) {
        countQuery += ` HAVING EXISTS (
          SELECT 1 FROM sap_processed_data spd 
          WHERE spd.contract_number = c.contract_id 
          AND (
            COALESCE(spd.data->'contract'->>'company_code', '') = $${countParamIndex}
            OR COALESCE(spd.data->'raw'->>'Company Code', '') = $${countParamIndex}
            OR COALESCE(spd.data->'raw'->>'company code', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'Company Code', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'company code', '') = $${countParamIndex}
          )
          ORDER BY spd.created_at DESC LIMIT 1
        )`;
        countParams.push(companyCode);
        countParamIndex++;
      }
      
      if (b2bFlag) {
        countQuery += ` HAVING EXISTS (
          SELECT 1 FROM sap_processed_data spd 
          WHERE spd.contract_number = c.contract_id 
          AND (
            COALESCE(spd.data->'contract'->>'contract_type', '') = $${countParamIndex}
            OR COALESCE(spd.data->>'B2B Flag', '') = $${countParamIndex}
          )
          ORDER BY spd.created_at DESC LIMIT 1
        )`;
        countParams.push(b2bFlag);
        countParamIndex++;
      }
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        contracts: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(parseInt(countResult.rows[0].count) / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Get contracts error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch contracts' },
    });
  }
};

export const getContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM contracts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Contract not found' },
      });
    }

    // Get related shipments
    const shipmentsResult = await query(
      'SELECT * FROM shipments WHERE contract_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get related payments
    const paymentsResult = await query(
      'SELECT * FROM payments WHERE contract_id = $1 ORDER BY created_at DESC',
      [id]
    );

    return res.json({
      success: true,
      data: {
        contract: result.rows[0],
        shipments: shipmentsResult.rows,
        payments: paymentsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Get contract error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch contract' },
    });
  }
};

export const createContract = async (req: AuthRequest, res: Response) => {
  try {
    const {
      contract_id,
      buyer,
      supplier,
      product,
      quantity_ordered,
      unit,
      incoterm,
      loading_site,
      unloading_site,
      contract_date,
      delivery_start_date,
      delivery_end_date,
      contract_value,
      currency,
      sap_contract_id,
    } = req.body;

    const result = await query(
      `INSERT INTO contracts (
        contract_id, buyer, supplier, product, quantity_ordered, unit, incoterm,
        loading_site, unloading_site, contract_date, delivery_start_date,
        delivery_end_date, contract_value, currency, sap_contract_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        contract_id,
        buyer,
        supplier,
        product,
        quantity_ordered,
        unit,
        incoterm,
        loading_site,
        unloading_site,
        contract_date,
        delivery_start_date,
        delivery_end_date,
        contract_value,
        currency,
        sap_contract_id,
        req.user?.id,
      ]
    );

    logger.info(`Contract created: ${contract_id} by ${req.user?.username}`);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create contract error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create contract' },
    });
  }
};

export const updateContract = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await query(
      `UPDATE contracts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Contract not found' },
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update contract error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to update contract' },
    });
  }
};

