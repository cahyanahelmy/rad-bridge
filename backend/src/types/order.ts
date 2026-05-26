/**
 * Radiology order types.
 */

export interface CreateOrderPayload {
  encounterId: string;
  mrn: string;
  name: string; // Patient original name from SIMRS
  radLocationId: string;
  requester: {
    pratictionerId: string;
    pratictionerName: string;
    department: string;
  };
  performer: {
    pratictionerId: string;
    pratictionerName: string;
  };
  examCode: string;
  timeOrdered: string;
  reasonCode: {
    code: string;
    display: string;
  };
  observationText?: string;
  diagnosticReportText?: string;
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
