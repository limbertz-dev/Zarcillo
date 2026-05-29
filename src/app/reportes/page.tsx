import { EmptyState, PageShell } from "../components/page-shell";

export default function ReportesPage() {
  return (
    <PageShell
      title="Reportes"
      subtitle="Resúmenes diarios y semanales de la fermentación"
    >
      <EmptyState
        title="Próximamente"
        hint="Aquí podrás generar reportes en PDF a partir de los datos de los ESP32"
      />
    </PageShell>
  );
}
