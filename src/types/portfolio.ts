// =============================================================================
// PortfolioPro — Core TypeScript Types
// Arquitectura: Single Table Design sobre Supabase (columna JSONB portfolio_state)
// =============================================================================

// ---------------------------------------------------------------------------
// 1. PRIMITIVOS Y UTILIDADES
// ---------------------------------------------------------------------------

/** ISO 8601 date string: "2024-01-15" */
export type ISODateString = string;

/** ISO 4217 currency code: "EUR", "USD", "GBP" */
export type CurrencyCode = string;

/** ISIN: 12-char alphanumeric, e.g. "IE00B4L5Y983" */
export type ISIN = string;

/** Peso porcentual [0–100]. La suma de pesos en un array debe ser 100. */
export type WeightPercent = number;

/** Precio monetario siempre positivo */
export type MonetaryAmount = number;

// ---------------------------------------------------------------------------
// 2. LIBRERÍA GLOBAL DE ISIN — "La Inteligencia"
// ---------------------------------------------------------------------------

/**
 * Dimensión geográfica de un ISIN.
 * Los pesos deben sumar 100.
 */
export interface GeographyAllocation {
  region: string; // e.g. "North America", "Europe", "Emerging Markets"
  weight: WeightPercent;
}

/**
 * Dimensión sectorial de un ISIN (GICS o clasificación propia).
 * Los pesos deben sumar 100.
 */
export interface SectorAllocation {
  sector: string; // e.g. "Technology", "Healthcare", "Financials"
  weight: WeightPercent;
}

/**
 * Dimensión de clase de activo de un ISIN.
 * Los pesos deben sumar 100.
 */
export interface AssetClassAllocation {
  assetClass: string; // e.g. "Equity", "Fixed Income", "Real Estate", "Commodity"
  weight: WeightPercent;
}

/**
 * Clasificación 3D completa de un ISIN en la librería global.
 * Es el núcleo del X-Ray: sin este registro el ISIN es "opaco".
 */
export interface ISINLibraryEntry {
  isin: ISIN;
  name: string;           // Nombre largo del fondo/acción
  ticker?: string;        // Ticker de mercado opcional (e.g. "VWCE")
  currency: CurrencyCode;
  assetType: AssetType;

  // Clasificación 3D — cada array debe sumar 100
  geography: GeographyAllocation[];
  sectors: SectorAllocation[];
  assetClasses: AssetClassAllocation[];

  // Metadatos de gestión
  ter?: number;           // Total Expense Ratio en % (e.g. 0.22)
  benchmark?: string;     // Índice de referencia
  lastUpdated: ISODateString;
  source?: string;        // Fuente de los datos: "morningstar", "manual", etc.
}

export type AssetType =
  | "etf"
  | "mutual_fund"
  | "stock"
  | "bond"
  | "reit"
  | "commodity"
  | "crypto"
  | "cash_equivalent"
  | "other";

// ---------------------------------------------------------------------------
// 3. MOVIMIENTOS — Flujos de caja para XIRR
// ---------------------------------------------------------------------------

export type MovementType =
  | "buy"           // Compra / aportación
  | "sell"          // Venta / reembolso
  | "dividend"      // Dividendo cobrado
  | "fee"           // Comisión o gasto
  | "transfer_in"   // Traspaso de entrada
  | "transfer_out"; // Traspaso de salida

/**
 * Un movimiento individual en un activo o Robo-Advisor.
 * Sirve como flujo de caja para el cálculo de XIRR.
 */
export interface Movement {
  id: string;                   // UUID generado en cliente
  date: ISODateString;
  type: MovementType;
  shares?: number;              // Participaciones / acciones implicadas
  pricePerShare?: MonetaryAmount;
  amount: MonetaryAmount;       // Importe neto del movimiento (positivo = entrada)
  currency: CurrencyCode;
  exchangeRate?: number;        // Tasa vs. divisa base del portfolio
  fees?: MonetaryAmount;        // Comisiones incluidas en el movimiento
  notes?: string;
  /** Referencia al RoboAdvisor si el movimiento fue importado desde uno */
  roboAdvisorId?: string;
  /** Referencia al sub-fondo dentro del Robo si aplica */
  subFundIsin?: ISIN;
}

// ---------------------------------------------------------------------------
// 4. ACTIVOS INDIVIDUALES — Fondos y Acciones directas
// ---------------------------------------------------------------------------

export type AssetStatus = "active" | "closed" | "pending";

