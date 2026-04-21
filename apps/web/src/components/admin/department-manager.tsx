"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/use-api-client";
import { useAppStore } from "@/store/app-store";
import type { DepartmentEntity } from "@/lib/types";
import { Button, Card, InlineError, Input, Label, SectionTitle, Textarea } from "@/components/ui/primitives";

export function DepartmentManager({ tenantId }: { tenantId: string }) {
  const apiClient = useApiClient();
  const addKnownDepartment = useAppStore((state) => state.addKnownDepartment);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<DepartmentEntity | null>(null);

  const createDepartmentMutation = useMutation({
    mutationFn: () =>
      apiClient.post<DepartmentEntity>(`/v1/tenants/${tenantId}/departments`, {
        body: { name: name.trim(), description: description.trim() || undefined }
      }),
    onSuccess: (department) => {
      setName("");
      setDescription("");
      setLastCreated(department);
      addKnownDepartment(tenantId, { id: department.id, name: department.name });
      setTargetDepartmentId(department.id);
      setError(null);
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to create department.");
    }
  });

  const assignMemberMutation = useMutation({
    mutationFn: (input: { departmentId: string; userId: string }) =>
      apiClient.post(`/v1/tenants/${tenantId}/departments/${input.departmentId}/members`, {
        body: { userId: input.userId }
      }),
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to assign member.");
    }
  });

  const assignHodMutation = useMutation({
    mutationFn: (input: { departmentId: string; userId: string }) =>
      apiClient.post(`/v1/tenants/${tenantId}/departments/${input.departmentId}/hods`, {
        body: { userId: input.userId }
      }),
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Failed to assign HOD.");
    }
  });

  function onCreateDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }
    createDepartmentMutation.mutate();
  }

  async function assign(kind: "member" | "hod") {
    setError(null);
    const departmentId = targetDepartmentId.trim();
    const userId = targetUserId.trim();
    if (!departmentId || !userId) {
      setError("Department ID and User ID are required.");
      return;
    }
    if (kind === "hod") {
      await assignHodMutation.mutateAsync({ departmentId, userId });
      return;
    }
    await assignMemberMutation.mutateAsync({ departmentId, userId });
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Create Department" subtitle="Stores department id locally for quick reuse." />
        <form className="space-y-3" onSubmit={onCreateDepartment}>
          <div>
            <Label htmlFor="department-name">Department Name</Label>
            <Input
              id="department-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="department-description">Description (optional)</Label>
            <Textarea
              id="department-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <Button type="submit" disabled={createDepartmentMutation.isPending}>
            {createDepartmentMutation.isPending ? "Creating..." : "Create Department"}
          </Button>
        </form>
        {lastCreated ? (
          <p className="mt-3 text-sm text-brand-moss">
            Last created: <strong>{lastCreated.name}</strong> ({lastCreated.id})
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Assign HOD / Member" subtitle="Assign users after tenant membership is active." />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="target-department-id">Department ID</Label>
            <Input
              id="target-department-id"
              value={targetDepartmentId}
              onChange={(event) => setTargetDepartmentId(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="target-user-id">User ID</Label>
            <Input
              id="target-user-id"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            disabled={assignHodMutation.isPending || assignMemberMutation.isPending}
            onClick={() => {
              void assign("hod");
            }}
          >
            Assign HOD
          </Button>
          <Button
            disabled={assignHodMutation.isPending || assignMemberMutation.isPending}
            onClick={() => {
              void assign("member");
            }}
          >
            Assign Member
          </Button>
        </div>
        <InlineError message={error} />
      </Card>
    </div>
  );
}
