/**
 * Radiology order types.
 */

export interface CreateOrderPayload {
  encounterId: string;
  locationId: string;
  requesterPractitionerId: string;
  radiologistPractitionerId: string;
  mrn: string;
  timeOrdered: string;
  diagnosa: {
    code: string;
    display: string;
  };
  examCode: string;
  observation?: string;
  diagnosticReport?: string;
}

export interface OrderResponse {
  accessionNumber: string;
  orderId: string;
  status: string;
  serviceRequestId?: string;
  encounterId: string;
  examCode: string;
  examName: string;
  createdAt: string;
}
