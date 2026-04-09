// =============================================================================
// ISINLibraryModule.tsx — Catálogo centralizado de ISINs con clasificación 3D
// =============================================================================

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { usePortfolioContext } from "../../context/PortfolioContext";
import type { ISINLibraryEntry, GeographyAllocation, SectorAllocation, AssetClassAllocation } from "../../types/portfolio";

export function ISINLibraryModule() {
  const { state, addISINEntry, updateISINEntry, deleteISINEntry } = usePortfolioContext();
  const [search,      setSearch]      = useState("");
  const [editEntry,   setEditEntry]   = useState<ISINLibraryEntry | null>(null);
  const [showDialog,  setShowDialog]  = useState(false);

  const library = state?.isinLibrary ?? [];
  const filtered = library.filter(
    (e) =>
      e.isin.includes(search.toUpperCase()) ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.ticker?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="module-header">
        <div>
          <h1 className="module-title">Librería ISIN</h1>
          <p className="module-subtitle">{library.length} instrumentos con clasificación 3D · Alimenta el X-Ray</p>
        </div>
        <button className="btn btn--primary" onClick={() => { setEditEntry(null); setShowDialog(true); }}>
          <Plus size={14} /> Añadir ISIN
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20, maxWidth: 340 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          className="form-input"
          style={{ paddingLeft: 36, width: "100%" }}
          placeholder="Buscar por ISIN, nombre o ticker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <ISINEmptyState onAdd={() => setShowDialog(true)} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ISIN</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Divisas</th>
                <th>TER</th>
                <th style={{ textAlign: "center" }}>Geografía</th>
                <th style={{ textAlign: "center" }}>Sectores</th>
                <th style={{ textAlign: "center" }}>Clase</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.isin}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{entry.isin}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{entry.name}</div>
                    {entry.ticker && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{entry.ticker}</div>}
                  </td>
                  <td>
                    <span className="badge badge--gold" style={{ textTransform: "uppercase", fontSize: 10 }}>
                      {entry.assetType}
                    </span>
                  </td>
                  <td className="td-mono td-muted">{entry.currency}</td>
                  <td className="td-mono td-muted">
                    {entry.ter !== undefined ? `${entry.ter.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <CompactDistribution items={entry.geography.slice(0, 2).map((g) => ({ label: g.region, weight: g.weight }))} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <CompactDistribution items={entry.sectors.slice(0, 2).map((s) => ({ label: s.sector, weight: s.weight }))} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <CompactDistribution items={entry.assetClasses.slice(0, 2).map((a) => ({ label: a.assetClass, weight: a.weight }))} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setEditEntry(entry); setShowDialog(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteISINEntry(entry.isin)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <ISINDialog
          entry={editEntry}
          onClose={() => { setShowDialog(false); setEditEntry(null); }}
          onSave={async (data) => {
            if (editEntry) await updateISINEntry(editEntry.isin, data);
            else await addISINEntry(data);
            setShowDialog(false);
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}

function CompactDistribution({ items }: { items: { label: string; weight: number }[] }) {
  if (!items.length) return <span className="td-muted" style={{ fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
      {items.map((item) => (
        <span key={item.label} style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          {item.label.slice(0, 12)} {item.weight.toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

function ISINEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>Librería vacía</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: 8, fontSize: 13 }}>
        Añade instrumentos con su clasificación 3D para activar el X-Ray
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", marginBottom: 24 }}>
        Geografía + Sectores + Clase de activo → proyección real de tu cartera
      </p>
      <button className="btn btn--primary" onClick={onAdd}><Plus size={14} /> Añadir primer ISIN</button>
    </div>
  );
}

// Dialog ISIN — simplificado para brevedad, con campos 3D
function ISINDialog({ entry, onClose, onSave }: {
  entry:   ISINLibraryEntry | null;
  onClose: () => void;
  onSave:  (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    isin:       entry?.isin       ?? "",
    name:       entry?.name       ?? "",
    ticker:     entry?.ticker     ?? "",
    currency:   entry?.currency   ?? "EUR",
    assetType:  entry?.assetType  ?? "etf",
    ter:        entry?.ter        ?? "",
    benchmark:  entry?.benchmark  ?? "",
    source:     entry?.source     ?? "manual",
    // Campos 3D como JSON editable para máxima flexibilidad
    geographyJson:    JSON.stringify(entry?.geography    ?? [{ region: "Global", weight: 100 }], null, 2),
    sectorsJson:      JSON.stringify(entry?.sectors      ?? [{ sector: "Equity", weight: 100 }], null, 2),
    assetClassesJson: JSON.stringify(entry?.assetClasses ?? [{ assetClass: "Equity", weight: 100 }], null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      const geography    = JSON.parse(form.geographyJson);
      const sectors      = JSON.parse(form.sectorsJson);
      const assetClasses = JSON.parse(form.assetClassesJson);
      setJsonError(null);
      setSaving(true);
      await onSave({
        isin: form.isin.toUpperCase(),
        name: form.name,
        ticker: form.ticker || undefined,
        currency: form.currency,
        assetType: form.assetType,
        ter: form.ter ? parseFloat(String(form.ter)) : undefined,
        benchmark: form.benchmark || undefined,
        source: form.source,
        geography,
        sectors,
        assetClasses,
        lastUpdated: new Date().toISOString().split("T")[0],
      });
      setSaving(false);
    } catch {
      setJsonError("JSON inválido. Revisa el formato de los campos de distribución.");
    }
  };

  const F = (field: keyof typeof form) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value })),
  });

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h2 className="dialog__title">{entry ? "Editar ISIN" : "Añadir ISIN"}</h2>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">ISIN *</label>
            <input className="form-input" placeholder="IE00B4L5Y983" {...F("isin")} />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input className="form-input" placeholder="Vanguard FTSE All-World UCITS ETF" {...F("name")} />
          </div>
          <div className="form-group">
            <label className="form-label">Ticker</label>
            <input className="form-input" placeholder="VWCE" {...F("ticker")} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-input" {...F("assetType")}>
              {["etf","mutual_fund","stock","bond","reit","commodity","crypto","cash_equivalent","other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Divisa</label>
            <select className="form-input" {...F("currency")}>
              {["EUR","USD","GBP","CHF","JPY"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">TER (%)</label>
            <input className="form-input" type="number" placeholder="0.22" {...F("ter")} />
          </div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Geografía (JSON — debe sumar 100%)</label>
            <textarea className="form-input" rows={4} style={{ fontFamily: "var(--font-mono)", fontSize: 11, resize: "vertical" }} {...F("geographyJson")} />
          </div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Sectores (JSON — debe sumar 100%)</label>
            <textarea className="form-input" rows={4} style={{ fontFamily: "var(--font-mono)", fontSize: 11, resize: "vertical" }} {...F("sectorsJson")} />
          </div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Clases de activo (JSON — debe sumar 100%)</label>
            <textarea className="form-input" rows={3} style={{ fontFamily: "var(--font-mono)", fontSize: 11, resize: "vertical" }} {...F("assetClassesJson")} />
          </div>
          {jsonError && (
            <div style={{ gridColumn: "1/-1", color: "var(--red)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
              ⚠ {jsonError}
            </div>
          )}
        </div>
        <div className="dialog__footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : entry ? "Guardar cambios" : "Añadir a librería"}
          </button>
        </div>
      </div>
    </div>
  );
}
