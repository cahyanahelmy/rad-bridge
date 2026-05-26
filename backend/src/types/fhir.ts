/**
 * FHIR R4 resource types for SATUSEHAT integration.
 */

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  system: string;
  value: string;
  use?: string;
}

export interface FhirServiceRequest {
  resourceType: 'ServiceRequest';
  identifier: FhirIdentifier[];
  status: 'active' | 'completed' | 'revoked';
  intent: 'order' | 'plan' | 'proposal';
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter: FhirReference;
  authoredOn: string;
  requester: FhirReference;
  performer: FhirReference[];
  reasonCode: FhirCodeableConcept[];
  locationReference?: FhirReference[];
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  identifier?: FhirIdentifier[];
  status: 'registered' | 'partial' | 'preliminary' | 'final';
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer: FhirReference[];
  basedOn?: FhirReference[];
  imagingStudy?: FhirReference[];
  conclusion?: string;
  conclusionCode?: FhirCodeableConcept[];
}

export interface FhirObservation {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  encounter: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  valueString?: string;
}

export interface FhirImagingStudy {
  resourceType: 'ImagingStudy';
  id?: string;
  identifier?: FhirIdentifier[];
  status: 'available' | 'registered';
  subject: FhirReference;
  encounter?: FhirReference;
  basedOn?: FhirReference[];
  numberOfSeries?: number;
  numberOfInstances?: number;
  description?: string;
}

export interface SatusehatTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface SatusehatEncounter {
  resourceType: 'Encounter';
  id: string;
  status: string;
  class: FhirCoding;
  subject: FhirReference;
  participant?: Array<{
    individual: FhirReference;
  }>;
  serviceProvider?: FhirReference;
  location?: Array<{
    location: FhirReference;
  }>;
}
