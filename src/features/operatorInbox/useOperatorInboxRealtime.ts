import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type RealtimeRefreshOptions = {
  enabled: boolean;
  onRefresh: () => void;
};

/**
 * Subscribe to WhatsApp inbox/draft tables for read-only UI refresh.
 */
export function useOperatorInboxRealtime({ enabled, onRefresh }: RealtimeRefreshOptions) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("operator-inbox-phase2f")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_inbound_messages" },
        () => onRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_sales_order_drafts" },
        () => onRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_operator_decisions" },
        () => onRefresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, onRefresh]);
}
