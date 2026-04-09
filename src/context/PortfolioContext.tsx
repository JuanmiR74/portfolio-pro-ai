// =============================================================================
// PortfolioContext.tsx — Contexto global de PortfolioPro
// Expone usePortfolio a toda la app sin prop-drilling
// =============================================================================

import { createContext, useContext, type ReactNode } from "react";
import { usePortfolio } from "../hooks/usePortfolio";
import type { UsePortfolioReturn } from "../types/portfolio";

const PortfolioContext = createContext<UsePortfolioReturn | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const portfolio = usePortfolio();
  return (
    <PortfolioContext.Provider value={portfolio}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolioContext(): UsePortfolioReturn {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolioContext must be used inside <PortfolioProvider>");
  return ctx;
}
