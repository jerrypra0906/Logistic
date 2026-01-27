import express from 'express';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import { downloadDocument, listDocuments, uploadDocumentHandler, ensureUploadDir } from '../controllers/document.controller';

const router = express.Router();

router.use(authenticateToken);

const uploadDir = ensureUploadDir();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '_' + Math.round(Math.random() * 1e9);
    cb(null, unique + '_' + file.originalname.replace(/\s+/g, '_'));
  },
});
const upload = multer({ storage });

// List documents (filter by contractId/shipmentId)
router.get('/', listDocuments);

// Upload document
router.post('/upload', upload.single('file'), uploadDocumentHandler);

// Download document
router.get('/:id/download', downloadDocument);

export default router;

