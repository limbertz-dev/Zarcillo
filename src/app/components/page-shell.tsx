type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

type PageHeaderProps = Omit<PageShellProps, "children">;

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-white/55">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </section>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1a2e]/70 shadow-lg shadow-black/30 backdrop-blur ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3.5">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-white/45">{subtitle}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/55">
      <p className="text-sm font-medium text-white/70">{title}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  title = "Error al consultar Supabase",
}: {
  message: string;
  title?: string;
}) {
  const safeMessage =
    !message || message === "[object Object]"
      ? "No se pudo obtener una descripción del error. Revisa la consola del navegador."
      : message;
  return (
    <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-red-200/80">
        {safeMessage}
      </p>
    </div>
  );
}
