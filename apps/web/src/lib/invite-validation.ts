export function validateInviteRoleInput(input: {
  roleId?: string;
  roleIds?: string[];
}): string | null {
  if (input.roleId && input.roleIds && input.roleIds.length > 0) {
    return "Provide either roleId or roleIds, not both.";
  }
  return null;
}
