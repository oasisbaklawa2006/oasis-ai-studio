interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}
export const PageHeader = ({ title, subtitle, actions }: Props) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 pb-6 border-b border-border/60">
    <div className="min-w-0">
      <p className="luxe-sub mb-2 text-accent/90">Oasis Catalogue</p>
      <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);
