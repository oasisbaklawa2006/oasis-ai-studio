import { useState } from "react";
import { toast } from "sonner";
import { submitCatalogueDraft } from "./draftService";
export function useDraftSubmit() { const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const submit = async (args: Parameters<typeof submitCatalogueDraft>[0]) => { setLoading(true); setError(null); const res = await submitCatalogueDraft(args); setLoading(false); if (!res.ok) { setError(res.message); toast.error(res.message); } else toast.success(res.message); return res; }; return { submit, loading, error }; }
