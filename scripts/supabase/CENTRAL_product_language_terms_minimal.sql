-- Optional future deploy: durable product language terms (not required for publish gating).
-- Language discoverability is informational until this is applied.
-- Requires: public.products, public.is_team_member(uuid)

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_language_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  term_text text NOT NULL,
  term_type text NOT NULL CHECK (term_type IN (
    'official_alias',
    'customer_term',
    'whatsapp_keyword',
    'search_keyword',
    'regional_term',
    'marketing_term'
  )),
  language text NULL,
  script text NULL,
  source text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, term_type, lower(term_text))
);

CREATE INDEX IF NOT EXISTS idx_product_language_terms_product
  ON public.product_language_terms (product_id, term_type);

ALTER TABLE public.product_language_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_language_terms_team_rw ON public.product_language_terms;
CREATE POLICY product_language_terms_team_rw ON public.product_language_terms
  FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_language_terms TO authenticated;

COMMENT ON TABLE public.product_language_terms IS
  'Durable typed language/discoverability terms for Product Truth (replaces localStorage-only term types).';

COMMIT;
