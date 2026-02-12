import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { 
  getShipments, 
  getShipmentById, 
  updateShipment,
  getVesselLoadingPorts,
  upsertVesselLoadingPort,
  deleteVesselLoadingPort,
  getContractSuggestions,
  validateContractNumber,
  checkStoExists,
  createShipment,
  getContractDetailsForSto,
  updateStoQtyAssigned
} from '../controllers/shipment.controller';

const router = express.Router();

router.use(authenticateToken);

// New shipment creation routes - MUST BE BEFORE parameterized routes
router.get('/contracts/suggestions', getContractSuggestions);
router.get('/contracts/validate', validateContractNumber);
router.get('/contracts/details', getContractDetailsForSto);
router.put('/contracts/sto-qty', auditLog('UPDATE', 'STO_QTY_ASSIGNED'), updateStoQtyAssigned);
router.get('/check-sto/:stoNumber', checkStoExists);
router.post('/', auditLog('CREATE', 'SHIPMENT'), createShipment);

// Get all shipments
router.get('/', getShipments);

// Get shipment by ID
router.get('/:id', getShipmentById);

// Update shipment
router.put('/:id', auditLog('UPDATE', 'SHIPMENT'), updateShipment);

// Vessel loading ports routes
router.get('/:shipmentId/loading-ports', getVesselLoadingPorts);
router.post('/:shipmentId/loading-ports', auditLog('CREATE', 'LOADING_PORT'), upsertVesselLoadingPort);
router.put('/:shipmentId/loading-ports/:portId', auditLog('UPDATE', 'LOADING_PORT'), upsertVesselLoadingPort);
router.delete('/:shipmentId/loading-ports/:portId', auditLog('DELETE', 'LOADING_PORT'), deleteVesselLoadingPort);

export default router;

