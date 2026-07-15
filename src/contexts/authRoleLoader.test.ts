import { describe, expect, it, vi } from "vitest";
import {
  isTransientRoleFetchError,
  loadRolesWithTransientRetry,
  roleLoadErrorMessage,
} from "./authRoleLoader";

describe("auth role loading", () => {
  it("returns roles on the first successful request", async () => {
    const request = vi.fn().mockResolvedValue({ data: ["OWNER"], error: null });

    await expect(loadRolesWithTransientRetry(request)).resolves.toEqual(["OWNER"]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retries one transient transport failure", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new TypeError("Failed to fetch") })
      .mockResolvedValueOnce({ data: ["ADMIN"], error: null });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(loadRolesWithTransientRetry(request, wait)).resolves.toEqual(["ADMIN"]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(250);
  });

  it("does not retry a permission or contract failure", async () => {
    const error = { message: "permission denied", code: "42501" };
    const request = vi.fn().mockResolvedValue({ data: null, error });
    const wait = vi.fn();

    await expect(loadRolesWithTransientRetry(request, wait)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("classifies and formats transport errors without any casts", () => {
    expect(isTransientRoleFetchError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientRoleFetchError({ message: "permission denied" })).toBe(false);
    expect(roleLoadErrorMessage({ message: "permission denied" })).toBe("permission denied");
  });
});
