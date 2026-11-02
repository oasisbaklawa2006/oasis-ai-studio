import { Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  filterStudioDirectory,
  type StudioDirectoryFilter,
} from "@/features/studioAccess/directoryFilter";
import {
  readStudioAccessAudit,
  readStudioAccessDirectory,
  STUDIO_ACCESS_STATUSES,
  STUDIO_PERMISSIONS,
  STUDIO_PROFILES,
  type StudioAccessRow,
  type StudioAccessStatus,
  type StudioAuditEntry,
  setStudioAccess,
} from "@/features/studioAccess/studioAccessContract";

const EMPTY: Record<string, boolean> = {};

/**
 * Administration is entirely Core RPC-authorized. This page does not inspect a
 * frontend role matrix for privileged changes and never uses the service key.
 */
export default function UsersAccess() {
  const [directory, setDirectory] = useState<StudioAccessRow[]>([]);
  const [search, setSearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<StudioDirectoryFilter>("all");
  const [selected, setSelected] = useState<StudioAccessRow | null>(null);
  const [status, setStatus] = useState<StudioAccessStatus>("pending_approval");
  const [profiles, setProfiles] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(EMPTY);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<StudioAuditEntry[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const selectedIdRef = useRef<string | null>(null);

  const select = useCallback((row: StudioAccessRow) => {
    selectedIdRef.current = row.user_id;
    setAudit(null);
    setAuditError(null);
    setSelected(row);
    setStatus(
      STUDIO_ACCESS_STATUSES.includes(row.studio_status as StudioAccessStatus)
        ? (row.studio_status as StudioAccessStatus)
        : "pending_approval",
    );
    setProfiles(row.profile_keys.filter((key) => STUDIO_PROFILES.some((p) => p.key === key)));
    setOverrides({ ...row.overrides });
    setReason("");
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await readStudioAccessDirectory();
      setDirectory(rows);
      // Re-select through select() so status/profiles/overrides/reason always match the
      // exact row (and version) that the next save will submit.
      const current = selectedIdRef.current
        ? rows.find((row) => row.user_id === selectedIdRef.current)
        : undefined;
      if (current) select(current);
      else {
        selectedIdRef.current = null;
        setSelected(null);
      }
    } catch (e: unknown) {
      setDirectory([]);
      selectedIdRef.current = null;
      setSelected(null);
      setError(e instanceof Error ? e.message : "Studio access authority unavailable.");
    } finally {
      setLoading(false);
    }
  }, [select]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await setStudioAccess({
        userId: selected.user_id,
        status,
        profiles,
        overrides,
        reason,
        expectedVersion: selected.version,
      });
      toast.success("Studio permission change recorded by Core.");
      setReason("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Access change was not accepted.");
    } finally {
      setSaving(false);
    }
  };

  const loadAudit = async () => {
    if (!selected) return;
    setAuditError(null);
    try {
      setAudit(await readStudioAccessAudit({ userId: selected.user_id, limit: 25 }));
    } catch (e: unknown) {
      setAudit(null);
      setAuditError(e instanceof Error ? e.message : "Audit history unavailable.");
    }
  };

  const visibleDirectory = useMemo(
    () => filterStudioDirectory(directory, search, directoryFilter),
    [directory, search, directoryFilter],
  );
  const protectedOwner = selected?.profile_keys.includes("owner") ?? false;
  const cannotActivate =
    status === "active" &&
    (!selected?.core_active || !["active", "accepted"].includes(selected.invite_status ?? ""));

  return (
    <>
      <PageHeader
        title="Users & Access"
        subtitle="Manage approved Studio roles and individual rights using the canonical Oasis Core identity. No permission change is effective without Core approval."
        actions={
          <Button variant="outline" disabled={loading || saving} onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />
      <div className="card-elevated p-4 mb-6 flex items-start gap-3 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
        <p>
          Staff accounts are invited and provisioned in Oasis Core/Central. This screen grants or
          revokes <strong>AI Studio-only</strong> access to existing identities. Approval of a
          pending employee and protected production/financial rights cannot be bypassed here.
          Privileged changes require an AAL2-verified session and a recorded reason.
        </p>
      </div>
      <div className="card-elevated p-4 mb-6 text-sm border-amber-500/40" role="note">
        <p>
          <strong>These roles do not yet change production data permissions.</strong> Product
          Master, media and variant writes remain governed by Core database rules (Core #407), and
          pricing approval, publication and hard delete stay separately governed. Appointing or
          revoking an AI Studio Manager, or granting user-management rights, requires an Owner; Core
          enforces this regardless of what this screen allows.
        </p>
      </div>
      {error ? (
        <div role="alert" className="card-elevated p-5 border-destructive/40">
          <h2 className="font-display text-lg">Access administration unavailable</h2>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Core access migration or authorization is required. No fallback user list or write
            action is available.
          </p>
        </div>
      ) : loading ? (
        <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading authorized user directory…
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)] gap-5">
          <section className="card-elevated p-4 space-y-3" aria-label="Staff directory">
            <h2 className="font-display text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Employees ({directory.length})
            </h2>
            <div className="space-y-2">
              <label htmlFor="studio-user-search" className="block text-xs font-medium">
                Search employees
              </label>
              <input
                id="studio-user-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <label htmlFor="studio-user-filter" className="block text-xs font-medium">
                Filter by access
              </label>
              <select
                id="studio-user-filter"
                value={directoryFilter}
                onChange={(event) =>
                  setDirectoryFilter(event.target.value as StudioDirectoryFilter)
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All eligible staff</option>
                <option value="unassigned">Not assigned to Studio</option>
                <option value="active">Active Studio members</option>
                <option value="protected">Protected Owners</option>
                <option value="inactive">Core inactive / unapproved</option>
              </select>
              <p className="text-xs text-muted-foreground" role="status">
                Showing {visibleDirectory.length} of {directory.length} eligible identities.
              </p>
            </div>
            <div className="max-h-[65vh] overflow-y-auto space-y-1">
              {visibleDirectory.map((row) => (
                <button
                  type="button"
                  key={row.user_id}
                  onClick={() => select(row)}
                  className={`w-full text-left rounded-lg border p-3 text-sm hover:bg-muted/50 ${selected?.user_id === row.user_id ? "border-accent bg-muted/40" : "border-border"}`}
                >
                  <span className="block font-medium truncate">
                    {row.display_name || row.email || "Unnamed employee"}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">{row.email}</span>
                  <span className="block text-xs mt-1">
                    {row.studio_status.replaceAll("_", " ")} · Core{" "}
                    {row.core_active ? "active" : "inactive"}
                  </span>
                </button>
              ))}
              {visibleDirectory.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {directory.length === 0
                    ? "No eligible staff identities."
                    : "No employee matches this search and filter."}
                </p>
              )}
            </div>
          </section>
          <section className="card-elevated p-5 space-y-5" aria-label="Studio permission editor">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Select an employee to review assigned roles, effective approval status and specific
                permission overrides.
              </p>
            ) : (
              <>
                <div>
                  <h2 className="font-display text-xl">
                    {selected.display_name || selected.email || "Employee"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{selected.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Core invitation: {selected.invite_status ?? "unknown"} · Version{" "}
                    {selected.version}
                  </p>
                </div>
                {protectedOwner && (
                  <p className="text-sm border rounded-lg p-3" role="status">
                    <strong>Protected Owner account — read-only.</strong> Its membership and
                    permissions cannot be changed here, including by another Owner. Select an
                    eligible non-Owner employee from the directory to assign Studio access.
                  </p>
                )}
                <fieldset disabled={protectedOwner || saving} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="studio-access-status" className="font-medium text-sm">
                      Studio access status
                    </label>
                    <select
                      id="studio-access-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as StudioAccessStatus)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {STUDIO_ACCESS_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    {cannotActivate && (
                      <p role="alert" className="text-sm text-destructive">
                        Core identity is not active and approved; Studio activation will be denied.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Studio role profiles</h3>
                    <p className="text-xs text-muted-foreground">
                      Multiple profiles can be combined. Owner cannot be delegated here.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {STUDIO_PROFILES.map((profile) => (
                        <label key={profile.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={profiles.includes(profile.key)}
                            onChange={(event) =>
                              setProfiles((current) =>
                                event.target.checked
                                  ? [...current, profile.key]
                                  : current.filter((key) => key !== profile.key),
                              )
                            }
                          />
                          {profile.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Individual permission overrides</h3>
                    <p className="text-xs text-muted-foreground">
                      Inherit uses role templates; Deny takes precedence. Core controls all actual
                      writes.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {STUDIO_PERMISSIONS.map((permission) => (
                        <label key={permission} className="flex flex-col gap-1 text-xs">
                          <span>{permission.replace("ai_studio.", "")}</span>
                          <select
                            value={
                              overrides[permission] === true
                                ? "allow"
                                : overrides[permission] === false
                                  ? "deny"
                                  : "inherit"
                            }
                            onChange={(event) =>
                              setOverrides((old) => {
                                const next = { ...old };
                                if (event.target.value === "inherit") delete next[permission];
                                else next[permission] = event.target.value === "allow";
                                return next;
                              })
                            }
                            className="rounded-md border bg-background px-2 py-1.5 text-sm"
                          >
                            <option value="inherit">Inherit from role</option>
                            <option value="allow">Allow</option>
                            <option value="deny">Deny</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="studio-access-reason" className="font-medium text-sm">
                      Reason for change (required)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Enter at least 8 characters explaining the business reason. Save stays
                      disabled until the reason and status are valid. Changes are audited in Core.
                    </p>
                    <textarea
                      id="studio-access-reason"
                      rows={2}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Explain why this account should gain, change or lose Studio access"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={saving || cannotActivate || reason.trim().length < 8}
                    onClick={() => void save()}
                  >
                    {saving ? "Saving…" : "Save access in Core"}
                  </Button>
                </fieldset>
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium text-sm">Audit history</h3>
                    <Button type="button" variant="outline" onClick={() => void loadAudit()}>
                      Load history
                    </Button>
                  </div>
                  {auditError && (
                    <p role="alert" className="text-sm text-destructive">
                      {auditError}
                    </p>
                  )}
                  {audit && audit.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recorded changes.</p>
                  )}
                  <ul className="space-y-2">
                    {audit?.map((entry) => (
                      <li key={entry.id} className="rounded-md border p-3 text-xs space-y-1">
                        <p>
                          {new Date(entry.created_at).toLocaleString()} ·{" "}
                          {entry.actor_email ?? entry.actor_id}
                        </p>
                        <p>{entry.reason}</p>
                        <p className="text-muted-foreground">
                          {String(entry.before?.status ?? "none")} →{" "}
                          {String(entry.after?.status ?? "none")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
