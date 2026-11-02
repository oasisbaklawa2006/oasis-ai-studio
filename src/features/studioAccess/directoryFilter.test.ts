import { describe, expect, it } from "vitest";
import { filterStudioDirectory } from "./directoryFilter";
import type { StudioAccessRow } from "./studioAccessContract";

const row = (
  user_id: string,
  display_name: string,
  email: string,
  studio_status: string,
  profile_keys: string[] = [],
  core_active = true,
  invite_status = "accepted",
): StudioAccessRow => ({
  user_id,
  display_name,
  email,
  studio_status,
  profile_keys,
  core_active,
  invite_status,
  overrides: {},
  version: 0,
});

const rows = [
  row("1", "Alex Creator", "alex@example.org", "not_assigned"),
  row("2", "Maya Owner", "maya@example.org", "active", ["owner"]),
  row("3", "Neel Editor", "neel@example.org", "active", ["product_editor"]),
  row("4", "Riya Suspended", "riya@example.org", "not_assigned", [], false),
];

describe("Studio directory presentation filtering", () => {
  it("shows the complete server-authorized directory by default", () => {
    expect(filterStudioDirectory(rows, "", "all")).toHaveLength(4);
  });

  it("searches case-insensitive names and emails without altering records", () => {
    expect(filterStudioDirectory(rows, "  CREATOR  ", "all").map((x) => x.user_id)).toEqual(["1"]);
    expect(filterStudioDirectory(rows, "NEEL@", "all").map((x) => x.user_id)).toEqual(["3"]);
    expect(rows).toHaveLength(4);
  });

  it("distinguishes unassigned, active, and protected identities", () => {
    expect(filterStudioDirectory(rows, "", "unassigned").map((x) => x.user_id)).toEqual(["1", "4"]);
    expect(filterStudioDirectory(rows, "", "active").map((x) => x.user_id)).toEqual(["2", "3"]);
    expect(filterStudioDirectory(rows, "", "protected").map((x) => x.user_id)).toEqual(["2"]);
  });

  it("shows Core inactive or unapproved staff separately", () => {
    expect(filterStudioDirectory(rows, "", "inactive").map((x) => x.user_id)).toEqual(["4"]);
  });

  it("combines filters with search safely and produces no extra staff", () => {
    expect(filterStudioDirectory(rows, "maya", "unassigned")).toEqual([]);
  });
});
