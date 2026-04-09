// =============================================================================
// calculations.ts — Motor de cálculo financiero de PortfolioPro
// XIRR (Newton-Raphson), P&L, XRay, SubFund weights
// =============================================================================

import type {
  Asset,
  AssetMetrics,
  ConciliationItem,
  ISINLibraryEntry,
  Movement,
  PortfolioSnapshot,
  PortfolioState,
  PortfolioSummary,
  RawMovementRow,
  RoboAdvisor,
  RoboAdvisorMetrics,
  SubFund,
  XRayLine,
  XRayResult,
} from "../types/portfolio";

// ---------------------------------------------------------------------------
// 1. XIRR — Newton-Raphson
// ---------------------------------------------------------------------------

/**
 * Calcula la Tasa Interna de Retorno Extendida (XIRR) para una serie de
 * flujos de caja en fechas irregulares.
 *
 * @param cashflows  Array de { amount, date } donde amount < 0 = salida, > 0 = entrada
 * @param guess      Estimación inicial (default 0.1 = 10%)
 * @returns          XIRR como decimal (0.12 = 12% anual) o null si no converge
 */
export function calculateXIRR(
  cashflows: { amount: number; date: Date }[],
  guess = 0.1
): number | null {
  if (cashflows.length < 2) return null;

  // Ordenar por fecha ascendente
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();

  // Años fraccionarios desde el primer flujo
  const years = sorted.map((cf) => (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000));
  const amounts = sorted.map((cf) => cf.amount);

  // NPV(r) = Σ [ amount_i / (1 + r)^years_i ]
  const npv = (r: number) =>
    amounts.reduce((sum, amt, i) => sum + amt / Math.pow(1 + r, years[i]), 0);

  // dNPV/dr = Σ [ -years_i * amount_i / (1 + r)^(years_i + 1) ]
  const dnpv = (r: number) =>
    amounts.reduce(
      (sum, amt, i) => sum + (-years[i] * amt) / Math.pow(1 + r, years[i] + 1),
      0
    );

  const MAX_ITER = 100;
  const TOLERANCE = 1e-7;
  let r = guess;

  for (let i = 0; i < MAX_ITER; i++) {
    const f = npv(r);
    const df = dnpv(r);
    if (Math.abs(df) < 1e-14) return null; // derivada nula — no converge
    const rNext = r - f / df;
    if (Math.abs(rNext - r) < TOLERANCE) return rNext;
    r = rNext;
  }

  return null; // no convergió en MAX_ITER
}

/**
 * Construye los flujos de caja de un Asset para XIRR:
 * - Movimientos de compra/fee como salidas (negativo)
 * - Dividendos/ventas como entradas (positivo)
 * - Valor de mercado actual como entrada final a día de hoy
 */
export function buildAssetCashflows(
  asset: Asset,
  includeDividends = true,
  includeFees = true
): { amount: number; date: Date }[] {
  const flows: { amount: number; date: Date }[] = [];

  for (const m of asset.movements) {
    const date = new Date(m.date);
    switch (m.type) {
      case "buy":
      case "transfer_in":
        flows.push({ amount: -(m.amount), date });
        break;
      case "sell":
      case "transfer_out":
        flows.push({ amount: m.amount, date });
        break;
      case "dividend":
        if (includeDividends) flows.push({ amount: m.amount, date });
        break;
      case "fee":
        if (includeFees) flows.push({ amount: -(m.amount), date });
        break;
    }
  }

  // Valor de mercado actual como flujo de salida hipotético a hoy
  const currentValue = asset.shares * (asset.currentPrice ?? asset.averageBuyPrice);
  if (currentValue > 0) {
    flows.push({ amount: currentValue, date: new Date() });
  }

  return flows;
}

/**
 * Construye los flujos de caja de un RoboAdvisor para XIRR.
 */
export function buildRoboCashflows(
  robo: RoboAdvisor
): { amount: number; date: Date }[] {
  const flows: { amount: number; date: Date }[] = [];

  for (const m of robo.movements) {
    const date = new Date(m.date);
    if (m.type === "buy" || m.type === "transfer_in") {
      flows.push({ amount: -(m.amount), date });
    } else if (m.type === "sell" || m.type === "transfer_out") {
      flows.push({ amount: m.amount, date });
    }
  }

  if (robo.currentValue && robo.currentValue > 0) {
    flows.push({ amount: robo.currentValue, date: new Date() });
  }

  return flows;
}

