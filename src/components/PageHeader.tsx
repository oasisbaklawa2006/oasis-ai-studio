interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}
export const PageHeader = ({ title, subtitle, actions }: Props) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
    <div>
      <h1 className="font-display text-3xl sm:text-4xl text-foreground">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);
