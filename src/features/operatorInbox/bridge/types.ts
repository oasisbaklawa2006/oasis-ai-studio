export type {
  ErpInboundMapResult,
  ErpProcessDeps,
  ErpProcessResult,
  ErpWhatsAppContactJoin,
  ErpWhatsAppMessageRow,
} from "../../../../supabase/functions/_shared/erpInboxBridge/types.ts";
export {
  erpTimestampToIso,
  mapErpWhatsAppMessage,
  normalizeErpPhone,
} from "../../../../supabase/functions/_shared/erpInboxBridge/mapErpWhatsAppMessage.ts";
export { processErpInboundRow } from "../../../../supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts";
