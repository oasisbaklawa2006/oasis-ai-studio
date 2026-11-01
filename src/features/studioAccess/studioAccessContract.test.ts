import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseStudioAccessRow,
  readStudioAccessDirectory,
  setStudioAccess,
  STUDIO_PERMISSIONS,
  STUDIO_PROFILES,
} from "./studioAccessContract";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mock.rpc },
}));

beforeEach(() => {
  mock.rpc.mockReset();
});

describe("governed AI Studio access client (#272)", () => {
  it("rejects malformed directory identities instead of inventing users", () => {
    expect(parseStudioAccessRow(null)).toBeNull();
    expect(parseStudioAccessRow({ email: "person@example.com" })).toBeNull();
  });

  it("parses approved Core fields and filters invalid overrides", () => {
    const row = parseStudioAccessRow({
      user_id: "real-uuid",
      email: "person@example.com",
      core_active: true,
      invite_status: "pending",
      studio_status: "pending_approval",
      profile_keys: ["viewer"],
      version: 2,
      overrides: {
        "ai_studio.products.update": false,
        "other_app.finance.manage": true,
        "ai_studio.products.read": "yes",
      },
    });
    expect(row?.studio_status).toBe("pending_approval");
    expect(row?.version).toBe(2);
    expect(row?.overrides).toEqual({ "ai_studio.products.update": false });
  });

  it("uses closed, Studio-only permission catalog and no hard-delete/finance", () => {
    expect(STUDIO_PERMISSIONS.every((key) => key.startsWith("ai_studio."))).toBe(true);
    expect(STUDIO_PERMISSIONS).not.toContain("ai_studio.products.delete");
    expect(STUDIO_PERMISSIONS.some((key) => key.includes("financial.approve"))).toBe(false);
    expect(STUDIO_PROFILES.some((profile) => profile.key === "owner")).toBe(false);
  });

  it("fails closed when Core authorization RPC is unavailable", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    await expect(readStudioAccessDirectory()).rejects.toThrow("not configured");
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("blocks unauthorized directory reads even with a valid login", async () => {
    mock.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(readStudioAccessDirectory()).rejects.toThrow("Access denied");
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("queries directory only after Core permission succeeds", async () => {
    mock.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({
        data: [{ user_id: "staff-1", studio_status: "active", profile_keys: ["viewer"] }],
        error: null,
      });
    const rows = await readStudioAccessDirectory();
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe("staff-1");
    expect(mock.rpc.mock.calls.map((call: string[]) => call[0])).toEqual([
      "can_manage_ai_studio_access_v1",
      "list_ai_studio_access_v1",
    ]);
  });

  it("never sends invalid owner or global privilege grants", async () => {
    await expect(setStudioAccess({
      userId: "staff-1", status: "active", profiles: ["owner"], overrides: {},
      reason: "Operator approval", expectedVersion: 0,
    })).rejects.toThrow("Owner and unknown");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("refuses activation without a role and rejects short audit reasons", async () => {
    await expect(setStudioAccess({
      userId: "staff-1", status: "active", profiles: [], overrides: {},
      reason: "Access approved", expectedVersion: 0,
    })).rejects.toThrow("at least one");
    await expect(setStudioAccess({
      userId: "staff-1", status: "active", profiles: ["viewer"], overrides: {},
      reason: "short", expectedVersion: 0,
    })).rejects.toThrow("audit reason");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("sends scoped, version-bound changes to Core only", async () => {
    mock.rpc.mockResolvedValueOnce({ data: { version: 3 }, error: null });
    await setStudioAccess({
      userId: "staff-1", status: "suspended", profiles: ["viewer"],
      overrides: { "ai_studio.products.update": false },
      reason: "Account reassignment", expectedVersion: 2,
    });
    expect(mock.rpc).toHaveBeenCalledWith("set_ai_studio_access_v1", {
      p_user_id: "staff-1",
      p_status: "suspended",
      p_profiles: ["viewer"],
      p_overrides: { "ai_studio.products.update": false },
      p_reason: "Account reassignment",
      p_expected_version: 2,
    });
  });
});
