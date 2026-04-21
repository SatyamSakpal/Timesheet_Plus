import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-tenant-permissions", () => ({
  useTenantPermissions: vi.fn()
}));

import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { PermissionGate } from "@/components/layout/permission-gate";

describe("PermissionGate", () => {
  it("renders children when permission exists", () => {
    vi.mocked(useTenantPermissions).mockReturnValue({
      permissions: new Set(["activity.create"]),
      roleResolutionFailed: false,
      isLoading: false
    });

    render(
      <PermissionGate permission="activity.create">
        <div>allowed</div>
      </PermissionGate>
    );

    expect(screen.getByText("allowed")).toBeInTheDocument();
  });

  it("renders fallback when permission is missing", () => {
    vi.mocked(useTenantPermissions).mockReturnValue({
      permissions: new Set(),
      roleResolutionFailed: false,
      isLoading: false
    });

    render(
      <PermissionGate permission="activity.create" fallback={<div>blocked</div>}>
        <div>allowed</div>
      </PermissionGate>
    );

    expect(screen.getByText("blocked")).toBeInTheDocument();
  });
});
