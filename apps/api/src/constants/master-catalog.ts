import type { FieldType } from "../types/domain";
import { PERMISSIONS } from "./permissions";

export interface PermissionCatalogSeed {
  key: string;
  name: string;
  description: string;
  module: string;
  configurable: boolean;
}

export interface FieldCatalogSeed {
  key: FieldType;
  name: string;
  description: string;
  supportsOptions: boolean;
  supportsNumericRange: boolean;
  configurable: boolean;
  order: number;
}

export const PERMISSION_CATALOG_SEED: PermissionCatalogSeed[] = [
  {
    key: PERMISSIONS.tenantManage,
    name: "Tenant Management",
    description: "Manage tenant-level settings and governance.",
    module: "tenant",
    configurable: true
  },
  {
    key: PERMISSIONS.departmentManage,
    name: "Department Management",
    description: "Create and manage tenant departments.",
    module: "department",
    configurable: true
  },
  {
    key: PERMISSIONS.memberManage,
    name: "Member Management",
    description: "Invite members and manage user-role assignments.",
    module: "member",
    configurable: true
  },
  {
    key: PERMISSIONS.roleManage,
    name: "Role Management",
    description: "Create and update tenant roles and permissions.",
    module: "role",
    configurable: true
  },
  {
    key: PERMISSIONS.taskTemplateManage,
    name: "Task Template Management",
    description: "Create and maintain task templates.",
    module: "task",
    configurable: true
  },
  {
    key: PERMISSIONS.taskAssign,
    name: "Task Assignment",
    description: "Assign task templates to departments.",
    module: "task",
    configurable: true
  },
  {
    key: PERMISSIONS.activityCreate,
    name: "Activity Create",
    description: "Create and submit activity entries.",
    module: "activity",
    configurable: true
  },
  {
    key: PERMISSIONS.activityApprove,
    name: "Activity Approval",
    description: "Approve and reject department activity entries.",
    module: "activity",
    configurable: true
  },
  {
    key: PERMISSIONS.reportView,
    name: "Report View",
    description: "View department activity and reporting data.",
    module: "report",
    configurable: true
  }
];

export const FIELD_CATALOG_SEED: FieldCatalogSeed[] = [
  {
    key: "text",
    name: "Text",
    description: "Single-line text input.",
    supportsOptions: false,
    supportsNumericRange: false,
    configurable: true,
    order: 1
  },
  {
    key: "textarea",
    name: "Long Text",
    description: "Multi-line text input.",
    supportsOptions: false,
    supportsNumericRange: false,
    configurable: true,
    order: 2
  },
  {
    key: "number",
    name: "Number",
    description: "Numeric input with optional min/max constraints.",
    supportsOptions: false,
    supportsNumericRange: true,
    configurable: true,
    order: 3
  },
  {
    key: "date",
    name: "Date Time",
    description: "ISO date-time input.",
    supportsOptions: false,
    supportsNumericRange: false,
    configurable: true,
    order: 4
  },
  {
    key: "select",
    name: "Select",
    description: "Single-select input with predefined options.",
    supportsOptions: true,
    supportsNumericRange: false,
    configurable: true,
    order: 5
  },
  {
    key: "checkbox",
    name: "Checkbox",
    description: "Boolean true/false input.",
    supportsOptions: false,
    supportsNumericRange: false,
    configurable: true,
    order: 6
  }
];

