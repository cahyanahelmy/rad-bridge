import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import type { FhirServiceRequest, FhirDiagnosticReport, FhirObservation } from '../../types/fhir';

/**
 * FHIR Resource Builder.
 * Uses templates from fhir_templates/ and replaces placeholder tokens.
 */

const TEMPLATES_DIR = path.resolve(__dirname, '../../../../fhir_templates');

function loadTemplate(filename: string): any {
  const filePath = path.join(TEMPLATES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function replaceTokens(obj: any, tokens: Record<string, any>): any {
  const json = JSON.stringify(obj);
  let result = json;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
  }
  return JSON.parse(result);
}

export interface ServiceRequestParams {
  accessionNumber: string;
  patientId: string;
  patientName: string;
  encounterId: string;
  requesterId: string;
  requesterName: string;
  performerId: string;
  performerName: string;
  locationId: string;
  loincCode: string;
  loincDisplay: string;
  examName: string;
  diagnosaCode: string;
  diagnosaDisplay: string;
  authoredOn: string;
}

export function buildServiceRequest(params: ServiceRequestParams): FhirServiceRequest {
  const template = loadTemplate('ServiceRequest.json');
  return replaceTokens(template, {
    ...params,
    organizationId: config.satusehat.orgId,
  });
}

export interface DiagnosticReportParams {
  accessionNumber: string;
  patientId: string;
  patientName: string;
  encounterId: string;
  performerId: string;
  performerName: string;
  serviceRequestId: string;
  imagingStudyId: string;
  loincCode: string;
  loincDisplay: string;
  diagnosaCode: string;
  diagnosaDisplay: string;
  conclusion: string;
  effectiveDateTime: string;
  issuedDateTime: string;
  observationId: string;
}

export function buildDiagnosticReport(params: DiagnosticReportParams): FhirDiagnosticReport {
  const template = loadTemplate('DiagnosticReport.json');
  return replaceTokens(template, {
    ...params,
    organizationId: config.satusehat.orgId,
  });
}

export interface ObservationParams {
  patientId: string;
  patientName: string;
  encounterId: string;
  performerId: string;
  performerName: string;
  loincCode: string;
  loincDisplay: string;
  observationValue: string;
  effectiveDateTime: string;
  issuedDateTime: string;
}

export function buildObservation(params: ObservationParams): FhirObservation {
  const template = loadTemplate('Observation.json');
  return replaceTokens(template, params);
}
