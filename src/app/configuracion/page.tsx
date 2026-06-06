import { DEVICES, METRICS } from "@/lib/devices";
import { PageShell, Panel } from "../components/page-shell";

export default function ConfiguracionPage() {
  return (
    <PageShell
      title="Configuración"
      subtitle="Dispositivos registrados y umbrales de alerta"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Dispositivos">
          <ul className="space-y-3">
            {DEVICES.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
              >
                <p className="text-sm font-medium text-white">{d.label}</p>
                <p className="font-mono text-[11px] text-white/55">{d.id}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
                  {d.metrics.length} métricas · nivel 2
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Umbrales de alerta">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-white/45">
              <tr>
                <th className="pb-2 font-medium">Métrica</th>
                <th className="pb-2 font-medium text-right">Advertencia</th>
                <th className="pb-2 font-medium text-right">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-white/85">
              {Object.values(METRICS).map((m) => (
                <tr key={m.key}>
                  <td className="py-2">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.label}
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">
                    {formatThreshold(m.warnBelow, m.warnAbove, m.unit)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">
                    {formatThreshold(m.alertBelow, m.alertAbove, m.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </PageShell>
  );
}

function formatThreshold(
  below: number | undefined,
  above: number | undefined,
  unit: string,
): string {
  const parts: string[] = [];
  if (below !== undefined) parts.push(`< ${below} ${unit}`.trim());
  if (above !== undefined) parts.push(`> ${above} ${unit}`.trim());
  return parts.length > 0 ? parts.join(" o ") : "—";
}
