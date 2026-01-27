import { Request, Response } from 'express';
import { query } from '../database/connection';
import logger from '../utils/logger';
import * as XLSX from 'xlsx';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const TABLE = 'suppliers';

type ProductConfig = {
  product_name: string;
  percent_produce: number | null;
  working_hours_per_day: number | null;
  working_days_per_month: number | null;
  working_days_per_year: number | null;
};

const loadProductConfigs = async (): Promise<Record<string, ProductConfig>> => {
  const map: Record<string, ProductConfig> = {};
  try {
    const res = await query(
      `SELECT product_name, percent_produce, working_hours_per_day, working_days_per_month, working_days_per_year FROM products WHERE product_name IN ('CPO','PK','POME','SHELL')`
    );
    for (const row of res.rows as ProductConfig[]) {
      map[row.product_name.toUpperCase()] = row;
    }
  } catch (e) {
    logger.error('Failed to load product configs', e);
  }
  return map;
};

const computeEstimates = (
  capValue: any,
  productMap: Record<string, ProductConfig>
): {
  cpo_month: number | null;
  pk_month: number | null;
  pome_month: number | null;
  shell_month: number | null;
  cpo_year: number | null;
  pk_year: number | null;
  pome_year: number | null;
  shell_year: number | null;
} => {
  const cap = typeof capValue === 'number' ? capValue : parseFloat(capValue);
  if (!isFinite(cap)) {
    return { cpo_month: null, pk_month: null, pome_month: null, shell_month: null, cpo_year: null, pk_year: null, pome_year: null, shell_year: null };
  }

  const calc = (prod?: ProductConfig | null, useYear = false): number | null => {
    if (!prod) return null;
    const pct = prod.percent_produce == null ? null : Number(prod.percent_produce) / 100;
    const hours = prod.working_hours_per_day == null ? null : Number(prod.working_hours_per_day);
    const days = useYear
      ? prod.working_days_per_year == null ? null : Number(prod.working_days_per_year)
      : prod.working_days_per_month == null ? null : Number(prod.working_days_per_month);
    if (pct == null || hours == null || days == null) return null;
    return cap * pct * hours * days;
  };

  const cpoCfg = productMap['CPO'];
  const pkCfg = productMap['PK'];
  const pomeCfg = productMap['POME'];
  const shellCfg = productMap['SHELL'];

  return {
    cpo_month: calc(cpoCfg, false),
    pk_month: calc(pkCfg, false),
    pome_month: calc(pomeCfg, false),
    shell_month: calc(shellCfg, false),
    cpo_year: calc(cpoCfg, true),
    pk_year: calc(pkCfg, true),
    pome_year: calc(pomeCfg, true),
    shell_year: calc(shellCfg, true),
  };
};

export const listSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>;
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push('(plant_code ILIKE $' + params.length + ' OR mills ILIKE $' + params.length + ' OR parent_company ILIKE $' + params.length + ' OR island ILIKE $' + params.length + ' OR province ILIKE $' + params.length + ')');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `SELECT * FROM ${TABLE} ${whereSql} ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int AS count FROM ${TABLE} ${whereSql}`;

    const dataRes = await query(dataSql, [...params, limitNum, offset]);
    const countRes = await query(countSql, params);

    return res.json({ success: true, data: { items: dataRes.rows, total: countRes.rows[0].count, page: pageNum, limit: limitNum } });
  } catch (error) {
    logger.error('Error listing suppliers:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to list suppliers' } });
  }
};

