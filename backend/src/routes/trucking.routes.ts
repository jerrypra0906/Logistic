import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { getTruckingOperations, getTruckingOperationById, updateTruckingOperation } from '../controllers/trucking.controller';

const router = express.Router();

router.use(authenticateToken);

// Get all trucking operations
router.get('/', getTruckingOperations);

// Get trucking operation by ID
router.get('/:id', getTruckingOperationById);

// Update trucking operation
router.put('/:id', auditLog('UPDATE', 'TRUCKING_OPERATION'), updateTruckingOperation);

export default router;