// ---------------------------------------------------------------------------
// 2. MÉTRICAS DE ACTIVOS
// ---------------------------------------------------------------------------

export function calcAssetCurrentValue(asset: Asset): number {
  return asset.shares * (asset.currentPrice ?? asset.averageBuyPrice);
}

export function calcAssetTotalCost(asset: Asset): number {
  return asset.movements
    .filter((m) => m.type === "buy" || m.type === "transfer_in")
    .reduce((sum, m) => sum + m.amount, 0);
}

export function calcRealizedPnL(asset: Asset): number {
  return asset.movements
    .filter((m) => m.type === "sell" || m.type === "transfer_out")
    .reduce((sum, m) => {
      const proceeds = m.amount;
      const cost = (m.shares ?? 0) * asset.averageBuyPrice;
      return sum + (proceeds - cost);
    }, 0);
}

export function getAssetMetrics(
  asset: Asset,
  totalPortfolioValue: number,
  xirrSettings = { includeDividends: true, includeFees: true }
): AssetMetrics {
  const currentValue = calcAssetCurrentValue(asset);
  const totalCost = calcAssetTotalCost(asset);
  const unrealizedPnL = currentValue - asset.shares * asset.averageBuyPrice;
  const unrealizedPnLPercent =
    asset.averageBuyPrice > 0
      ? (unrealizedPnL / (asset.shares * asset.averageBuyPrice)) * 100
      : 0;
  const realizedPnL = calcRealizedPnL(asset);

  const cashflows = buildAssetCashflows(
    asset,
    xirrSettings.includeDividends,
    xirrSettings.includeFees
  );
  const xirrRaw = cashflows.length >= 2 ? calculateXIRR(cashflows) : null;

  return {
    assetId: asset.id,
    isin: asset.isin,
    currentValue,
    totalCost,
    unrealizedPnL,
    unrealizedPnLPercent,
    realizedPnL,
    xirr: xirrRaw !== null ? xirrRaw * 100 : undefined,
    weightInPortfolio:
      totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 3. MÉTRICAS DE ROBO-ADVISORS
// ---------------------------------------------------------------------------

export function getRoboMetrics(
  robo: RoboAdvisor,
  totalPortfolioValue: number
): RoboAdvisorMetrics {
  const totalInvested = robo.movements
    .filter((m) => m.type === "buy" || m.type === "transfer_in")
    .reduce((sum, m) => sum + m.amount, 0);

  const currentValue = robo.currentValue ?? totalInvested;
  const pnL = currentValue - totalInvested;
  const pnLPercent = totalInvested > 0 ? (pnL / totalInvested) * 100 : 0;

  const cashflows = buildRoboCashflows(robo);
  const xirrRaw = cashflows.length >= 2 ? calculateXIRR(cashflows) : null;

  return {
    roboAdvisorId: robo.id,
    totalInvested,
    currentValue,
    pnL,
    pnLPercent,
    xirr: xirrRaw !== null ? xirrRaw * 100 : undefined,
    weightInPortfolio:
      totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 4. RESUMEN GLOBAL DEL PORTFOLIO
// ---------------------------------------------------------------------------

export function getPortfolioSummary(state: PortfolioState): PortfolioSummary {
  const assetValues = state.assets.map(calcAssetCurrentValue);
  const roboValues = state.roboAdvisors.map((r) => r.currentValue ?? 0);

  const totalAssetsValue = assetValues.reduce((s, v) => s + v, 0);
  const totalRoboValue = roboValues.reduce((s, v) => s + v, 0);
  const totalValue = totalAssetsValue + totalRoboValue + state.cashBalance;

  const totalInvested =
    state.assets.reduce((s, a) => s + calcAssetTotalCost(a), 0) +
    state.roboAdvisors.reduce(
      (s, r) =>
        s +
        r.movements
          .filter((m) => m.type === "buy" || m.type === "transfer_in")
          .reduce((rs, m) => rs + m.amount, 0),
      0
    );

  const totalPnL = totalValue - state.cashBalance - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // XIRR global: combinar todos los flujos de caja
  const allCashflows: { amount: number; date: Date }[] = [
    ...state.assets.flatMap((a) =>
      buildAssetCashflows(
        a,
        state.settings.xirr.includeDividends,
        state.settings.xirr.includeFees
      )
    ),
    ...state.roboAdvisors.flatMap(buildRoboCashflows),
  ];
  const globalXirrRaw = allCashflows.length >= 2 ? calculateXIRR(allCashflows) : null;

  return {
    totalValue,
    totalInvested,
    cashBalance: state.cashBalance,
    totalPnL,
    totalPnLPercent,
    xirr: globalXirrRaw !== null ? globalXirrRaw * 100 : undefined,
    currency: state.settings.display.currency,
    lastUpdated: new Date().toISOString(),
    assetCount: state.assets.length,
    roboAdvisorCount: state.roboAdvisors.length,
  };
}

// ---------------------------------------------------------------------------
// 5. X-RAY ENGINE
// ---------------------------------------------------------------------------

/**
 * Motor X-Ray: recorre todos los activos y Robo-Advisors,
 * busca sus ISINs en la librería y proyecta la distribución real.
 */
export function computeXRay(state: PortfolioState): XRayResult {
  const library = new Map(state.isinLibrary.map((e) => [e.isin, e]));
  const totalValue =
    state.assets.reduce((s, a) => s + calcAssetCurrentValue(a), 0) +
    state.roboAdvisors.reduce((s, r) => s + (r.currentValue ?? 0), 0);

  const geoMap = new Map<string, number>();
  const sectorMap = new Map<string, number>();
  const assetClassMap = new Map<string, number>();

  let coveredValue = 0;
  const uncoveredAssets: string[] = [];

  // --- Activos directos ---
  for (const asset of state.assets) {
    const value = calcAssetCurrentValue(asset);
    const entry = library.get(asset.isin);

    if (!entry) {
      uncoveredAssets.push(asset.isin);
      continue;
    }

    coveredValue += value;
    const weight = totalValue > 0 ? value / totalValue : 0;

    for (const g of entry.geography) {
      const prev = geoMap.get(g.region) ?? 0;
      geoMap.set(g.region, prev + weight * (g.weight / 100));
    }
    for (const s of entry.sectors) {
      const prev = sectorMap.get(s.sector) ?? 0;
      sectorMap.set(s.sector, prev + weight * (s.weight / 100));
    }
    for (const ac of entry.assetClasses) {
      const prev = assetClassMap.get(ac.assetClass) ?? 0;
      assetClassMap.set(ac.assetClass, prev + weight * (ac.weight / 100));
    }
  }

  // --- Robo-Advisors (via subFunds) ---
  for (const robo of state.roboAdvisors) {
    const roboValue = robo.currentValue ?? 0;
    if (roboValue === 0) continue;

    for (const sf of robo.subFunds) {
      const entry = library.get(sf.isin);
      if (!entry) {
        if (!uncoveredAssets.includes(sf.isin)) uncoveredAssets.push(sf.isin);
        continue;
      }

      const sfValue = roboValue * (sf.derivedWeight / 100);
      coveredValue += sfValue;
      const weight = totalValue > 0 ? sfValue / totalValue : 0;

      for (const g of entry.geography) {
        const prev = geoMap.get(g.region) ?? 0;
        geoMap.set(g.region, prev + weight * (g.weight / 100));
      }
      for (const s of entry.sectors) {
        const prev = sectorMap.get(s.sector) ?? 0;
        sectorMap.set(s.sector, prev + weight * (s.weight / 100));
      }
      for (const ac of entry.assetClasses) {
        const prev = assetClassMap.get(ac.assetClass) ?? 0;
        assetClassMap.set(ac.assetClass, prev + weight * (ac.weight / 100));
      }
    }
  }

  // Convertir mapas a arrays ordenados por peso descendente
  const toLines = (map: Map<string, number>): XRayLine[] =>
    [...map.entries()]
      .map(([label, w]) => ({
        label,
        weight: +(w * 100).toFixed(2),
        value: +(w * totalValue).toFixed(2),
        coverage: totalValue > 0 ? +((coveredValue / totalValue) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.weight - a.weight);

  return {
    geography: toLines(geoMap),
    sectors: toLines(sectorMap),
    assetClasses: toLines(assetClassMap),
    overallCoverage: totalValue > 0 ? +((coveredValue / totalValue) * 100).toFixed(1) : 0,
    uncoveredAssets,
    calculatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 6. SUBFUNDS — Recálculo de pesos desde movimientos
// ---------------------------------------------------------------------------

/**
 * Recalcula los subFunds de un RoboAdvisor a partir de sus movimientos.
 * El peso de cada ISIN = netInvested(isin) / totalNetInvested * 100.
 * Solo se consideran movimientos de compra/venta/traspaso.
 */
export function recalculateSubFunds(
  movements: Movement[],
  library: Map<string, ISINLibraryEntry>
): SubFund[] {
  const netByIsin = new Map<string, number>();

  for (const m of movements) {
    if (!m.subFundIsin) continue;
    const current = netByIsin.get(m.subFundIsin) ?? 0;
    const delta =
      m.type === "buy" || m.type === "transfer_in"
        ? m.amount
        : m.type === "sell" || m.type === "transfer_out"
        ? -m.amount
        : 0;
    netByIsin.set(m.subFundIsin, current + delta);
  }

  const totalNet = [...netByIsin.values()].reduce((s, v) => s + Math.max(v, 0), 0);

  const subFunds: SubFund[] = [];
  for (const [isin, net] of netByIsin.entries()) {
    if (net <= 0) continue;
    const entry = library.get(isin);
    subFunds.push({
      isin,
      name: entry?.name,
      derivedWeight: totalNet > 0 ? +((net / totalNet) * 100).toFixed(2) : 0,
      netInvested: +net.toFixed(2),
    });
  }

  return subFunds.sort((a, b) => b.derivedWeight - a.derivedWeight);
}

// ---------------------------------------------------------------------------
// 7. CONCILIACIÓN DE MOVIMIENTOS IMPORTADOS
// ---------------------------------------------------------------------------

/**
 * Genera sugerencias de conciliación para un lote de movimientos importados.
 * Compara ISIN, fecha y monto contra activos y robos existentes.
 */
export function buildConciliationItems(
  rows: RawMovementRow[],
  state: PortfolioState
): ConciliationItem[] {
  return rows.map((row) => {
    // Buscar match por ISIN en assets directos
    const matchedAsset = row.isin
      ? state.assets.find((a) => a.isin === row.isin)
      : undefined;

    // Buscar match por ISIN en subFunds de robos
    const matchedRobo = row.isin
      ? state.roboAdvisors.find((r) =>
          r.subFunds.some((sf) => sf.isin === row.isin)
        )
      : undefined;

    // Calcular confianza: 1.0 si ISIN exacto, 0.5 si solo descripción parcial
    const confidence = row.isin
      ? matchedAsset || matchedRobo
        ? 1.0
        : 0.6 // ISIN conocido pero sin match en cartera → probable nuevo activo
      : 0.2;   // Sin ISIN → confianza baja

    const isNew = !matchedAsset && !matchedRobo;

    let action: ConciliationItem["action"] = "skip";
    if (matchedAsset) action = "match_asset";
    else if (matchedRobo) action = "match_robo";
    else if (row.isin) action = "create_asset";

    return {
      rawRow: row,
      suggestedIsin: row.isin,
      matchedAssetId: matchedAsset?.id,
      matchedRoboAdvisorId: matchedRobo?.id,
      action,
      isNew,
      confidence,
    };
  });
}

// ---------------------------------------------------------------------------
// 8. HISTORIAL — Generación de snapshots
// ---------------------------------------------------------------------------

export function createSnapshot(state: PortfolioState): PortfolioSnapshot {
  const summary = getPortfolioSummary(state);
  return {
    date: new Date().toISOString().split("T")[0],
    totalValue: +summary.totalValue.toFixed(2),
    totalInvested: +summary.totalInvested.toFixed(2),
    cashBalance: state.cashBalance,
    currency: state.settings.display.currency,
  };
}
