import { describe, expect, it } from "vitest";
import { validateInviteRoleInput } from "@/lib/invite-validation";

describe("validateInviteRoleInput", () => {
  it("rejects payload with roleId and roleIds together", () => {
    const error = validateInviteRoleInput({
      roleId: "role-a",
      roleIds: ["role-b"]
    });
    expect(error).toBe("Provide either roleId or roleIds, not both.");
  });

  it("accepts payload with roleId only", () => {
    const error = validateInviteRoleInput({ roleId: "role-a", roleIds: [] });
    expect(error).toBeNull();
  });
});
