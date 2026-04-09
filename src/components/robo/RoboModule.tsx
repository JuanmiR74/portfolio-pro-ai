// =============================================================================
// RoboModule.tsx — Motor de Robo-Advisors
// Importador inteligente + Modal de conciliación + Gestión de subFunds
// =============================================================================

import { useState, useRef } from "react";
import { Plus, Upload, Trash2, Pencil, X, Bot, CheckCircle2, AlertCircle } from "lucide-react";
import { usePortfolioContext } from "../../context/PortfolioContext";
import { formatCurrency, formatPercent } from "../AppShell";
import type { ConciliationItem, RawMovementRow } from "../../types/portfolio";

// ---------------------------------------------------------------------------
// MÓDULO PRINCIPAL
// ---------------------------------------------------------------------------

export function RoboModule() {
  const { state, addRoboAdvisor, updateRoboAdvisor, deleteRoboAdvisor,
          importRoboMovements, confirmImport, getRoboMetrics, getSummary } = usePortfolioContext();

  const [showAddDialog,       setShowAddDialog]       = useState(false);
  const [importingRoboId,     setImportingRoboId]     = useState<string | null>(null);
  const [conciliationItems,   setConciliationItems]   = useState<ConciliationItem[]>([]);
  const [showConciliation,    setShowConciliation]    = useState(false);

  const currency = state?.settings.display.currency ?? "EUR";
  const robos    = state?.roboAdvisors ?? [];
  const summary  = getSummary();

  // ── Importación CSV ──
  const handleFileUpload = async (roboId: string, file: File) => {
    const text  = await file.text();
    const rows  = parseCSV(text);
    const items = await importRoboMovements(roboId, rows);
    setImportingRoboId(roboId);
    setConciliationItems(items);
    setShowConciliation(true);
  };

  const handleConfirmImport = async (items: ConciliationItem[]) => {
    if (!importingRoboId) return;
    await confirmImport(importingRoboId, items);
    setShowConciliation(false);
    setImportingRoboId(null);
    setConciliationItems([]);
  };

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="module-header">
        <div>
          <h1 className="module-title">Robo-Advisors</h1>
          <p className="module-subtitle">{robos.length} carteras gestionadas importadas</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowAddDialog(true)}>
          <Plus size={14} /> Nuevo Robo
        </button>
      </div>

      {/* ── CARDS DE ROBOS ── */}
      {robos.length === 0 ? (
        <RoboEmptyState onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
          {robos.map((robo) => {
            const metrics = getRoboMetrics(robo.id);
            return (
              <RoboCard
                key={robo.id}
                robo={robo}
                metrics={metrics}
                currency={currency}
                onDelete={() => deleteRoboAdvisor(robo.id)}
                onUpdate={(patch) => updateRoboAdvisor(robo.id, patch)}
                onImport={(file) => handleFileUpload(robo.id, file)}
              />
            );
          })}
        </div>
      )}

      {/* ── DIALOGS ── */}
      {showAddDialog && (
        <AddRoboDialog
          onClose={() => setShowAddDialog(false)}
          onSave={async (data) => { await addRoboAdvisor(data); setShowAddDialog(false); }}
        />
      )}
      {showConciliation && importingRoboId && (
        <ConciliationModal
          items={conciliationItems}
          state={state!}
          onClose={() => { setShowConciliation(false); setImportingRoboId(null); }}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROBO CARD
// ---------------------------------------------------------------------------
function RoboCard({ robo, metrics, currency, onDelete, onUpdate, onImport }: {
  robo:      any;
  metrics:   any;
  currency:  string;
  onDelete:  () => void;
  onUpdate:  (patch: any) => void;
  onImport:  (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    active: "badge--green",
    paused: "badge--gold",
    closed: "badge--muted",
  };
  const statusLabels: Record<string, string> = {
    active: "Activo", paused: "Pausado", closed: "Cerrado",
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-sm)",
            background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={18} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{robo.name}</div>
            {robo.provider && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{robo.provider}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className={`badge ${statusColors[robo.status]}`}>
            {statusLabels[robo.status]}
          </span>
          <button className="btn btn--ghost btn--sm btn--danger" onClick={onDelete}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <MiniMetric label="Invertido" value={metrics ? formatCurrency(metrics.totalInvested, currency) : "—"} />
        <MiniMetric label="Valor actual" value={metrics ? formatCurrency(metrics.currentValue, currency) : "—"} />
        <MiniMetric
          label="Rentabilidad"
          value={metrics ? formatPercent(metrics.pnLPercent) : "—"}
          color={metrics ? (metrics.pnL >= 0 ? "var(--green)" : "var(--red)") : undefined}
        />
      </div>

      {/* SubFunds */}
      {robo.subFunds.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            Composición ({robo.subFunds.length} sub-fondos)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(expanded ? robo.subFunds : robo.subFunds.slice(0, 4)).map((sf: any) => (
              <div key={sf.isin} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="progress-bar-track" style={{ flex: 1 }}>
                  <div className="progress-bar-fill" style={{ width: `${sf.derivedWeight}%` }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", minWidth: 34 }}>
                  {sf.derivedWeight.toFixed(1)}%
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", minWidth: 100 }}>
                  {sf.isin}
                </span>
              </div>
            ))}
            {robo.subFunds.length > 4 && (
              <button
                className="btn btn--ghost btn--sm"
                style={{ alignSelf: "flex-start", fontSize: 11, marginTop: 2 }}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? "Ver menos" : `+${robo.subFunds.length - 4} más`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer: importar y última importación */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        {robo.lastImport && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Última importación: {robo.lastImport}
          </span>
        )}
        <button
          className="btn btn--primary btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={12} /> Importar CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL DE CONCILIACIÓN — el corazón del importador
// ---------------------------------------------------------------------------
function ConciliationModal({ items, state, onClose, onConfirm }: {
  items:     ConciliationItem[];
  state:     any;
  onClose:   () => void;
  onConfirm: (items: ConciliationItem[]) => Promise<void>;
}) {
  const [localItems, setLocalItems] = useState<ConciliationItem[]>(items);
  const [saving, setSaving] = useState(false);

  const updateAction = (idx: number, action: ConciliationItem["action"]) => {
    setLocalItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, action } : item)
    );
  };

  const updateIsin = (idx: number, isin: string) => {
    setLocalItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, suggestedIsin: isin } : item)
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(localItems);
    setSaving(false);
  };

  const skipped   = localItems.filter((i) => i.action === "skip").length;
  const processed = localItems.length - skipped;

  const ACTION_LABELS: Record<string, string> = {
    match_asset:  "→ Asset existente",
    match_robo:   "→ Robo existente",
    create_asset: "+ Nuevo asset",
    create_robo:  "+ Nuevo robo",
    skip:         "Ignorar",
  };

  const ACTION_OPTIONS = (item: ConciliationItem) => [
    ...(item.matchedAssetId     ? [{ value: "match_asset",  label: "→ Asset existente" }]  : []),
    ...(item.matchedRoboAdvisorId ? [{ value: "match_robo", label: "→ Robo existente" }] : []),
    { value: "create_asset",  label: "+ Crear nuevo asset" },
    { value: "create_robo",   label: "+ Asociar a este robo" },
    { value: "skip",          label: "Ignorar movimiento" },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <div>
            <h2 className="dialog__title">Conciliación de movimientos</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {localItems.length} movimientos detectados · {processed} a procesar · {skipped} ignorados
            </p>
          </div>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabla de conciliación */}
        <div style={{ maxHeight: 420, overflowY: "auto", marginBottom: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th style={{ textAlign: "right" }}>Importe</th>
                <th>ISIN detectado</th>
                <th>Confianza</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {localItems.map((item, idx) => (
                <tr key={idx} style={{ opacity: item.action === "skip" ? 0.45 : 1 }}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{item.rawRow.date}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                    {item.rawRow.description}
                  </td>
                  <td className="td-mono" style={{ textAlign: "right" }}>
                    {item.rawRow.amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                  </td>
                  <td>
                    <input
                      className="form-input"
                      style={{ padding: "4px 8px", fontSize: 11, width: 130 }}
                      value={item.suggestedIsin ?? ""}
                      placeholder="ISIN..."
                      onChange={(e) => updateIsin(idx, e.target.value.toUpperCase())}
                    />
                  </td>
                  <td>
                    <ConfidenceBadge confidence={item.confidence} />
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: "4px 8px", fontSize: 11 }}
                      value={item.action}
                      onChange={(e) => updateAction(idx, e.target.value as ConciliationItem["action"])}
                    >
                      {ACTION_OPTIONS(item).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Acciones bulk */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn btn--sm" onClick={() =>
            setLocalItems((prev) => prev.map((i) => ({ ...i, action: i.matchedAssetId ? "match_asset" : "create_asset" })))
          }>
            Aceptar todos
          </button>
          <button className="btn btn--sm" onClick={() =>
            setLocalItems((prev) => prev.map((i) => ({ ...i, action: "skip" })))
          }>
            Ignorar todos
          </button>
        </div>

        <div className="dialog__footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleConfirm} disabled={saving}>
            {saving ? "Importando..." : `Confirmar ${processed} movimientos`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 80 ? "badge--green" : pct >= 50 ? "badge--gold" : "badge--red";
  const Icon = pct >= 80 ? CheckCircle2 : AlertCircle;
  return (
    <span className={`badge ${cls}`} style={{ gap: 4 }}>
      <Icon size={11} /> {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// DIALOG: Añadir Robo
// ---------------------------------------------------------------------------
function AddRoboDialog({ onClose, onSave }: {
  onClose: () => void;
  onSave:  (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "", provider: "", currency: "EUR", status: "active", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await onSave({ ...form, movements: [], currentValue: undefined });
    setSaving(false);
  };

  const F = (field: keyof typeof form) => ({
    value:    form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value })),
  });

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h2 className="dialog__title">Nuevo Robo-Advisor</h2>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" placeholder="Indexa Capital Cartera 10/10" {...F("name")} />
          </div>
          <div className="form-group">
            <label className="form-label">Proveedor</label>
            <input className="form-input" placeholder="Indexa, Finizens, inbestMe..." {...F("provider")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Divisa</label>
              <select className="form-input" {...F("currency")}>
                {["EUR","USD","GBP"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-input" {...F("status")}>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Perfil de riesgo, objetivos..."
              style={{ resize: "vertical" }}
              {...F("notes")}
            />
          </div>
        </div>

        <div className="dialog__footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? "Creando..." : "Crear Robo-Advisor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoboEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Sin Robo-Advisors</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: 8, fontSize: 13 }}>
        Importa tus carteras de Indexa Capital, Finizens, inbestMe u otros
      </p>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 12, fontFamily: "var(--font-mono)" }}>
        Los movimientos importados alimentarán el X-Ray automáticamente
      </p>
      <button className="btn btn--primary" onClick={onAdd}>
        <Plus size={14} /> Añadir Robo-Advisor
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV PARSER — genérico, adaptable por formato
// ---------------------------------------------------------------------------
function parseCSV(text: string): RawMovementRow[] {
  const lines  = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows: RawMovementRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/['"]/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });

    // Mapeo flexible de columnas comunes
    const date        = row["fecha"] ?? row["date"] ?? row["fecha_operacion"] ?? "";
    const description = row["descripcion"] ?? row["description"] ?? row["concepto"] ?? "";
    const amountRaw   = row["importe"] ?? row["amount"] ?? row["valor"] ?? "0";
    const isin        = row["isin"] ?? undefined;
    const sharesRaw   = row["participaciones"] ?? row["shares"] ?? row["units"] ?? "";
    const priceRaw    = row["precio"] ?? row["price"] ?? row["nav"] ?? "";

    if (!date) continue;

    rows.push({
      date:          normalizeDate(date),
      description,
      amount:        parseFloat(amountRaw.replace(",", ".")) || 0,
      isin:          isin?.trim().toUpperCase() || undefined,
      shares:        sharesRaw ? parseFloat(sharesRaw.replace(",", ".")) : undefined,
      pricePerShare: priceRaw  ? parseFloat(priceRaw.replace(",", "."))  : undefined,
      rawData:       row,
    });
  }

  return rows;
}

function normalizeDate(raw: string): string {
  // Intenta varios formatos: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length !== 3) return raw;
  const [a, b, c] = parts;
  if (c.length === 4) return `${c}-${b.padStart(2,"0")}-${a.padStart(2,"0")}`;
  return raw;
}
