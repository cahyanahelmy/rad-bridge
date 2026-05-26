import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { config } from '../../config';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors';
import { satusehatClient } from '../../services/satusehat/satusehat.client';
import { buildServiceRequest } from '../../services/satusehat/fhir-builder';
import type { CreateOrderPayload } from '../../types/order';

export class OrdersService {
  /**
   * Create a radiology order.
   * Full workflow: validate → query Encounter → generate accession → create ServiceRequest → save.
   */
  async createOrder(payload: CreateOrderPayload) {
    const {
      encounterId,
      mrn,
      name,
      radLocationId,
      requester,
      performer,
      examCode,
      timeOrdered,
      reasonCode,
      observationText,
      diagnosticReportText,
    } = payload;

    // 1. Validate exam exists
    const exam = await prisma.radiologyExamMaster.findUnique({
      where: { examCode },
    });
    if (!exam) {
      throw new NotFoundError('RadiologyExamMaster', examCode);
    }

    // 2. Query Encounter from SATUSEHAT
    let encounter: any;
    try {
      encounter = await satusehatClient.getEncounter(encounterId);
    } catch (err: any) {
      logger.warn({ encounterId, err: err.message }, 'Failed to query Encounter, proceeding with provided data');
      encounter = null;
    }

    // Extract patient info from Encounter if available
    const patientId = encounter?.subject?.reference?.replace('Patient/', '') || '';
    const patientName = encounter?.subject?.display || '';

    // 3. Generate accession number
    const accessionNumber = await this.generateAccession(exam.accessionPrefix);

    // 4. Build and send ServiceRequest to SATUSEHAT
    let serviceRequestId: string | null = null;
    let serviceRequestStatus = 'FAILED';
    let serviceRequestResponse: any = null;
    let serviceRequestBody: any = null;
    try {
      serviceRequestBody = buildServiceRequest({
        accessionNumber,
        patientId,
        patientName: name || patientName,
        encounterId,
        requesterId: requester?.pratictionerId || '',
        requesterName: requester?.pratictionerName || '',
        performerId: performer?.pratictionerId || '',
        performerName: performer?.pratictionerName || '',
        locationId: radLocationId,
        loincCode: exam.loincCode,
        loincDisplay: exam.loincDisplay,
        examName: exam.examName,
        diagnosaCode: reasonCode?.code || '',
        diagnosaDisplay: reasonCode?.display || '',
        authoredOn: timeOrdered || new Date().toISOString(),
      });

      const response = await satusehatClient.createServiceRequest(serviceRequestBody);
      serviceRequestResponse = response;
      serviceRequestId = response.id || null;
      serviceRequestStatus = 'SUCCESS';
      logger.info({ accessionNumber, serviceRequestId }, '✓ ServiceRequest created in SATUSEHAT');
    } catch (err: any) {
      serviceRequestResponse = err.response?.data || { error: err.message };
      logger.error({ accessionNumber, err: err.message }, '✗ Failed to create ServiceRequest');
      // Continue — save order locally even if SATUSEHAT fails
    }

    // 5. Save order in database
    const order = await prisma.radiologyOrder.create({
      data: {
        accessionNumber,
        encounterId,
        patientId: patientId || null,
        patientName: patientName || null,
        patientNameSimrs: name || null,
        mrn,
        locationId: radLocationId || null,
        requesterPractitionerId: requester?.pratictionerId || null,
        requesterPractitionerName: requester?.pratictionerName || null,
        requesterDepartment: requester?.department || null,
        radiologistPractitionerId: performer?.pratictionerId || null,
        radiologistPractitionerName: performer?.pratictionerName || null,
        examCode,
        serviceRequestId,
        status: 'WAITING_UPLOAD',
        diagnosaCode: reasonCode?.code || null,
        diagnosaDisplay: reasonCode?.display || null,
        observation: observationText || null,
        diagnosticReport: diagnosticReportText || null,
        timeOrdered: timeOrdered ? new Date(timeOrdered) : new Date(),
      },
      include: { exam: true },
    });

    logger.info({ accessionNumber, orderId: order.id }, '✓ Radiology order created');

    // Save ServiceRequest log if built
    if (serviceRequestBody) {
      await prisma.satusehatLog.create({
        data: {
          orderId: order.id,
          resourceType: 'ServiceRequest',
          requestBody: JSON.stringify(serviceRequestBody, null, 2),
          responseBody: JSON.stringify(serviceRequestResponse, null, 2),
          status: serviceRequestStatus,
        }
      });
    }

    return {
      accessionNumber: order.accessionNumber,
      orderId: order.id,
      status: order.status,
      serviceRequestId: order.serviceRequestId,
      encounterId: order.encounterId,
      examCode: order.examCode,
      examName: order.exam.examName,
      createdAt: order.createdAt.toISOString(),
    };
  }

