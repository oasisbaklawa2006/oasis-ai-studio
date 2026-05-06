import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Lock } from "lucide-react";

const Settings = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { supabase.from("integration_settings").select("*").order("label").then(({data})=>setItems(data ?? [])); }, []);

  return (
    <>
      <PageHeader title="Settings & Integrations" subtitle="Future-ready connections to Oasis Central, AI providers, WhatsApp, label printers and more." />

      <div className="card-elevated p-4 mb-6 bg-accent-soft/40 text-sm text-accent-foreground">
        Secrets are never stored in the frontend. Production keys will live in secure backend functions, configured by Owner role.
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.map(i => (
          <div key={i.id} className="card-elevated p-5 opacity-90">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{i.label}</div>
                <div className="text-xs text-muted-foreground">{i.notes}</div>
              </div>
              <span className={`badge-soft ${i.status === "planned" ? "bg-accent-soft text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{i.status.replace(/_/g," ")}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
              <Lock className="h-3.5 w-3.5" />Configurable from backend (coming soon)
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Settings;
