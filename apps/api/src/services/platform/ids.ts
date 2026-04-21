export function tenantMembershipId(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

export function departmentMembershipId(
  tenantId: string,
  departmentId: string,
  userId: string
): string {
  return `${tenantId}:${departmentId}:${userId}`;
}

export function departmentHodId(tenantId: string, departmentId: string, userId: string): string {
  return `${tenantId}:${departmentId}:${userId}`;
}

