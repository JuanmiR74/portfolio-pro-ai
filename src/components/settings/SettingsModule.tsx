// =============================================================================
// SettingsModule.tsx — Configuración de la app
// =============================================================================

import { useState } from "react";
import { usePortfolioContext } from "../../context/PortfolioContext";

export function SettingsModule() {
  const { state, updateSettings, updateCashBalance } = usePortfolioContext();
  const [cash, setCash] = useState(String(state?.cashBalance ?? 0));

  if (!state) return null;

  const s = state.settings;

  return (
    <div>
      <div className="module-header">
        <div>
          <h1 className="module-title">Configuración</h1>
          <p className="module-subtitle">Preferencias de visualización y cálculo</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
        {/* Display */}
        <div className="card">
          <div className="card__label mb-16">Visualización</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Divisa base</label>
              <select className="form-input" value={s.display.currency}
                onChange={(e) => updateSettings({ display: { ...s.display, currency: e.target.value } })}>
                {["EUR","USD","GBP","CHF"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Decimales</label>
              <select className="form-input" value={s.display.decimalPlaces}
                onChange={(e) => updateSettings({ display: { ...s.display, decimalPlaces: parseInt(e.target.value) as 0|2|4 } })}>
                {[0,2,4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* XIRR */}
        <div className="card">
          <div className="card__label mb-16">Cálculo XIRR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ToggleSetting
              label="Incluir dividendos"
              value={s.xirr.includeDividends}
              onChange={(v) => updateSettings({ xirr: { ...s.xirr, includeDividends: v } })}
            />
            <ToggleSetting
              label="Incluir comisiones"
              value={s.xirr.includeFees}
              onChange={(v) => updateSettings({ xirr: { ...s.xirr, includeFees: v } })}
            />
          </div>
        </div>

        {/* Liquidez */}
        <div className="card">
          <div className="card__label mb-16">Saldo en efectivo</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Importe ({s.display.currency})</label>
              <input className="form-input" type="number" value={cash}
                onChange={(e) => setCash(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={() => updateCashBalance(parseFloat(cash) || 0)}>
              Actualizar
            </button>
          </div>
        </div>

        {/* Perfil riesgo */}
        <div className="card">
          <div className="card__label mb-16">Perfil de riesgo</div>
          <select className="form-input" value={s.riskProfile}
            onChange={(e) => updateSettings({ riskProfile: e.target.value as any })}>
            <option value="conservative">Conservador</option>
            <option value="moderate">Moderado</option>
            <option value="aggressive">Agresivo</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange }: {
  label:    string;
  value:    boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer",
          background: value ? "var(--gold-dim)" : "var(--surface-3)",
          position: "relative", transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 3,
          left: value ? 20 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: value ? "var(--gold)" : "var(--text-muted)",
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}
