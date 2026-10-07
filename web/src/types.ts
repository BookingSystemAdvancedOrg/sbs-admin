export type TenantStatus =
  | "provisioning" | "provisioning_failed" | "active" | "suspended" | "offboarding" | "offboarded";

export type Features = Record<string, boolean>;

export interface Plan {
  planId: string;
  name: string;
  maxLocations: number;
  features: Features;
}

export interface Address {
  street: string;
  postalCode: string;
  city: string;
  country?: string;
}

export interface StripeState {
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirementsDue?: string[];
  disconnected?: boolean;
  updatedAt?: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planId: string;
  entitlements: { maxLocations: number; features: Features };
  locationCount: number;
  ownerEmail?: string;
  ownerName?: string;
  ownerPhone?: string;
  legalName?: string;
  orgNumber?: string;
  vatNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  address?: Address;
  branding?: Record<string, unknown>;
  notes?: string;
  primaryDomain?: string;
  stripe?: StripeState;
  lastError?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface TenantSummary {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planId: string;
  locationCount: number;
  maxLocations?: number;
  chargesEnabled: boolean;
  primaryDomain?: string;
  ownerEmail?: string;
  createdAt?: string;
}

export interface Location {
  locationId: string;
  tenantId: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  stripeAccountId?: string;
  createdAt?: string;
}

export type LocationInput = { name: string; address: string; phone?: string; email?: string; stripeAccountId?: string };

export interface Domain {
  domain: string;
  kind: "platform" | "custom";
  status: string;
  primary: boolean;
  lastError?: string;
  distributionTenantId?: string;
}

export interface AuditEntry {
  action: string;
  by: string;
  at: string;
  details?: Record<string, unknown>;
}

export interface TenantDetail {
  tenant: Tenant;
  domains: Domain[];
  locations: Location[];
  userCount: number;
  onboarding: { status: string; startDate: string; stopDate?: string } | null;
  audit: AuditEntry[];
}

export interface TenantUser {
  cognitoSub: string;
  email: string;
  name?: string;
  role: "owner_user" | "staff_user";
  status?: string;
  locationId?: string;
  createdAt?: string;
}

export interface NewTenantInput {
  name: string;
  slug: string;
  planId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  legalName?: string;
  orgNumber?: string;
  vatNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  address?: Address;
  notes?: string;
  overrides?: { maxLocations?: number };
  locations: LocationInput[];
}
