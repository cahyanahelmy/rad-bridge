import { FastifyRequest, FastifyReply } from 'fastify';
import { uploadService } from './upload.service';
import { ValidationError } from '../../lib/errors';

export class UploadController {
  async upload(request: FastifyRequest, reply: FastifyReply) {
    const { accessionNumber } = request.params as { accessionNumber: string };

    const data = await request.file();
    if (!data) {
      throw new ValidationError('No file uploaded');
    }

    const result = await uploadService.uploadDicom(accessionNumber, {
      filename: data.filename,
      file: data.file,
      mimetype: data.mimetype,
    });

    return reply.status(201).send({
      success: true,
      data: result,
    });
  }
}

export const uploadController = new UploadController();