/**
 * Un activo directo en cartera (fondo, ETF, acción...).
 * El usuario aporta ISIN, cantidad y precio de compra.
 * La "cualidad" (geografía, sectores) viene de ISINLibraryEntry.
 */
export interface Asset {
  id: string;                     // UUID generado en cliente
  isin: ISIN;                     // Clave de unión con ISINLibraryEntry
  ticker?: string;                // Copia del ticker para display rápido
  name?: string;                  // Copia del nombre para display rápido
  status: AssetStatus;

  // Posición actual
  shares: number;                 // Número de participaciones en cartera
  averageBuyPrice: MonetaryAmount; // Precio medio ponderado de compra
  currentPrice?: MonetaryAmount;  // Último precio de mercado (actualizable via API)
  currency: CurrencyCode;
  lastPriceUpdate?: ISODateString;

  // Historial de movimientos (flujos para XIRR)
  movements: Movement[];

  // Metadatos de gestión
  broker?: string;                // Broker donde está custodiado
  account?: string;               // Número/nombre de cuenta
  tags?: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// 5. ROBO-ADVISORS — Motor de Importación y Gestión
// ---------------------------------------------------------------------------

/**
 * Sub-fondo dentro de un Robo-Advisor.
 * El peso se deriva automáticamente del neto invertido en sus movimientos.
 */
export interface SubFund {
  isin: ISIN;                     // Clave de unión con ISINLibraryEntry
  name?: string;                  // Copia del nombre para display
  derivedWeight: WeightPercent;   // Calculado: netInvested(isin) / totalNetInvested * 100
  netInvested: MonetaryAmount;    // Suma de movimientos netos para este ISIN
  currentValue?: MonetaryAmount;  // Valor actual si disponible
}

export type RoboAdvisorStatus = "active" | "paused" | "closed";

/**
 * Un Robo-Advisor o cartera gestionada externamente.
 * Los movimientos se importan y se asocian a sub-fondos con ISINs.
 * La composición real (subFunds) determina su aportación al X-Ray.
 */
export interface RoboAdvisor {
  id: string;                     // UUID generado en cliente
  name: string;                   // e.g. "Indexa Capital", "Finizens Cartera 5"
  provider?: string;              // Nombre del proveedor
  status: RoboAdvisorStatus;
  currency: CurrencyCode;

  // Composición derivada de movimientos
  subFunds: SubFund[];            // Calculados automáticamente al importar

  // Historial de movimientos brutos importados
  movements: Movement[];

  // Métricas agregadas (calculadas en runtime, guardadas como caché)
  totalInvested?: MonetaryAmount;
  currentValue?: MonetaryAmount;
  lastImport?: ISODateString;

  // Metadatos
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// 6. SNAPSHOT DE HISTORIAL — Para gráficos de evolución
// ---------------------------------------------------------------------------

/**
 * Punto de historial del valor total de la cartera.
 * Generado periódicamente para el gráfico de área del Dashboard.
 */
export interface PortfolioSnapshot {
  date: ISODateString;
  totalValue: MonetaryAmount;
  totalInvested: MonetaryAmount;
  cashBalance: MonetaryAmount;
  currency: CurrencyCode;
}

// ---------------------------------------------------------------------------
// 7. SETTINGS
// ---------------------------------------------------------------------------

export type ThemeMode = "dark" | "light" | "system";
export type RiskProfile = "conservative" | "moderate" | "aggressive" | "custom";

export interface NotificationSettings {
  priceAlerts: boolean;
  rebalancingReminders: boolean;
  importReminders: boolean;
}

export interface DisplaySettings {
  theme: ThemeMode;
  currency: CurrencyCode;           // Divisa base de visualización
  decimalPlaces: 0 | 2 | 4;
  showPercentages: boolean;
  compactNumbers: boolean;          // 1.200.000 → 1,2M
}

export interface XIRRSettings {
  /** Fecha de inicio para el cálculo de XIRR global */
  startDate?: ISODateString;
  /** Incluir dividendos como flujo positivo */
  includeDividends: boolean;
  /** Incluir comisiones como flujo negativo */
  includeFees: boolean;
}

export interface PortfolioSettings {
  display: DisplaySettings;
  notifications: NotificationSettings;
  xirr: XIRRSettings;
  riskProfile: RiskProfile;
  /** Pesos objetivo para rebalanceo [array debe sumar 100] */
  targetAllocation?: TargetAllocationItem[];
  benchmarkIndex?: string;          // e.g. "MSCI World", "S&P 500"
}

export interface TargetAllocationItem {
  label: string;                    // Nombre de la categoría objetivo
  dimension: "geography" | "sector" | "assetClass";
  weight: WeightPercent;
}

// ---------------------------------------------------------------------------
// 8. PORTFOLIO STATE — El contrato raíz de la columna JSONB
// ---------------------------------------------------------------------------

/**
 * Estado completo de la cartera serializado como JSONB en Supabase.
 * Esta es la única fuente de verdad. Todo CRUD opera sobre este objeto.
 *
 * Supabase profiles table:
 *   id          uuid  PRIMARY KEY REFERENCES auth.users
 *   portfolio_state  jsonb
 *   updated_at  timestamptz
 */
export interface PortfolioState {
  /** Versión del esquema — permite migraciones futuras */
  schemaVersion: number;

