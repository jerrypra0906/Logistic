import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import { getFinanceSummary, getPaymentById, getPayments } from '../controllers/finance.controller';

const router = express.Router();

router.use(authenticateToken);

router.get(
  '/summary',
  authorize('ADMIN', 'FINANCE', 'MANAGEMENT', 'TRADING', 'LOGISTICS', 'SUPPORT'),
  getFinanceSummary
);

router.get(
  '/payments',
  authorize('ADMIN', 'FINANCE', 'MANAGEMENT', 'TRADING', 'LOGISTICS', 'SUPPORT'),
  getPayments
);

router.get(
  '/payments/:id',
  authorize('ADMIN', 'FINANCE'),
  getPaymentById
);

export default router;

