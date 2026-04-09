// =============================================================================
// AssetsModule.tsx — Gestor de Fondos & Acciones
// CRUD completo + actualización masiva de precios + modal de movimientos
// =============================================================================

import { useState, useRef } from "react";
import { Plus, RefreshCw, Pencil, Trash2, ChevronDown, X, Upload } from "lucide-react";
import { usePortfolioContext } from "../../context/PortfolioContext";
import { formatCurrency, formatPercent } from "../AppShell";
import type { Asset, Movement } from "../../types/portfolio";

// ---------------------------------------------------------------------------
// MÓDULO PRINCIPAL
// ---------------------------------------------------------------------------

export function AssetsModule() {
  const { state, addAsset, updateAsset, deleteAsset, bulkUpdatePrices, getAssetMetrics, getSummary } = usePortfolioContext();
  const [showAddDialog,    setShowAddDialog]    = useState(false);
  const [editingAsset,     setEditingAsset]     = useState<Asset | null>(null);
  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [bulkUpdating,     setBulkUpdating]     = useState(false);

  const summary  = getSummary();
  const currency = state?.settings.display.currency ?? "EUR";
  const assets   = state?.assets ?? [];

  // Simulación de actualización de precios via API (en producción: llamar a Yahoo Finance / Alpha Vantage)
  const handleBulkPriceUpdate = async () => {
    setBulkUpdating(true);
    try {
      // Mock: en producción sustituir por fetch a tu price API
      const updates = assets.map((a) => ({
        isin:  a.isin,
        price: (a.currentPrice ?? a.averageBuyPrice) * (1 + (Math.random() - 0.48) * 0.04),
      }));
      await bulkUpdatePrices(updates);
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="module-header">
        <div>
          <h1 className="module-title">Fondos & Acciones</h1>
          <p className="module-subtitle">{assets.length} posiciones · {formatCurrency(summary?.totalValue ?? 0, currency)} valor total</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={handleBulkPriceUpdate} disabled={bulkUpdating}>
            <RefreshCw size={14} className={bulkUpdating ? "spin" : ""} />
            Actualizar precios
          </button>
          <button className="btn btn--primary" onClick={() => setShowAddDialog(true)}>
            <Plus size={14} /> Nuevo activo
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      {assets.length === 0 ? (
        <EmptyState onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Activo</th>
                <th>ISIN</th>
                <th style={{ textAlign: "right" }}>Participaciones</th>
                <th style={{ textAlign: "right" }}>P. Compra</th>
                <th style={{ textAlign: "right" }}>P. Actual</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th style={{ textAlign: "right" }}>P&L</th>
                <th style={{ textAlign: "right" }}>XIRR</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const metrics = getAssetMetrics(asset.id);
                const isExpanded = expandedId === asset.id;
                return (
                  <>
                    <tr
                      key={asset.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ChevronDown
                            size={14}
                            style={{
                              color: "var(--text-muted)",
                              transform: isExpanded ? "rotate(180deg)" : "none",
                              transition: "transform 0.2s",
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>{asset.name ?? asset.ticker ?? "—"}</div>
                            {asset.broker && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{asset.broker}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td-mono td-muted" style={{ fontSize: 11 }}>{asset.isin}</td>
                      <td className="td-mono" style={{ textAlign: "right" }}>
                        {asset.shares.toLocaleString("es-ES", { maximumFractionDigits: 4 })}
                      </td>
                      <td className="td-mono" style={{ textAlign: "right" }}>
                        {formatCurrency(asset.averageBuyPrice, currency, false)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="td-mono">
                          {asset.currentPrice
                            ? formatCurrency(asset.currentPrice, currency, false)
                            : <span className="td-muted">—</span>}
                        </span>
                        {asset.lastPriceUpdate && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {asset.lastPriceUpdate}
                          </div>
                        )}
                      </td>
                      <td className="td-mono" style={{ textAlign: "right" }}>
                        {metrics ? formatCurrency(metrics.currentValue, currency) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {metrics ? (
                          <div>
                            <div className={`td-mono ${metrics.unrealizedPnL >= 0 ? "text-positive" : "text-negative"}`}>
                              {formatPercent(metrics.unrealizedPnLPercent)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {formatCurrency(metrics.unrealizedPnL, currency, false)}
                            </div>
                          </div>
                        ) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {metrics?.xirr !== undefined ? (
                          <span className={`td-mono ${metrics.xirr >= 0 ? "text-positive" : "text-negative"}`}>
                            {formatPercent(metrics.xirr)}
                          </span>
                        ) : <span className="td-muted td-mono">—</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => setEditingAsset(asset)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn btn--ghost btn--sm btn--danger"
                            onClick={() => deleteAsset(asset.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Fila expandida: movimientos */}
                    {isExpanded && (
                      <tr key={`${asset.id}-expanded`}>
                        <td colSpan={9} style={{ padding: 0, background: "var(--surface-2)" }}>
                          <MovementsPanel asset={asset} currency={currency} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DIALOGS ── */}
      {showAddDialog && (
        <AssetDialog
          mode="add"
          onClose={() => setShowAddDialog(false)}
          onSave={async (data) => { await addAsset(data); setShowAddDialog(false); }}
          isinLibrary={state?.isinLibrary ?? []}
        />
      )}
      {editingAsset && (
        <AssetDialog
          mode="edit"
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={async (data) => { await updateAsset(editingAsset.id, data); setEditingAsset(null); }}
          isinLibrary={state?.isinLibrary ?? []}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANEL DE MOVIMIENTOS (inline expandible)
// ---------------------------------------------------------------------------
function MovementsPanel({ asset, currency }: { asset: Asset; currency: string }) {
  const { addMovement, deleteMovement } = usePortfolioContext();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", type: "buy", amount: "", shares: "", pricePerShare: "", notes: "" });

  const handleAdd = async () => {
    if (!form.date || !form.amount) return;
    await addMovement(asset.id, {
      date:          form.date,
      type:          form.type as Movement["type"],
      amount:        parseFloat(form.amount),
      shares:        form.shares ? parseFloat(form.shares) : undefined,
      pricePerShare: form.pricePerShare ? parseFloat(form.pricePerShare) : undefined,
      notes:         form.notes || undefined,
      currency,
    });
    setShowForm(false);
    setForm({ date: "", type: "buy", amount: "", shares: "", pricePerShare: "", notes: "" });
  };

  const MOVEMENT_LABELS: Record<string, string> = {
    buy: "Compra", sell: "Venta", dividend: "Dividendo",
    fee: "Comisión", transfer_in: "Entrada", transfer_out: "Salida",
  };

  return (
    <div style={{ padding: "16px 24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
          Movimientos ({asset.movements.length})
        </span>
        <button className="btn btn--sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? "Cancelar" : "Añadir"}
        </button>
      </div>

      {showForm && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8, marginBottom: 12, padding: "14px", background: "var(--surface-1)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Importe (€)</label>
            <input className="form-input" type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Participaciones</label>
            <input className="form-input" type="number" placeholder="0" value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio/part.</label>
            <input className="form-input" type="number" placeholder="0.00" value={form.pricePerShare} onChange={(e) => setForm((f) => ({ ...f, pricePerShare: e.target.value }))} />
          </div>
          <div className="form-group" style={{ justifyContent: "flex-end" }}>
            <label className="form-label">&nbsp;</label>
            <button className="btn btn--primary" onClick={handleAdd}>Guardar</button>
          </div>
        </div>
      )}

      {asset.movements.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>Sin movimientos registrados</p>
      ) : (
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>Importe</th>
              <th style={{ textAlign: "right" }}>Participaciones</th>
              <th style={{ textAlign: "right" }}>Precio/part.</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {asset.movements.map((m) => (
              <tr key={m.id}>
                <td className="td-mono">{m.date}</td>
                <td>
                  <span className={`badge ${m.type === "buy" || m.type === "transfer_in" ? "badge--green" : m.type === "sell" ? "badge--red" : "badge--muted"}`}>
                    {MOVEMENT_LABELS[m.type] ?? m.type}
                  </span>
                </td>
                <td className="td-mono" style={{ textAlign: "right" }}>{formatCurrency(m.amount, currency, false)}</td>
                <td className="td-mono" style={{ textAlign: "right" }}>{m.shares?.toFixed(4) ?? "—"}</td>
                <td className="td-mono" style={{ textAlign: "right" }}>{m.pricePerShare ? formatCurrency(m.pricePerShare, currency, false) : "—"}</td>
                <td>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteMovement(asset.id, m.id)}>
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DIALOG: Añadir / Editar activo
// ---------------------------------------------------------------------------
function AssetDialog({
  mode, asset, onClose, onSave, isinLibrary,
}: {
  mode: "add" | "edit";
  asset?: Asset;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isinLibrary: any[];
}) {
  const [form, setForm] = useState({
    isin:           asset?.isin           ?? "",
    ticker:         asset?.ticker         ?? "",
    name:           asset?.name           ?? "",
    shares:         asset?.shares         ?? 0,
    averageBuyPrice: asset?.averageBuyPrice ?? 0,
    currentPrice:   asset?.currentPrice   ?? "",
    currency:       asset?.currency       ?? "EUR",
    broker:         asset?.broker         ?? "",
    status:         asset?.status         ?? "active",
  });
  const [saving, setSaving] = useState(false);

  // Auto-completar desde librería ISIN
  const handleIsinBlur = () => {
    const entry = isinLibrary.find((e) => e.isin === form.isin);
    if (entry) {
      setForm((f) => ({
        ...f,
        name:     f.name     || entry.name,
        ticker:   f.ticker   || (entry.ticker ?? ""),
        currency: entry.currency,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.isin || !form.shares || !form.averageBuyPrice) return;
    setSaving(true);
    await onSave({
      ...form,
      shares:           Number(form.shares),
      averageBuyPrice:  Number(form.averageBuyPrice),
      currentPrice:     form.currentPrice ? Number(form.currentPrice) : undefined,
    });
    setSaving(false);
  };

  const F = (field: keyof typeof form) => ({
    value:    form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value })),
  });

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h2 className="dialog__title">{mode === "add" ? "Nuevo activo" : "Editar activo"}</h2>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">ISIN *</label>
            <input className="form-input" placeholder="IE00B4L5Y983" {...F("isin")} onBlur={handleIsinBlur} style={{ textTransform: "uppercase" }} />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" placeholder="Vanguard FTSE All-World" {...F("name")} />
          </div>
          <div className="form-group">
            <label className="form-label">Ticker</label>
            <input className="form-input" placeholder="VWCE" {...F("ticker")} />
          </div>
          <div className="form-group">
            <label className="form-label">Participaciones *</label>
            <input className="form-input" type="number" placeholder="0" {...F("shares")} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio compra medio *</label>
            <input className="form-input" type="number" placeholder="0.00" {...F("averageBuyPrice")} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio actual</label>
            <input className="form-input" type="number" placeholder="0.00" {...F("currentPrice")} />
          </div>
          <div className="form-group">
            <label className="form-label">Divisa</label>
            <select className="form-input" {...F("currency")}>
              {["EUR","USD","GBP","CHF","JPY"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Broker / Custodio</label>
            <input className="form-input" placeholder="MyInvestor, DeGiro..." {...F("broker")} />
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-input" {...F("status")}>
              <option value="active">Activo</option>
              <option value="closed">Cerrado</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
        </div>

        <div className="dialog__footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : mode === "add" ? "Añadir activo" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Sin activos en cartera</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 13 }}>
        Añade fondos, ETFs o acciones para empezar a hacer seguimiento
      </p>
      <button className="btn btn--primary" onClick={onAdd}>
        <Plus size={14} /> Añadir primer activo
      </button>
    </div>
  );
}
