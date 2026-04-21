"use client";

import { useState } from "react";
import type { TaskTemplate } from "@/lib/types";
import { DepartmentTaskAssignment } from "@/components/admin/department-task-assignment";
import { TaskTemplateBuilder } from "@/components/admin/task-template-builder";
import { TenantRequired } from "@/components/layout/tenant-required";
import { useActiveTenant } from "@/hooks/use-active-tenant";

export default function AdminTasksPage() {
  const { activeTenantId } = useActiveTenant();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);

  if (!activeTenantId) {
    return <TenantRequired />;
  }

  return (
    <div className="space-y-4">
      <TaskTemplateBuilder
        tenantId={activeTenantId}
        onCreated={(template) => setTemplates((state) => [template, ...state])}
      />
      <DepartmentTaskAssignment tenantId={activeTenantId} templates={templates} />
    </div>
  );
}
