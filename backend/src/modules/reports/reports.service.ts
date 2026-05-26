import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { satusehatClient } from '../../services/satusehat/satusehat.client';
import { buildDiagnosticReport, buildObservation } from '../../services/satusehat/fhir-builder';
import { NotFoundError, ValidationError } from '../../lib/errors';

export class ReportsService {
  /**
   * Create a DiagnosticReport for an order.
   * Sends Observation + DiagnosticReport to SATUSEHAT if ImagingStudy exists.
   */
  async createReport(params: {
    orderId: string;
    radiologistId: string;
    observation: string;
    diagnosticReport: string;
  }) {
    const { orderId, radiologistId, observation, diagnosticReport } = params;

    // Get order with exam info
    const order = await prisma.radiologyOrder.findUnique({
      where: { id: orderId },
      include: { exam: true },
    });
    if (!order) throw new NotFoundError('RadiologyOrder', orderId);

    if (!order.imagingstudyId) {
      throw new ValidationError('Cannot create DiagnosticReport: ImagingStudy not yet available');
    }

    // Get radiologist info
    const radiologist = await prisma.user.findUnique({ where: { id: radiologistId } });
    if (!radiologist) throw new NotFoundError('User', radiologistId);

    const now = new Date().toISOString();

    // -------------------------------------------------------------------------
    // Step 1: Send Observation to SATUSEHAT
    // -------------------------------------------------------------------------
    let observationSatusehatId: string | null = null;
    {
      const observationBody = buildObservation({
        patientId: order.patientId || '',
        patientName: order.patientName || '',
        encounterId: order.encounterId,
        performerId: order.radiologistPractitionerId || '',
        performerName: radiologist.fullName,
        loincCode: order.exam.loincCode,
        loincDisplay: order.exam.loincDisplay,
        observationValue: observation,
        effectiveDateTime: now,
        issuedDateTime: now,
      });

      let observationResponse: any = null;
      let observationStatus = 'FAILED';
      try {
        const response = await satusehatClient.createObservation(observationBody);
        observationResponse = response;
        observationSatusehatId = response.id || null;
        observationStatus = 'SUCCESS';
        logger.info({ accessionNumber: order.accessionNumber, observationId: observationSatusehatId }, '✓ Observation sent to SATUSEHAT');
      } catch (err: any) {
        observationResponse = err.response?.data || { error: err.message };
        logger.error({ err: err.message, orderId }, '✗ Failed to send Observation to SATUSEHAT');
      }

      await prisma.satusehatLog.create({
        data: {
          orderId,
          resourceType: 'Observation',
          requestBody: JSON.stringify(observationBody, null, 2),
          responseBody: JSON.stringify(observationResponse, null, 2),
          status: observationStatus,
        }
      });
    }

    // -------------------------------------------------------------------------
    // Step 2: Send DiagnosticReport to SATUSEHAT
    // -------------------------------------------------------------------------
    let satusehatId: string | null = null;
    {
      const reportBody = buildDiagnosticReport({
        accessionNumber: order.accessionNumber,
        patientId: order.patientId || '',
        patientName: order.patientName || '',
        encounterId: order.encounterId,
        performerId: order.radiologistPractitionerId || '',
        performerName: radiologist.fullName,
        serviceRequestId: order.serviceRequestId || '',
        imagingStudyId: order.imagingstudyId,
        loincCode: order.exam.loincCode,
        loincDisplay: order.exam.loincDisplay,
        diagnosaCode: order.diagnosaCode || '',
        diagnosaDisplay: order.diagnosaDisplay || '',
        conclusion: diagnosticReport,
        effectiveDateTime: now,
        issuedDateTime: now,
      });

      let diagnosticResponse: any = null;
      let diagnosticStatus = 'FAILED';
      try {
        const response = await satusehatClient.createDiagnosticReport(reportBody);
        diagnosticResponse = response;
        satusehatId = response.id || null;
        diagnosticStatus = 'SUCCESS';
        logger.info({ accessionNumber: order.accessionNumber, satusehatId }, '✓ DiagnosticReport sent to SATUSEHAT');
      } catch (err: any) {
        diagnosticResponse = err.response?.data || { error: err.message };
        logger.error({ err: err.message, orderId }, '✗ Failed to send DiagnosticReport to SATUSEHAT');
      }

      await prisma.satusehatLog.create({
        data: {
          orderId,
          resourceType: 'DiagnosticReport',
          requestBody: JSON.stringify(reportBody, null, 2),
          responseBody: JSON.stringify(diagnosticResponse, null, 2),
          status: diagnosticStatus,
        }
      });
    }

    // -------------------------------------------------------------------------
    // Step 3: Save locally
    // -------------------------------------------------------------------------
    const report = await prisma.diagnosticReport.create({
      data: {
        orderId,
        radiologistId,
        observation,
        diagnosticReport,
        satusehatId,
        sentToSatusehat: !!satusehatId,
        sentAt: satusehatId ? new Date() : null,
      },
    });

    // Update order status
    await prisma.radiologyOrder.update({
      where: { id: orderId },
      data: {
        status: 'REPORT_CREATED',
        diagnosticreportId: satusehatId,
        observation,
        diagnosticReport,
      },
    });

    return report;
  }

  async getReports(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.diagnosticReport.findMany({
        include: {
          order: { include: { exam: true } },
          radiologist: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.diagnosticReport.count(),
    ]);

    return { data: reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const reportsService = new ReportsService();
