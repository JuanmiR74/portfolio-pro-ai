// =============================================================================
// DashboardModule.tsx — Panel principal de PortfolioPro
// SummaryCards + AllocationChart (Donut) + HistoryChart (Área)
// =============================================================================

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { usePortfolioContext } from "../../context/PortfolioContext";
import { formatCurrency, formatPercent } from "../AppShell";
import { TrendingUp, TrendingDown, Wallet, BarChart2, Zap } from "lucide-react";

// ── Paleta para el donut de allocation ──
const ALLOCATION_COLORS = [
  "#c9a84c", // gold
  "#3ecf8e", // green
  "#60a5fa", // blue
  "#f472b6", // pink
  "#a78bfa", // purple
  "#34d399", // emerald
  "#fb923c", // orange
  "#e879f9", // fuchsia
];

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export function DashboardModule() {
  const { state, getSummary, getXRay } = usePortfolioContext();
  const summary = getSummary();
  const xray    = getXRay();

  // Datos del gráfico de historial
  const historyData = useMemo(() => {
    if (!state?.history.length) return MOCK_HISTORY;
    return state.history.map((snap: any) => ({
      date:      formatShortDate(snap.date),
      valor:     snap.totalValue,
      invertido: snap.totalInvested,
    }));
  }, [state?.history]);

  // Datos del donut: asset classes del X-Ray (o categorías de activos como fallback)
  const allocationData = useMemo(() => {
    if (xray?.assetClasses.length) {
      return xray.assetClasses.map((ac: any) => ({
        name:    ac.label,
        value:   ac.weight,
        amount:  ac.value,
      }));
    }
    // Fallback: distribución por tipo de activo directo
    if (!state) return [];
    const byType = new Map<string, number>();
    for (const asset of state.assets) {
      const val = asset.shares * (asset.currentPrice ?? asset.averageBuyPrice);
      const key = asset.isin.slice(0, 2); // país emisor como proxy
      byType.set(key, (byType.get(key) ?? 0) + val);
    }
    const total = [...byType.values()].reduce((s, v) => s + v, 0);
    return [...byType.entries()].map(([name, value]) => ({
      name,
      value: total > 0 ? +((value / total) * 100).toFixed(1) : 0,
      amount: value,
    }));
  }, [xray, state]);

  const currency = state?.settings.display.currency ?? "EUR";

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="module-header">
        <div>
          <h1 className="module-title">Dashboard</h1>
          <p className="module-subtitle">
            Visión global de tu cartera · {new Date().toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        {summary?.xirr !== undefined && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>
              XIRR global
            </div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              color: summary.xirr >= 0 ? "var(--green)" : "var(--red)",
            }}>
              {formatPercent(summary.xirr)}
            </div>
          </div>
        )}
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid-4 mb-24">
        <SummaryCard
          label="Valor total"
          value={summary ? formatCurrency(summary.totalValue, currency) : "—"}
          delta={summary ? formatPercent(summary.totalPnLPercent) : undefined}
          positive={summary ? summary.totalPnL >= 0 : true}
          icon={<Wallet size={16} />}
        />
        <SummaryCard
          label="Total invertido"
          value={summary ? formatCurrency(summary.totalInvested, currency) : "—"}
          sub={`${summary?.assetCount ?? 0} activos · ${summary?.roboAdvisorCount ?? 0} robos`}
          icon={<BarChart2 size={16} />}
        />
        <SummaryCard
          label="P&L no realizado"
          value={summary ? formatCurrency(summary.totalPnL, currency) : "—"}
          delta={summary ? formatPercent(summary.totalPnLPercent) : undefined}
          positive={summary ? summary.totalPnL >= 0 : true}
          icon={summary?.totalPnL && summary.totalPnL >= 0
            ? <TrendingUp size={16} />
            : <TrendingDown size={16} />}
        />
        <SummaryCard
          label="Liquidez"
          value={summary ? formatCurrency(summary.cashBalance, currency) : "—"}
          sub="Saldo en efectivo"
          icon={<Zap size={16} />}
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 20, marginBottom: 24 }}>
        {/* History Chart */}
        <div className="card">
          <div className="flex-between mb-16">
            <div>
              <div className="card__label">Evolución histórica</div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", display: "inline-block" }} />
                Valor
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--surface-3)", border: "1px solid var(--border-hi)", display: "inline-block" }} />
                Invertido
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={historyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInvertido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3a3a4a" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3a3a4a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#44445a", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#44445a", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip content={<HistoryTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="invertido"
                stroke="#3a3a4a"
                strokeWidth={1.5}
                fill="url(#gradInvertido)"
                strokeDasharray="4 3"
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="#c9a84c"
                strokeWidth={2}
                fill="url(#gradValor)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation Donut */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card__label mb-16">Distribución de activos</div>
          {allocationData.length === 0 ? (
            <EmptyChart message="Añade activos para ver la distribución" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((_: any, i: number) => (
                      <Cell key={i} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<AllocationTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Leyenda manual */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {allocationData.slice(0, 6).map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                      {item.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── COVERAGE WARNING ── */}
      {xray && xray.overallCoverage < 80 && (
        <div style={{
          background: "rgba(201,168,76,0.06)",
          border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          color: "var(--gold)",
          marginBottom: 24,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <span>
            Solo el <strong>{xray.overallCoverage}%</strong> de tu cartera tiene datos en la Librería ISIN.
            El X-Ray no es completo. Añade los ISINs faltantes:{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {xray.uncoveredAssets.slice(0, 3).join(", ")}
              {xray.uncoveredAssets.length > 3 ? ` +${xray.uncoveredAssets.length - 3} más` : ""}
            </span>
          </span>
        </div>
      )}

      {/* ── TOP ASSETS TABLE ── */}
      <TopAssetsTable currency={currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTES
// ---------------------------------------------------------------------------

function SummaryCard({
  label, value, delta, positive, sub, icon,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card card--hoverable">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="card__label" style={{ marginBottom: 0 }}>{label}</div>
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      </div>
      <div className="card__value" style={{ fontSize: 24 }}>{value}</div>
      {delta && (
        <div className={`card__delta ${positive ? "positive" : "negative"}`}>
          {positive ? "▲" : "▼"} {delta}
        </div>
      )}
      {sub && !delta && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TopAssetsTable({ currency }: { currency: string }) {
  const { state, getAssetMetrics } = usePortfolioContext();

  if (!state || state.assets.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
        <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>No hay activos en cartera</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Ve a Fondos & Acciones para añadir tu primer activo</p>
      </div>
    );
  }

  const assetsWithMetrics = state.assets
    .map((a: any) => ({ asset: a, metrics: getAssetMetrics(a.id) }))
    .filter((x: any) => x.metrics)
    .sort((a: any, b: any) => (b.metrics!.currentValue - a.metrics!.currentValue))
    .slice(0, 8);

  return (
    <div className="card">
      <div className="card__label mb-16">Top posiciones</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Activo</th>
            <th>ISIN</th>
            <th style={{ textAlign: "right" }}>Valor</th>
            <th style={{ textAlign: "right" }}>P&L</th>
            <th style={{ textAlign: "right" }}>% Cartera</th>
            <th style={{ textAlign: "right" }}>XIRR</th>
          </tr>
        </thead>
        <tbody>
          {assetsWithMetrics.map(({ asset, metrics }: any) => (
            <tr key={asset.id}>
              <td>
                <div style={{ fontWeight: 500 }}>{asset.name ?? asset.ticker ?? "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{asset.broker}</div>
              </td>
              <td className="td-mono td-muted">{asset.isin}</td>
              <td className="td-mono" style={{ textAlign: "right" }}>
                {formatCurrency(metrics!.currentValue, currency)}
              </td>
              <td style={{ textAlign: "right" }}>
                <span className={metrics!.unrealizedPnL >= 0 ? "text-positive" : "text-negative"}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {formatPercent(metrics!.unrealizedPnLPercent)}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  <div className="progress-bar-track" style={{ width: 50 }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(metrics!.weightInPortfolio, 100)}%` }}
                    />
                  </div>
                  <span className="td-mono" style={{ fontSize: 11, minWidth: 36, textAlign: "right" }}>
                    {metrics!.weightInPortfolio.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                {metrics!.xirr !== undefined ? (
                  <span className={`td-mono ${metrics!.xirr >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatPercent(metrics!.xirr)}
                  </span>
                ) : (
                  <span className="td-muted td-mono">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
      {message}
    </div>
  );
}

// Tooltips personalizados para Recharts
function HistoryTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hi)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke, marginBottom: 2 }}>
          {p.dataKey === "valor" ? "Valor" : "Invertido"}: {formatCurrency(p.value, currency)}
        </div>
      ))}
    </div>
  );
}

function AllocationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hi)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div style={{ color: "var(--text-primary)" }}>{name}</div>
      <div style={{ color: "var(--gold)" }}>{value.toFixed(1)}%</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MOCK DATA — para historial vacío
// ---------------------------------------------------------------------------
function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

const MOCK_HISTORY = Array.from({ length: 24 }, (_, i) => {
  const base = 50000;
  const growth = i * 1200;
  const noise = Math.sin(i * 0.8) * 3000;
  return {
    date: `${String(i + 1).padStart(2, "0")}/01`,
    valor: base + growth + noise,
    invertido: base + growth * 0.85,
  };
});
