import { FastifyInstance } from 'fastify';
import { uploadController } from './upload.controller';
import { authenticate } from '../auth/auth.middleware';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/upload/:accessionNumber — Upload DICOM file
  app.post('/:accessionNumber', (req, rep) => uploadController.upload(req, rep));
}
