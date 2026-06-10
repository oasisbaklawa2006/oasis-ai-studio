import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  BASIC_SEARCH_FALLBACK_MESSAGE,
  searchProductsWithAliases,
  type ProductSearchResult,
} from "@/lib/productSearch";
import { Search } from "lucide-react";

interface Props {
  onPick: (p: ProductSearchResult) => void;
  excludeIds?: string[];
  placeholder?: string;
  emptyHint?: string;
}

export function ProductPicker({ onPick, excludeIds = [], placeholder = "Search by name, SKU or alias…", emptyHint }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searchBasicFallback, setSearchBasicFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchProductsWithAliases(q);
      if (!cancelled) {
        setResults(r.results);
        setSearchBasicFallback(r.usedBasicFallback && !!q.trim());
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div>
      <div className="flex items-center gap-2 border rounded-md px-3 mb-2 bg-background">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="border-0 focus-visible:ring-0 px-0" />
      </div>
      {searchBasicFallback && (
        <p className="text-[11px] text-warning mb-2 px-1">{BASIC_SEARCH_FALLBACK_MESSAGE}</p>
      )}
      <div className="max-h-80 overflow-auto space-y-1">
        {visible.map((p) => (
          <button
            key={`${p.id}-${p.matched_alias ?? "n"}`}
            onClick={() => onPick(p)}
            className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2 text-sm"
          >
            <div className="h-9 w-9 bg-muted rounded overflow-hidden flex-shrink-0">
              {p.hero_image_url && <img src={p.hero_image_url} className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.product_name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">{p.sku}</div>
              {p.matched_alias && (
                <div className="text-[11px] text-accent-foreground/80">Matched by alias: <span className="font-medium">{p.matched_alias}</span></div>
              )}
            </div>
          </button>
        ))}
        {visible.length === 0 && <div className="text-xs text-muted-foreground py-3 text-center">{emptyHint ?? "No products found."}</div>}
      </div>
    </div>
  );
}