  /** Activos directos: fondos, ETFs, acciones */
  assets: Asset[];

  /** Carteras de Robo-Advisors importadas */
  roboAdvisors: RoboAdvisor[];

  /** Catálogo centralizado de ISINs con clasificación 3D */
  isinLibrary: ISINLibraryEntry[];

  /** Saldo en efectivo en la divisa base */
  cashBalance: MonetaryAmount;

  /** Historial de snapshots para gráficos de evolución */
  history: PortfolioSnapshot[];

  /** Configuración de la aplicación */
  settings: PortfolioSettings;

  /** Timestamps de gestión */
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// 9. MÉTRICAS CALCULADAS — No persisten, se computan en runtime
// ---------------------------------------------------------------------------

/**
 * Métricas de un activo individual calculadas en runtime.
 * No se persisten en JSONB — se derivan de Asset + ISINLibraryEntry.
 */
export interface AssetMetrics {
  assetId: string;
  isin: ISIN;
  currentValue: MonetaryAmount;
  totalCost: MonetaryAmount;
  unrealizedPnL: MonetaryAmount;
  unrealizedPnLPercent: number;
  realizedPnL: MonetaryAmount;
  xirr?: number;                  // En % anualizado
  weightInPortfolio: WeightPercent;
}

/**
 * Métricas de un Robo-Advisor calculadas en runtime.
 */
export interface RoboAdvisorMetrics {
  roboAdvisorId: string;
  totalInvested: MonetaryAmount;
  currentValue: MonetaryAmount;
  pnL: MonetaryAmount;
  pnLPercent: number;
  xirr?: number;
  weightInPortfolio: WeightPercent;
}

/**
 * Resumen global de la cartera calculado en runtime.
 * Alimenta las SummaryCards del Dashboard.
 */
export interface PortfolioSummary {
  totalValue: MonetaryAmount;
  totalInvested: MonetaryAmount;
  cashBalance: MonetaryAmount;
  totalPnL: MonetaryAmount;
  totalPnLPercent: number;
  xirr?: number;                  // XIRR global anualizado
  currency: CurrencyCode;
  lastUpdated: ISODateString;
  assetCount: number;
  roboAdvisorCount: number;
}

// ---------------------------------------------------------------------------
// 10. X-RAY — Proyección analítica de la cartera real
// ---------------------------------------------------------------------------

/**
 * Una línea del X-Ray: cuánto peso real tiene una categoría
 * (región, sector o asset class) en la cartera global.
 */
export interface XRayLine {
  label: string;                  // e.g. "North America", "Technology"
  weight: WeightPercent;          // Peso real en el portfolio global
  value: MonetaryAmount;          // Valor monetario estimado
  coverage: WeightPercent;        // % del portfolio con ISIN en librería (0–100)
}

/**
 * Resultado completo del X-Ray Dashboard.
 * Se calcula recorriendo assets + roboAdvisors → buscando ISINs en isinLibrary.
 */
export interface XRayResult {
  geography: XRayLine[];
  sectors: XRayLine[];
  assetClasses: XRayLine[];
  /** % del valor total cubierto por la librería ISIN (rest = "unknown") */
  overallCoverage: WeightPercent;
  uncoveredAssets: ISIN[];        // ISINs sin entrada en la librería
  calculatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// 11. IMPORTACIÓN DE MOVIMIENTOS — Flujo de conciliación
// ---------------------------------------------------------------------------

export type ImportFormat =
  | "csv_generic"
  | "indexa_capital"
  | "finizens"
  | "myinvestor"
  | "degiro"
  | "interactive_brokers"
  | "manual";

/**
 * Fila parseada de un fichero de movimientos antes de conciliar.
 */
export interface RawMovementRow {
  date: ISODateString;
  description: string;
  amount: MonetaryAmount;
  isin?: ISIN;                    // Puede venir o no del fichero
  shares?: number;
  pricePerShare?: MonetaryAmount;
  rawData: Record<string, unknown>; // Fila original sin procesar
}

/**
 * Resultado del proceso de conciliación de un movimiento importado.
 * La UI muestra este objeto en el modal de conciliación.
 */
export interface ConciliationItem {
  rawRow: RawMovementRow;
  suggestedIsin?: ISIN;           // ISIN detectado automáticamente
  matchedAssetId?: string;        // Asset existente que podría coincidir
  matchedRoboAdvisorId?: string;  // Robo existente que podría coincidir
  action: ConciliationAction;
  isNew: boolean;                 // true = crear activo/robo nuevo
  confidence: number;             // 0–1: confianza del match automático
}

export type ConciliationAction =
  | "match_asset"       // Asociar a Asset existente
  | "match_robo"        // Asociar a RoboAdvisor existente
  | "create_asset"      // Crear nuevo Asset
  | "create_robo"       // Crear nuevo RoboAdvisor
  | "skip";             // Ignorar este movimiento

// ---------------------------------------------------------------------------
// 12. SUPABASE — Tipos de la capa de datos
// ---------------------------------------------------------------------------

/**
 * Fila de la tabla `profiles` en Supabase.
 * El portfolio completo vive serializado en portfolio_state.
 */
export interface ProfileRow {
  id: string;                     // UUID = auth.users.id
  portfolio_state: PortfolioState | null;
  updated_at: string;             // timestamptz como string ISO
}

/**
 * Payload para upsert de la tabla profiles.
 */
export interface ProfileUpsertPayload {
  id: string;
  portfolio_state: string;        // JSON.stringify(PortfolioState)
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 13. ESTADO DEL HOOK usePortfolio
// ---------------------------------------------------------------------------

export interface UsePortfolioReturn {
  // Estado
  state: PortfolioState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Gestión de Assets
  addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt" | "movements">) => Promise<void>;
  updateAsset: (id: string, patch: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  bulkUpdatePrices: (updates: { isin: ISIN; price: MonetaryAmount }[]) => Promise<void>;

  // Gestión de Movimientos
  addMovement: (assetId: string, movement: Omit<Movement, "id">) => Promise<void>;
  deleteMovement: (assetId: string, movementId: string) => Promise<void>;

  // Gestión de Robo-Advisors
  addRoboAdvisor: (robo: Omit<RoboAdvisor, "id" | "createdAt" | "updatedAt" | "subFunds">) => Promise<void>;
  updateRoboAdvisor: (id: string, patch: Partial<RoboAdvisor>) => Promise<void>;
  deleteRoboAdvisor: (id: string) => Promise<void>;
  importRoboMovements: (roboId: string, rows: RawMovementRow[]) => Promise<ConciliationItem[]>;
  confirmImport: (roboId: string, items: ConciliationItem[]) => Promise<void>;

  // Librería ISIN
  addISINEntry: (entry: ISINLibraryEntry) => Promise<void>;
  updateISINEntry: (isin: ISIN, patch: Partial<ISINLibraryEntry>) => Promise<void>;
  deleteISINEntry: (isin: ISIN) => Promise<void>;

  // Configuración
  updateSettings: (patch: Partial<PortfolioSettings>) => Promise<void>;
  updateCashBalance: (amount: MonetaryAmount) => Promise<void>;

  // Métricas (sincrónicas, derivadas del estado)
  getSummary: () => PortfolioSummary | null;
  getAssetMetrics: (assetId: string) => AssetMetrics | null;
  getRoboMetrics: (roboId: string) => RoboAdvisorMetrics | null;
  getXRay: () => XRayResult | null;

  // Utilidades
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// 14. CONSTANTES DEL ESQUEMA
// ---------------------------------------------------------------------------

export const PORTFOLIO_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: PortfolioSettings = {
  display: {
    theme: "dark",
    currency: "EUR",
    decimalPlaces: 2,
    showPercentages: true,
    compactNumbers: true,
  },
  notifications: {
    priceAlerts: true,
    rebalancingReminders: false,
    importReminders: true,
  },
  xirr: {
    includeDividends: true,
    includeFees: true,
  },
  riskProfile: "moderate",
};

export const DEFAULT_PORTFOLIO_STATE: PortfolioState = {
  schemaVersion: PORTFOLIO_SCHEMA_VERSION,
  assets: [],
  roboAdvisors: [],
  isinLibrary: [],
  cashBalance: 0,
  history: [],
  settings: DEFAULT_SETTINGS,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
