// =============================================================================
// App.tsx — Entry point de PortfolioPro
// =============================================================================

import { PortfolioProvider } from "./context/PortfolioContext";
import { AppShell }          from "./components/AppShell";

export default function App() {
  return (
    <PortfolioProvider>
      <AppShell />
    </PortfolioProvider>
  );
}

// =============================================================================
// Re-exports de módulos separados
// =============================================================================
export { ISINLibraryModule } from "./components/isin/ISINLibraryModule";
export { XRayModule }        from "./components/xray/XRayModule";
export { SettingsModule }    from "./components/settings/SettingsModule";