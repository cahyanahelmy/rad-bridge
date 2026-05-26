import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export class WebhookService {
  /**
   * Handle ImagingStudy callback from DICOM Router.
   * Pairs the callback with an order using accession number.
   */
  async handleCallback(payload: any) {
    const accessionNumber = this.extractAccessionNumber(payload);

    // Log the webhook
    const log = await prisma.webhookLog.create({
      data: {
        accessionNumber,
        payload: JSON.stringify(payload),
        status: 'received',
      },
    });

    if (!accessionNumber) {
      logger.warn({ webhookId: log.id }, 'Webhook received without accession number');
      return { received: true, paired: false, reason: 'No accession number found' };
    }

    // Find matching order
    const order = await prisma.radiologyOrder.findUnique({
      where: { accessionNumber },
    });

    if (!order) {
      logger.warn({ accessionNumber }, 'Webhook: no matching order found');
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 'unmatched', error: 'No matching order' },
      });
      return { received: true, paired: false, reason: 'No matching order' };
    }

    // Extract ImagingStudy ID
    const imagingstudyId = this.extractImagingStudyId(payload);

    // Update order
    await prisma.radiologyOrder.update({
      where: { id: order.id },
      data: {
        imagingstudyId,
        status: 'IMAGING_CREATED',
      },
    });

    // Update webhook log
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: 'paired',
        processedAt: new Date(),
      },
    });

    logger.info({ accessionNumber, imagingstudyId }, '✓ Webhook paired: ImagingStudy linked');

    return { received: true, paired: true, accessionNumber, imagingstudyId };
  }

  private extractAccessionNumber(payload: any): string | null {
    // Try to extract from ImagingStudy identifier
    if (payload?.identifier) {
      for (const id of payload.identifier) {
        if (id.system?.includes('acsn')) {
          return id.value;
        }
      }
    }
    // Try from accession field
    if (payload?.accessionNumber) return payload.accessionNumber;
    if (payload?.accession) return payload.accession;
    return null;
  }

  private extractImagingStudyId(payload: any): string | null {
    return payload?.id || payload?.imagingStudyId || null;
  }
}

export const webhookService = new WebhookService();