  /**
   * Get all orders with optional filtering.
   */
  async getOrders(params: { status?: string; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { patientNameSimrs: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { accessionNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.radiologyOrder.findMany({
        where,
        include: { exam: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.radiologyOrder.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single order by ID or accession number.
   */
  async getOrder(identifier: string) {
    const order = await prisma.radiologyOrder.findFirst({
      where: {
        OR: [
          { id: identifier },
          { accessionNumber: identifier },
        ],
      },
      include: { exam: true, dicomFiles: true, reports: true, satusehatLogs: { orderBy: { createdAt: 'desc' } } },
    });

    if (!order) {
      throw new NotFoundError('RadiologyOrder', identifier);
    }

    return order;
  }

  /**
   * Ensure ServiceRequest resource is created in SATUSEHAT for an order.
   * If missing, creates it. Throws error if creation fails.
   */
  async ensureServiceRequest(orderId: string): Promise<string> {
    const order = await prisma.radiologyOrder.findUnique({
      where: { id: orderId },
      include: { exam: true },
    });

    if (!order) {
      throw new NotFoundError('RadiologyOrder', orderId);
    }

    if (order.serviceRequestId) {
      return order.serviceRequestId;
    }

    logger.info({ accessionNumber: order.accessionNumber }, 'Attempting to create missing ServiceRequest in SATUSEHAT...');

    // 1. Get patientId if not present (query encounter from SATUSEHAT)
    let patientId = order.patientId;
    let patientName = order.patientName;
    if (!patientId) {
      try {
        const encounter = await satusehatClient.getEncounter(order.encounterId);
        patientId = encounter?.subject?.reference?.replace('Patient/', '') || '';
        patientName = encounter?.subject?.display || '';
        
        // Update order with patient info
        await prisma.radiologyOrder.update({
          where: { id: order.id },
          data: {
            patientId: patientId || null,
            patientName: patientName || null,
          },
        });
      } catch (err: any) {
        logger.error({ encounterId: order.encounterId, err: err.message }, 'Failed to query Encounter during ServiceRequest retry');
        throw new Error(`Failed to query Encounter from SATUSEHAT: ${err.message}`);
      }
    }

    // 2. Build and send ServiceRequest to SATUSEHAT
    let serviceRequestId: string | null = null;
    let serviceRequestStatus = 'FAILED';
    let serviceRequestResponse: any = null;
    let serviceRequestBody: any = null;

    try {
      serviceRequestBody = buildServiceRequest({
        accessionNumber: order.accessionNumber,
        patientId: patientId || '',
        patientName: order.patientNameSimrs || patientName || '',
        encounterId: order.encounterId,
        requesterId: order.requesterPractitionerId || '',
        requesterName: order.requesterPractitionerName || '',
        performerId: order.radiologistPractitionerId || '',
        performerName: order.radiologistPractitionerName || '',
        locationId: order.locationId || '',
        loincCode: order.exam.loincCode,
        loincDisplay: order.exam.loincDisplay,
        examName: order.exam.examName,
        diagnosaCode: order.diagnosaCode || '',
        diagnosaDisplay: order.diagnosaDisplay || '',
        authoredOn: order.timeOrdered ? order.timeOrdered.toISOString() : new Date().toISOString(),
      });

      const response = await satusehatClient.createServiceRequest(serviceRequestBody);
      serviceRequestResponse = response;
      serviceRequestId = response.id || null;
      serviceRequestStatus = 'SUCCESS';
      logger.info({ accessionNumber: order.accessionNumber, serviceRequestId }, '✓ ServiceRequest created in SATUSEHAT');
    } catch (err: any) {
      serviceRequestResponse = err.response?.data || { error: err.message };
      logger.error({ accessionNumber: order.accessionNumber, err: err.message }, '✗ Failed to create ServiceRequest');
      throw new Error(`Failed to create ServiceRequest in SATUSEHAT: ${err.message}`);
    } finally {
      // Save ServiceRequest log if built
      if (serviceRequestBody) {
        await prisma.satusehatLog.create({
          data: {
            orderId: order.id,
            resourceType: 'ServiceRequest',
            requestBody: JSON.stringify(serviceRequestBody, null, 2),
            responseBody: JSON.stringify(serviceRequestResponse, null, 2),
            status: serviceRequestStatus,
          }
        });
      }
    }

    if (!serviceRequestId) {
      throw new Error('ServiceRequest creation returned empty ID');
    }

    // Update order in database
    await prisma.radiologyOrder.update({
      where: { id: order.id },
      data: {
        serviceRequestId,
      },
    });

    return serviceRequestId;
  }

  /**
   * Generate atomic accession number: PREFIX-YYYYMMDD-SEQ
   */
  private async generateAccession(prefix: string): Promise<string> {
    const dateStr = dayjs().format('YYYYMMDD');

    // Atomic upsert + increment
    const sequence = await prisma.accessionSequence.upsert({
      where: {
        prefix_date: { prefix, date: dateStr },
      },
      update: {
        currentSeq: { increment: 1 },
      },
      create: {
        prefix,
        date: dateStr,
        currentSeq: 1,
      },
    });

    const seqStr = String(sequence.currentSeq).padStart(3, '0');
    return `${prefix}-${dateStr}-${seqStr}`;
  }
}

export const ordersService = new OrdersService();