export const getSupplierById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Supplier not found' } });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching supplier:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch supplier' } });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const {
      plant_code,
      mills,
      group_id,
      parent_company,
      group_holding,
      controlling_shareholder,
      other_shareholders,
      group_type,
      group_scale,
      integrated_status,
      cap,
      city_regency,
      province,
      island,
      longitude,
      latitude,
      kml_folder,
      map,
      rspo,
      rspo_type,
      ispo,
      iscc,
      year_commence,
      updated_date,
      remarks,
    } = req.body;

    const normalizeNum = (v: any) => (v === '' || v === undefined ? null : Number(v));
    const normalizeStr = (v: any) => (v === '' || v === undefined ? null : v);

    const productMap = await loadProductConfigs();
    const est = computeEstimates(cap, productMap);

    const insertSql = `
      INSERT INTO ${TABLE} (
        plant_code, mills, group_id, parent_company, group_holding, controlling_shareholder, other_shareholders,
        group_type, group_scale, integrated_status, cap,
        cpo_prod_est_month, pk_prod_est_month, pome_prod_est_month, shell_prod_est_month,
        cpo_prod_est_year, pk_prod_est_year, pome_prod_est_year, shell_prod_est_year,
        city_regency, province, island, longitude, latitude, kml_folder, map, rspo, rspo_type, ispo, iscc,
        year_commence, updated_date, remarks
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,
        $12,$13,$14,$15,
        $16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33
      ) RETURNING *
    `;

    const params = [
      normalizeStr(plant_code),
      normalizeStr(mills),
      normalizeStr(group_id),
      normalizeStr(parent_company),
      normalizeStr(group_holding),
      normalizeStr(controlling_shareholder),
      normalizeStr(other_shareholders),
      normalizeStr(group_type),
      normalizeStr(group_scale),
      normalizeStr(integrated_status),
      normalizeNum(cap),
      est.cpo_month,
      est.pk_month,
      est.pome_month,
      est.shell_month,
      est.cpo_year,
      est.pk_year,
      est.pome_year,
      est.shell_year,
      normalizeStr(city_regency),
      normalizeStr(province),
      normalizeStr(island),
      normalizeNum(longitude),
      normalizeNum(latitude),
      normalizeStr(kml_folder),
      normalizeStr(map),
      normalizeStr(rspo),
      normalizeStr(rspo_type),
      normalizeStr(ispo),
      normalizeStr(iscc),
      normalizeNum(year_commence),
      normalizeStr(updated_date),
      normalizeStr(remarks),
    ];

    const result = await query(insertSql, params);
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating supplier:', error);
    const message = error?.code === '23505' ? 'Supplier with this plant_code already exists' : 'Failed to create supplier';
    return res.status(500).json({ success: false, error: { message } });
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const fields = [
      'plant_code','mills','group_id','parent_company','group_holding','controlling_shareholder','other_shareholders',
      'group_type','group_scale','integrated_status','cap',
      'cpo_prod_est_month','pk_prod_est_month','pome_prod_est_month','shell_prod_est_month',
      'cpo_prod_est_year','pk_prod_est_year','pome_prod_est_year','shell_prod_est_year',
      'city_regency','province','island','longitude','latitude','kml_folder','map','rspo','rspo_type','ispo','iscc',
      'year_commence','updated_date','remarks'
    ];

    const setClauses: string[] = [];
    const params: any[] = [];
    const numericFields = new Set([
      'cap','longitude','latitude','year_commence',
      'cpo_prod_est_month','pk_prod_est_month','pome_prod_est_month','shell_prod_est_month',
      'cpo_prod_est_year','pk_prod_est_year','pome_prod_est_year','shell_prod_est_year'
    ]);
    const estimateFields = new Set([
      'cpo_prod_est_month','pk_prod_est_month','pome_prod_est_month','shell_prod_est_month',
      'cpo_prod_est_year','pk_prod_est_year','pome_prod_est_year','shell_prod_est_year'
    ]);
    fields.forEach((f) => {
      if (f in req.body) {
        // If CAP is present we will recompute estimate fields; avoid assigning them twice
        if ('cap' in req.body && estimateFields.has(f)) {
          return;
        }
        let val = (req.body as any)[f];
        if (val === '') val = null;
        if (numericFields.has(f) && val !== null && val !== undefined) val = Number(val);
        params.push(val);
        setClauses.push(`${f} = $${params.length}`);
      }
    });

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
    }

    // If CAP provided or any estimates missing, recompute estimates from products
    if ('cap' in req.body) {
      const productMap = await loadProductConfigs();
      const est = computeEstimates((req.body as any)['cap'], productMap);
      const toSet: Record<string, number | null> = {
        cpo_prod_est_month: est.cpo_month,
        pk_prod_est_month: est.pk_month,
        pome_prod_est_month: est.pome_month,
        shell_prod_est_month: est.shell_month,
        cpo_prod_est_year: est.cpo_year,
        pk_prod_est_year: est.pk_year,
        pome_prod_est_year: est.pome_year,
        shell_prod_est_year: est.shell_year,
      };
      Object.entries(toSet).forEach(([k, v]) => {
        params.push(v);
        setClauses.push(`${k} = $${params.length}`);
      });
    }

    // updated_at timestamp
    const sql = `UPDATE ${TABLE} SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id);
    const result = await query(sql, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Supplier not found' } });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating supplier:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to update supplier' } });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Supplier not found' } });
    }
    return res.json({ success: true, data: { id } });
  } catch (error) {
    logger.error('Error deleting supplier:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to delete supplier' } });
  }
};

export const importSuppliersFromExcel = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file?.path) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 2) {
      return res.status(400).json({ success: false, error: { message: 'Excel must have header and at least one data row' } });
    }

    // Expected order as provided by user
    const expectedHeaders = [
      'PLANT CODE','MILLS','GROUP ID','PARENT COMPANY','GROUP / HOLDING','Controlling Shareholder','Other Shareholders','GROUP TYPE','Group Scale','Integrated Status','CAP',
      'CITY / REGENCY','PROVINCE','ISLAND','Long.','Lat.','KML_FOLDER','MAP','RSPO','RSPO Type','ISPO','ISCC','Year Commence','Updated Date','Remarks'
    ];

    const headerRow = rows[0].map((h) => (h || '').toString().trim());

    const mapIndex = (label: string) => headerRow.findIndex((h) => h.toLowerCase() === label.toLowerCase());
    const idxs = expectedHeaders.map(mapIndex);

    const missing = expectedHeaders.filter((_h, i) => idxs[i] === -1);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: { message: `Missing columns: ${missing.join(', ')}` } });
    }

    const productMap = await loadProductConfigs();
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c === null || c === '')) continue;

      const get = (label: string) => row[mapIndex(label)];
      const payload = {
        plant_code: get('PLANT CODE'),
        mills: get('MILLS'),
        group_id: get('GROUP ID'),
        parent_company: get('PARENT COMPANY'),
        group_holding: get('GROUP / HOLDING'),
        controlling_shareholder: get('Controlling Shareholder'),
        other_shareholders: get('Other Shareholders'),
        group_type: get('GROUP TYPE'),
        group_scale: get('Group Scale'),
        integrated_status: get('Integrated Status'),
        cap: get('CAP'),
        city_regency: get('CITY / REGENCY'),
        province: get('PROVINCE'),
        island: get('ISLAND'),
        longitude: get('Long.'),
        latitude: get('Lat.'),
        kml_folder: get('KML_FOLDER'),
        map: get('MAP'),
        rspo: get('RSPO'),
        rspo_type: get('RSPO Type'),
        ispo: get('ISPO'),
        iscc: get('ISCC'),
        year_commence: get('Year Commence'),
        updated_date: get('Updated Date'),
        remarks: get('Remarks'),
      } as any;

      if (!payload.plant_code) {
        errors.push(`Row ${r + 1}: PLANT CODE is required`);
        continue;
      }

      try {
        const est = computeEstimates(payload.cap, productMap);
        // Identify existing row matching the specified identity fields
        const checkRes = await query(
          `SELECT id FROM ${TABLE} WHERE plant_code = $1 AND COALESCE(mills,'') = COALESCE($2,'') AND COALESCE(group_id,'') = COALESCE($3,'')
           AND COALESCE(parent_company,'') = COALESCE($4,'') AND COALESCE(group_holding,'') = COALESCE($5,'')
           AND COALESCE(controlling_shareholder,'') = COALESCE($6,'') AND COALESCE(other_shareholders,'') = COALESCE($7,'') LIMIT 1`,
          [payload.plant_code, payload.mills, payload.group_id, payload.parent_company, payload.group_holding, payload.controlling_shareholder, payload.other_shareholders]
        );

        const matchCount = (checkRes.rowCount ?? 0);
        if (matchCount > 0) {
          // Update this specific row
          const id = checkRes.rows[0].id as string;
          await query(
            `UPDATE ${TABLE} SET 
              group_type = $1, group_scale = $2, integrated_status = $3, cap = $4,
              cpo_prod_est_month = $5, pk_prod_est_month = $6, pome_prod_est_month = $7, shell_prod_est_month = $8,
              cpo_prod_est_year = $9, pk_prod_est_year = $10, pome_prod_est_year = $11, shell_prod_est_year = $12,
              city_regency = $13, province = $14, island = $15, longitude = $16, latitude = $17, kml_folder = $18, map = $19,
              rspo = $20, rspo_type = $21, ispo = $22, iscc = $23, year_commence = $24, updated_date = $25, remarks = $26,
              updated_at = NOW()
             WHERE id = $27`,
            [
              payload.group_type, payload.group_scale, payload.integrated_status, payload.cap,
              est.cpo_month, est.pk_month, est.pome_month, est.shell_month,
              est.cpo_year, est.pk_year, est.pome_year, est.shell_year,
              payload.city_regency, payload.province, payload.island, payload.longitude, payload.latitude, payload.kml_folder, payload.map,
              payload.rspo, payload.rspo_type, payload.ispo, payload.iscc, payload.year_commence, payload.updated_date, payload.remarks,
              id,
            ]
          );
          updated += 1;
        } else {
          // Insert new row
          await query(
            `INSERT INTO ${TABLE} (
              plant_code, mills, group_id, parent_company, group_holding, controlling_shareholder, other_shareholders,
              group_type, group_scale, integrated_status, cap,
              cpo_prod_est_month, pk_prod_est_month, pome_prod_est_month, shell_prod_est_month,
              cpo_prod_est_year, pk_prod_est_year, pome_prod_est_year, shell_prod_est_year,
              city_regency, province, island, longitude, latitude, kml_folder, map, rspo, rspo_type, ispo, iscc,
              year_commence, updated_date, remarks
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
            )`,
            [
              payload.plant_code,
              payload.mills,
              payload.group_id,
              payload.parent_company,
              payload.group_holding,
              payload.controlling_shareholder,
              payload.other_shareholders,
              payload.group_type,
              payload.group_scale,
              payload.integrated_status,
              payload.cap,
              est.cpo_month, est.pk_month, est.pome_month, est.shell_month,
              est.cpo_year, est.pk_year, est.pome_year, est.shell_year,
              payload.city_regency, payload.province, payload.island, payload.longitude, payload.latitude, payload.kml_folder, payload.map,
              payload.rspo, payload.rspo_type, payload.ispo, payload.iscc, payload.year_commence, payload.updated_date, payload.remarks,
            ]
          );
          inserted += 1;
        }
      } catch (e: any) {
        logger.error('Supplier import row error', { row: r + 1, error: e?.message });
        errors.push(`Row ${r + 1}: ${e?.message || 'Unknown error'}`);
      }
    }

    return res.json({ success: true, data: { inserted, updated, errors } });
  } catch (error) {
    logger.error('Error importing suppliers:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to import suppliers' } });
  }
};


// Aggregates
export const getTotalsByIsland = async (_req: AuthRequest, res: Response) => {
  try {
    const sql = `
      SELECT
        COALESCE(island, 'UNKNOWN') AS island,
        COALESCE(SUM(cpo_prod_est_month), 0) AS cpo_month,
        COALESCE(SUM(pk_prod_est_month), 0) AS pk_month,
        COALESCE(SUM(pome_prod_est_month), 0) AS pome_month,
        COALESCE(SUM(shell_prod_est_month), 0) AS shell_month,
        COALESCE(SUM(cpo_prod_est_year), 0) AS cpo_year,
        COALESCE(SUM(pk_prod_est_year), 0) AS pk_year,
        COALESCE(SUM(pome_prod_est_year), 0) AS pome_year,
        COALESCE(SUM(shell_prod_est_year), 0) AS shell_year
      FROM ${TABLE}
      GROUP BY COALESCE(island, 'UNKNOWN')
      ORDER BY island
    `;
    const result = await query(sql);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error aggregating suppliers by island:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to load aggregates' } });
  }
};

export const getTotalsByProvince = async (_req: AuthRequest, res: Response) => {
  try {
    const sql = `
      SELECT
        COALESCE(province, 'UNKNOWN') AS province,
        COALESCE(SUM(cpo_prod_est_month), 0) AS cpo_month,
        COALESCE(SUM(pk_prod_est_month), 0) AS pk_month,
        COALESCE(SUM(pome_prod_est_month), 0) AS pome_month,
        COALESCE(SUM(shell_prod_est_month), 0) AS shell_month,
        COALESCE(SUM(cpo_prod_est_year), 0) AS cpo_year,
        COALESCE(SUM(pk_prod_est_year), 0) AS pk_year,
        COALESCE(SUM(pome_prod_est_year), 0) AS pome_year,
        COALESCE(SUM(shell_prod_est_year), 0) AS shell_year
      FROM ${TABLE}
      GROUP BY COALESCE(province, 'UNKNOWN')
      ORDER BY province
    `;
    const result = await query(sql);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error aggregating suppliers by province:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to load aggregates' } });
  }
};

export const getTotalsByParentCompany = async (_req: AuthRequest, res: Response) => {
  try {
    const sql = `
      SELECT
        COALESCE(parent_company, 'UNKNOWN') AS parent_company,
        COALESCE(SUM(cpo_prod_est_month), 0) AS cpo_month,
        COALESCE(SUM(pk_prod_est_month), 0) AS pk_month,
        COALESCE(SUM(pome_prod_est_month), 0) AS pome_month,
        COALESCE(SUM(shell_prod_est_month), 0) AS shell_month,
        COALESCE(SUM(cpo_prod_est_year), 0) AS cpo_year,
        COALESCE(SUM(pk_prod_est_year), 0) AS pk_year,
        COALESCE(SUM(pome_prod_est_year), 0) AS pome_year,
        COALESCE(SUM(shell_prod_est_year), 0) AS shell_year
      FROM ${TABLE}
      GROUP BY COALESCE(parent_company, 'UNKNOWN')
      ORDER BY parent_company
    `;
    const result = await query(sql);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error aggregating suppliers by parent company:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to load aggregates' } });
  }
};


