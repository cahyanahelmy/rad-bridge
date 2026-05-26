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
    const { encounterId, locationId, requesterPractitionerId, radiologistPractitionerId, mrn, examCode, timeOrdered, diagnosa, observation, diagnosticReport } = payload;

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
        patientName,
        encounterId,
        requesterId: requesterPractitionerId,
        requesterName: '',
        performerId: radiologistPractitionerId,
        performerName: '',
        locationId,
        loincCode: exam.loincCode,
        loincDisplay: exam.loincDisplay,
        examName: exam.examName,
        diagnosaCode: diagnosa.code,
        diagnosaDisplay: diagnosa.display,
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
        mrn,
        locationId,
        requesterPractitionerId,
        radiologistPractitionerId,
        examCode,
        serviceRequestId,
        status: 'WAITING_UPLOAD',
        diagnosaCode: diagnosa.code,
        diagnosaDisplay: diagnosa.display,
        observation,
        diagnosticReport,
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
