import { randomUUID } from 'node:crypto';
import type { AuthUser, StoredUser, UserRole } from './auth.js';

export interface Organization {
  id: string;
  nameEn: string;
  nameAr?: string;
  tradeLicenseNo?: string;
  emirate: string;
  hceeFlag: boolean;
}

export interface Facility {
  id: string;
  orgId: string;
  name: string;
  emirate: string;
  sector?: string;
  jurisdictions: string[];
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  role: UserRole;
  token: string;
  createdAt: string;
}

export const organizations = new Map<string, Organization>();
export const facilities = new Map<string, Facility>();
export const users = new Map<string, StoredUser>();
export const invitations = new Map<string, Invitation>();

export function createOrganization(input: Omit<Organization, 'id'>): Organization {
  const organization = { id: randomUUID(), ...input };
  organizations.set(organization.id, organization);
  return organization;
}

export function createFacility(input: Omit<Facility, 'id'>): Facility {
  const facility = { id: randomUUID(), ...input };
  facilities.set(facility.id, facility);
  return facility;
}

export function toAuthUser(user: StoredUser): AuthUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export function hasOrgRole(user: AuthUser, roles: readonly UserRole[]): boolean {
  return user.orgId.length > 0 && roles.includes(user.role);
}
