// =============================================================================
// AppShell.tsx — Layout principal de PortfolioPro
// Sidebar fija + área de contenido + Toaster
// Estética: luxury dark finance — DM Serif Display + IBM Plex Mono
// =============================================================================

import { useState } from "react";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  Briefcase,
  Bot,
  BookOpen,
  ScanSearch,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { usePortfolioContext } from "../context/PortfolioContext";

// Módulos lazy-loaded
import { DashboardModule }   from "./dashboard/DashboardModule";
import { AssetsModule }      from "./assets/AssetsModule";
import { RoboModule }        from "./robo/RoboModule";
import { ISINLibraryModule } from "./isin/ISINLibraryModule";
import { XRayModule }        from "./xray/XRayModule";
import { SettingsModule }    from "./settings/SettingsModule";

type ModuleId = "dashboard" | "assets" | "robo" | "isin" | "xray" | "settings";

const NAV_ITEMS: { id: ModuleId; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard",        icon: LayoutDashboard },
  { id: "assets",    label: "Fondos & Acciones", icon: Briefcase },
  { id: "robo",      label: "Robo-Advisors",     icon: Bot },
  { id: "isin",      label: "Librería ISIN",     icon: BookOpen },
  { id: "xray",      label: "X-Ray",             icon: ScanSearch },
  { id: "settings",  label: "Configuración",     icon: Settings },
];

