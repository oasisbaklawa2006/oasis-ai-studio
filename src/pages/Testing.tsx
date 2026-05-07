import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Upload, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


type Item = { id: string; label: string; hint: string };
type Section = { id: string; title: string; items: Item[] };

const SECTIONS: Section[] = [
  { id: "A", title: "Auth Test", items: [
    { id: "A1", label: "Create first user", hint: "Sign up — first user becomes Owner." },
    { id: "A2", label: "Confirm Owner role in sidebar footer", hint: "Sidebar shows role under email." },
    { id: "A3", label: "Sign out and sign in", hint: "Session restores correctly." },
  ]},
  { id: "B", title: "Product + SKU Test", items: [
    { id: "B1", label: "Add product", hint: "Products → New Product." },
    { id: "B2", label: "Pick division/category/subcategory/packaging", hint: "Inside the SKU section." },
    { id: "B3", label: "Generate SKU", hint: "Format: OAS-DIV-CAT-SUB-PACK-0001." },
    { id: "B4", label: "Confirm SKU is locked", hint: "Lock icon visible." },
    { id: "B5", label: "Copy SKU", hint: "Copy button copies to clipboard." },
    { id: "B6", label: "Add hero image URL", hint: "Use any HTTPS image." },
    { id: "B7", label: "Check readiness badge", hint: "Should list missing fields if any." },
  ]},
  { id: "C", title: "Alias Test", items: [
    { id: "C1", label: "Add alias manually", hint: "AliasManager → Add." },
    { id: "C2", label: "Generate starter aliases", hint: "Try product name 'Kunafa' or 'Cashew Pyramid'." },
    { id: "C3", label: "Search by misspelling/local name", hint: "e.g. 'kataifi', 'kaju pyramid'." },
    { id: "C4", label: "Confirm 'Matched by alias' shows", hint: "In Products and ProductPicker." },
  ]},
  { id: "D", title: "Media Test", items: [
    { id: "D1", label: "Add media URL", hint: "Media → Add Media." },
    { id: "D2", label: "Link media to product", hint: "Pick the product in dropdown." },
    { id: "D3", label: "Confirm AI future panel", hint: "Card shows AI roadmap badge." },
  ]},
  { id: "E", title: "Catalogue Test", items: [
    { id: "E1", label: "Create catalogue", hint: "Catalogues → New Catalogue." },
    { id: "E2", label: "Search products by SKU/name/alias", hint: "ProductPicker in detail page." },
    { id: "E3", label: "Add products and Publish", hint: "Use Publish button." },
    { id: "E4", label: "Open public link in new tab", hint: "/c/<slug>." },
    { id: "E5", label: "Share via WhatsApp", hint: "From Share Panel." },
    { id: "E6", label: "Generate and download QR", hint: "Download QR PNG." },
    { id: "E7", label: "Print/save as PDF", hint: "Print button → Save as PDF." },
  ]},
  { id: "F", title: "Hamper / BOM Test", items: [
    { id: "F1", label: "Create hamper" , hint: "Hampers → New Hamper." },
    { id: "F2", label: "Search child product by alias", hint: "ProductPicker in component editor." },
    { id: "F3", label: "Add product component", hint: "Pick + qty." },
    { id: "F4", label: "Add packaging component", hint: "Toggle 'Packaging component'." },
    { id: "F5", label: "Confirm customer-visible flag", hint: "Toggle 'Customer visible'." },
  ]},
  { id: "G", title: "Ingredient / Nutrition Test", items: [
    { id: "G1", label: "Add ingredients", hint: "Ingredients page." },
    { id: "G2", label: "Link ingredients to product", hint: "Inside product page (future module)." },
    { id: "G3", label: "Add nutrition panel", hint: "Per-product nutrition." },
    { id: "G4", label: "Confirm warning shows for missing data", hint: "Label Queue lists warnings." },
  ]},
  { id: "H", title: "Label Test", items: [
    { id: "H1", label: "Create label data", hint: "Label Studio." },
    { id: "H2", label: "Mark Needs Review in queue", hint: "Label Queue actions." },
    { id: "H3", label: "Approve label", hint: "Confirm badge updates." },
    { id: "H4", label: "Lock label", hint: "Lock icon appears; non-admins cannot unlock." },
  ]},
  { id: "I", title: "Integration Readiness Test", items: [
    { id: "I1", label: "Open Integration Center", hint: "Settings → Integration Center." },
    { id: "I2", label: "Confirm all endpoint placeholders", hint: "All 6 cards visible." },
    { id: "I3", label: "Confirm SKU/product_id identity notes", hint: "Notes appear under each card." },
  ]},
];

const KEY = "oasis_testing_checklist_v1";

const Testing = () => {
  const [state, setState] = useState<Record<string, { done: boolean; notes: string }>>({});

  useEffect(() => {
    try { setState(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* ignore */ }
  }, []);

  const persist = (next: typeof state) => { setState(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const toggle = (id: string) => persist({ ...state, [id]: { done: !state[id]?.done, notes: state[id]?.notes ?? "" } });
  const setNote = (id: string, notes: string) => persist({ ...state, [id]: { done: state[id]?.done ?? false, notes } });

  const total = SECTIONS.flatMap((s) => s.items).length;
  const done = Object.values(state).filter((v) => v.done).length;

  return (
    <>
      <PageHeader title="Testing Checklist" subtitle={`Walk through every flow — ${done}/${total} complete. State is saved locally on this device.`} />

      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.id} className="card-elevated p-5">
            <h3 className="font-display text-xl mb-3">{s.id}. {s.title}</h3>
            <div className="space-y-3">
              {s.items.map((it) => {
                const isDone = !!state[it.id]?.done;
                return (
                  <div key={it.id} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggle(it.id)} className="mt-0.5">
                        {isDone ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{it.id}. {it.label}</div>
                        <div className="text-xs text-muted-foreground">{it.hint}</div>
                        <Textarea
                          rows={1}
                          placeholder="Notes…"
                          value={state[it.id]?.notes ?? ""}
                          onChange={(e) => setNote(it.id, e.target.value)}
                          className="mt-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Testing;
