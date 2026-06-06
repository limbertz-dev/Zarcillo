import { PageShell } from "../components/page-shell";
import { ReportesClient } from "./reportes-client";

export default function ReportesPage() {
  return (
    <PageShell
      title="Reportes"
      subtitle="Resumenes diarios y semanales de la fermentacion"
    >
      <ReportesClient />
    </PageShell>
  );
}
