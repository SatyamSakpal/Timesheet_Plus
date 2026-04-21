import { ALL_PERMISSION_KEYS, PERMISSIONS } from "./permissions";

export const SYSTEM_ROLE_KEYS = {
  owner: "owner",
  hod: "head_of_department",
  staff: "staff"
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[keyof typeof SYSTEM_ROLE_KEYS];

export interface DefaultRoleDefinition {
  key: SystemRoleKey;
  name: string;
  permissionKeys: string[];
}

export const DEFAULT_TENANT_ROLES: DefaultRoleDefinition[] = [
  {
    key: SYSTEM_ROLE_KEYS.owner,
    name: "Owner",
    permissionKeys: [...ALL_PERMISSION_KEYS]
  },
  {
    key: SYSTEM_ROLE_KEYS.hod,
    name: "Head of Department",
    permissionKeys: [
      PERMISSIONS.activityApprove,
      PERMISSIONS.reportView,
      PERMISSIONS.activityCreate
    ]
  },
  {
    key: SYSTEM_ROLE_KEYS.staff,
    name: "Staff",
    permissionKeys: [PERMISSIONS.activityCreate]
  }
];