export function AppShell() {
  const { isLoading, isSaving, error, getSummary } = usePortfolioContext();
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const summary = getSummary();

  if (isLoading) return <SplashScreen />;

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
        {/* Logo */}
        <div className="sidebar__logo">
          <TrendingUp size={20} className="logo-icon" />
          {!collapsed && <span className="logo-text">PortfolioPro</span>}
        </div>

        {/* Valor total — mini widget en sidebar */}
        {!collapsed && summary && (
          <div className="sidebar__value-widget">
            <span className="vw-label">Valor total</span>
            <span className="vw-amount">
              {formatCurrency(summary.totalValue, summary.currency)}
            </span>
            <span className={`vw-pnl ${summary.totalPnL >= 0 ? "positive" : "negative"}`}>
              {summary.totalPnL >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(summary.totalPnLPercent).toFixed(2)}%
            </span>
          </div>
        )}

        {/* Nav items */}
        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeModule === id ? "nav-item--active" : ""}`}
              onClick={() => setActiveModule(id)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Saving indicator */}
        {isSaving && (
          <div className="sidebar__saving">
            <Loader2 size={14} className="spin" />
            {!collapsed && <span>Guardando...</span>}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          className="sidebar__collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>⚠ {error}</span>
          </div>
        )}
        <div className="module-wrapper">
          {activeModule === "dashboard" && <DashboardModule />}
          {activeModule === "assets"    && <AssetsModule />}
          {activeModule === "robo"      && <RoboModule />}
          {activeModule === "isin"      && <ISINLibraryModule />}
          {activeModule === "xray"      && <XRayModule />}
          {activeModule === "settings"  && <SettingsModule />}
        </div>
      </main>

      {/* ── TOASTER — Sonner ── */}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
          },
        }}
      />

      {/* ── GLOBAL STYLES ── */}
      <style>{GLOBAL_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Splash / loading screen
// ---------------------------------------------------------------------------
function SplashScreen() {
  return (
    <div className="splash">
      <TrendingUp size={32} />
      <span>PortfolioPro</span>
      <Loader2 size={18} className="spin" />
      <style>{GLOBAL_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatCurrency(
  value: number,
  currency = "EUR",
  compact = true
): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value / 1_000_000) + "M";
  }
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// GLOBAL STYLES — design tokens luxury dark finance
// ---------------------------------------------------------------------------
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #0a0a0f;
    --surface-1:   #111118;
    --surface-2:   #1a1a24;
    --surface-3:   #22222f;
    --border:      rgba(255,255,255,0.07);
    --border-hi:   rgba(255,255,255,0.14);
    --gold:        #c9a84c;
    --gold-dim:    #8a6f30;
    --green:       #3ecf8e;
    --red:         #f87171;
    --text-primary:   #e8e8f0;
    --text-secondary: #7a7a96;
    --text-muted:     #44445a;
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
    --font-mono:    'IBM Plex Mono', 'Courier New', monospace;
    --radius-sm:  6px;
    --radius-md:  10px;
    --radius-lg:  16px;
    --sidebar-w:  220px;
    --sidebar-w-collapsed: 60px;
    --transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text-primary); }
  body { font-family: var(--font-body); font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

  /* ── APP SHELL ── */
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: var(--sidebar-w);
    min-width: var(--sidebar-w);
    background: var(--surface-1);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 20px 0 16px;
    transition: width var(--transition), min-width var(--transition);
    overflow: hidden;
    position: relative;
    z-index: 10;
  }
  .sidebar--collapsed { width: var(--sidebar-w-collapsed); min-width: var(--sidebar-w-collapsed); }

  .sidebar__logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .logo-icon { color: var(--gold); flex-shrink: 0; }
  .logo-text {
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--text-primary);
    white-space: nowrap;
    letter-spacing: 0.02em;
  }

  .sidebar__value-widget {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    margin: 0 10px 16px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .vw-label  { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
  .vw-amount { font-family: var(--font-display); font-size: 17px; color: var(--text-primary); }
  .vw-pnl    { font-family: var(--font-mono); font-size: 11px; }
  .vw-pnl.positive { color: var(--green); }
  .vw-pnl.negative { color: var(--red); }

  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    transition: background var(--transition), color var(--transition);
    white-space: nowrap;
    width: 100%;
    text-align: left;
  }
  .nav-item:hover { background: var(--surface-2); color: var(--text-primary); }
  .nav-item--active {
    background: var(--surface-3);
    color: var(--gold);
    font-weight: 500;
  }
  .nav-item--active svg { color: var(--gold); }

  .sidebar__saving {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .sidebar__collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 8px 8px 0;
    padding: 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--transition);
  }
  .sidebar__collapse-btn:hover { background: var(--surface-2); }

  /* ── MAIN CONTENT ── */
  .main-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg);
  }
  .module-wrapper {
    max-width: 1400px;
    margin: 0 auto;
    padding: 32px 32px;
  }

  /* ── MODULE HEADER (compartido) ── */
  .module-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .module-title {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--text-primary);
    line-height: 1.1;
  }
  .module-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* ── CARDS ── */
  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px 24px;
  }
  .card--hoverable:hover { border-color: var(--border-hi); }
  .card__label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .card__value {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--text-primary);
    line-height: 1;
  }
  .card__value--mono {
    font-family: var(--font-mono);
    font-size: 22px;
  }
  .card__delta {
    font-family: var(--font-mono);
    font-size: 12px;
    margin-top: 6px;
  }
  .card__delta.positive { color: var(--green); }
  .card__delta.negative { color: var(--red); }

  /* ── TABLES ── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .data-table th {
    text-align: left;
    padding: 10px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
  }
  .data-table td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    vertical-align: middle;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: var(--surface-2); }
  .td-mono { font-family: var(--font-mono); font-size: 12px; }
  .td-muted { color: var(--text-secondary); }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition);
    white-space: nowrap;
  }
  .btn:hover { background: var(--surface-3); border-color: var(--border-hi); }
  .btn--primary {
    background: var(--gold-dim);
    border-color: var(--gold);
    color: #fff;
  }
  .btn--primary:hover { background: var(--gold); }
  .btn--ghost { background: transparent; border-color: transparent; }
  .btn--ghost:hover { background: var(--surface-2); border-color: var(--border); }
  .btn--danger { border-color: rgba(248,113,113,0.3); color: var(--red); }
  .btn--danger:hover { background: rgba(248,113,113,0.08); }
  .btn--sm { padding: 5px 10px; font-size: 12px; }

  /* ── BADGES ── */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
  }
  .badge--green  { background: rgba(62,207,142,0.12); color: var(--green); }
  .badge--red    { background: rgba(248,113,113,0.12); color: var(--red); }
  .badge--gold   { background: rgba(201,168,76,0.12);  color: var(--gold); }
  .badge--muted  { background: var(--surface-3); color: var(--text-secondary); }

  /* ── FORM ELEMENTS ── */
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); }
  .form-input {
    padding: 9px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 13px;
    outline: none;
    transition: border-color var(--transition);
  }
  .form-input:focus { border-color: var(--gold-dim); }
  .form-input::placeholder { color: var(--text-muted); }

  /* ── DIALOG / MODAL ── */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 150ms ease;
  }
  .dialog {
    background: var(--surface-1);
    border: 1px solid var(--border-hi);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 560px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 28px;
    animation: slideUp 200ms cubic-bezier(0.4,0,0.2,1);
  }
  .dialog--wide { max-width: 800px; }
  .dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .dialog__title { font-family: var(--font-display); font-size: 22px; }
  .dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .dialog__close:hover { background: var(--surface-2); color: var(--text-primary); }
  .dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  /* ── GRID UTILS ── */
  .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }

  /* ── MISC ── */
  .divider { height: 1px; background: var(--border); margin: 20px 0; }
  .text-mono { font-family: var(--font-mono); }
  .text-positive { color: var(--green); }
  .text-negative { color: var(--red); }
  .text-gold     { color: var(--gold); }
  .text-muted    { color: var(--text-secondary); }
  .text-sm       { font-size: 12px; }
  .flex          { display: flex; }
  .flex-center   { display: flex; align-items: center; }
  .flex-between  { display: flex; align-items: center; justify-content: space-between; }
  .gap-8         { gap: 8px; }
  .gap-12        { gap: 12px; }
  .gap-16        { gap: 16px; }
  .gap-24        { gap: 24px; }
  .mb-16         { margin-bottom: 16px; }
  .mb-24         { margin-bottom: 24px; }
  .w-full        { width: 100%; }

  /* ── ANIMATIONS ── */
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }

  /* ── ERROR BANNER ── */
  .error-banner {
    background: rgba(248,113,113,0.08);
    border-bottom: 1px solid rgba(248,113,113,0.2);
    color: var(--red);
    padding: 10px 32px;
    font-size: 13px;
    font-family: var(--font-mono);
  }

  /* ── SPLASH ── */
  .splash {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: var(--bg);
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: 22px;
  }
  .splash svg { color: var(--gold); }

  /* ── PROGRESS BAR ── */
  .progress-bar-track {
    height: 4px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: var(--gold);
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  /* ── SCROLLBAR ── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 99px; }
`;
