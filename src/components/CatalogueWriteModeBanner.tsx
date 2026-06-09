import { useEffect, useState } from "react";
import { canWriteMasterDirectly, isCatalogueContributor } from "@/shared/auth/centralPermissions";
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";

export function CatalogueWriteModeBanner() {
  const [mode, setMode] = useState<"direct"|"draft"|"readonly">("readonly");
  useEffect(() => { (async () => {
    if (await canWriteMasterDirectly()) return setMode("direct");
    if (await isCatalogueContributor()) return setMode("draft");
    setMode("readonly");
  })(); }, []);
  return (
    <div className="mb-4 rounded-md border px-3 py-2 text-sm bg-muted/30 space-y-2">
      <div>
        {mode === "direct"
          ? "Direct master write mode"
          : mode === "draft"
            ? "Draft submission mode — changes require approval"
            : "Read-only mode"}
      </div>
      <AuthorityStatusBadges
        show={{
          authority_draft: mode === "draft",
          central_live_write_disabled: true,
          not_synced_to_central: mode !== "readonly",
        }}
      />
    </div>
  );
}
