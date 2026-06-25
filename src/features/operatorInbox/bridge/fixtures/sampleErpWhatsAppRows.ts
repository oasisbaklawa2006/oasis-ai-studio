import type { ErpWhatsAppMessageRow } from "./types";

/** Live-schema fixtures from production audit (tcxvcatsqqertcnycuop, 2026-06-25). */
export const SAMPLE_ERP_WHATSAPP_ROWS: ErpWhatsAppMessageRow[] = [
  {
    id: "4e21fa24-8a47-481c-89be-b8d85d02ef53",
    contact_id: "00000000-0000-4000-8000-000000000001",
    direction: "inbound",
    message_type: "text",
    content: "10 kg Midya pista",
    provider_message_id: "wamid.HBgMOTE5ODkxMTYyMjEyFQIAEhgUM0EzMDYyQUQ1QkU5MjY4OTc5N0EA",
    provider: "whatsapp",
    status: "received",
    message_timestamp: "2026-06-24 22:42:02",
    created_at: "2026-06-24 22:42:06.255698",
    whatsapp_contacts: { phone_number: "919891162212", customer_name: null },
  },
  {
    id: "c563ebd3-7a81-4a30-a7f3-730b6be651f2",
    contact_id: "00000000-0000-4000-8000-000000000002",
    direction: "inbound",
    message_type: "text",
    content: "Hi",
    provider_message_id: "wamid.HBgMOTE5NDQyNjExOTY5FQIAEhgUM0E2Njc5OTdDQTA1ODhCOEM1RTgA",
    provider: "whatsapp",
    status: "received",
    message_timestamp: "2026-06-22 11:04:58",
    created_at: "2026-06-22 11:05:02.86048",
    whatsapp_contacts: { phone_number: "919442611969", customer_name: null },
  },
  {
    id: "outbound-sample",
    contact_id: "00000000-0000-4000-8000-000000000003",
    direction: "outbound",
    message_type: "text",
    content: "Thanks for your order",
    provider_message_id: "wamid.outbound-sample",
    provider: "whatsapp",
    status: "sent",
    message_timestamp: "2026-06-20 10:00:00",
    created_at: "2026-06-20 10:00:01",
    whatsapp_contacts: { phone_number: "919999999999", customer_name: "Outbound" },
  },
  {
    id: "image-sample",
    contact_id: "00000000-0000-4000-8000-000000000004",
    direction: "inbound",
    message_type: "image",
    content: null,
    provider_message_id: "wamid.image-sample",
    provider: "whatsapp",
    status: "received",
    message_timestamp: "2026-06-19 10:00:00",
    created_at: "2026-06-19 10:00:01",
    whatsapp_contacts: { phone_number: "919888888888", customer_name: null },
  },
];

export function createMockErpReader(rows: ErpWhatsAppMessageRow[], cursor: string, limit = 100) {
  const filtered = rows
    .filter((row) => row.direction === "inbound")
    .filter((row) => {
      const ts = row.message_timestamp ?? row.created_at ?? "";
      return ts > cursor.replace("T", " ").replace("Z", "");
    })
    .sort((a, b) => String(a.message_timestamp).localeCompare(String(b.message_timestamp)))
    .slice(0, limit);
  return { rows: filtered, cursor };
}
