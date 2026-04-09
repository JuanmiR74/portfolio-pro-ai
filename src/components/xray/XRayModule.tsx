// =============================================================================
// XRayModule.tsx — Motor de análisis de distribución real
// =============================================================================

import { usePortfolioContext } from "../../context/PortfolioContext";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer as RC } from "recharts";

export function XRayModule() {
  const { getXRay, state } = usePortfolioContext();
  const xray = getXRay();
  const currency = state?.settings.display.currency ?? "EUR";

  if (!xray) return (
    <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
      <p style={{ color: "var(--text-secondary)" }}>Sin datos suficientes para el X-Ray</p>
    </div>
  );

  return (
    <div>
      <div className="module-header">
        <div>
          <h1 className="module-title">X-Ray</h1>
          <p className="module-subtitle">
            Distribución real de tu cartera · Cobertura{" "}
            <span style={{ color: xray.overallCoverage >= 80 ? "var(--green)" : "var(--gold)", fontFamily: "var(--font-mono)" }}>
              {xray.overallCoverage}%
            </span>
          </p>
        </div>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          Calculado: {new Date(xray.calculatedAt).toLocaleString("es-ES")}
        </div>
      </div>

      {xray.uncoveredAssets.length > 0 && (
        <div style={{
          background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 24,
          fontSize: 12, color: "var(--gold)", fontFamily: "var(--font-mono)",
        }}>
          ⚠ ISINs sin datos en librería: {xray.uncoveredAssets.join(", ")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <XRaySection title="Geografía" lines={xray.geography} color="#c9a84c" />
        <XRaySection title="Sectores"  lines={xray.sectors}   color="#3ecf8e" />
        <XRaySection title="Clase de activo" lines={xray.assetClasses} color="#60a5fa" />
      </div>
    </div>
  );
}

function XRaySection({ title, lines, color }: {
  title: string;
  lines: any[];
  color: string;
}) {
  return (
    <div className="card">
      <div className="card__label mb-16">{title}</div>
      {lines.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Sin datos</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.slice(0, 10).map((line) => (
            <div key={line.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {line.label}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>
                  {line.weight.toFixed(1)}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${line.weight}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
