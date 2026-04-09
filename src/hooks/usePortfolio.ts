// =============================================================================
// usePortfolio.ts — Hook central de PortfolioPro
//
// Arquitectura:
//   - Todo el estado vive en Supabase: profiles.portfolio_state (JSONB)
//   - Mutaciones optimistas: estado local primero → upsert → rollback si falla
//   - Immer para mutaciones inmutables sin boilerplate
//   - Un único punto de persistencia: persistState()
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { produce } from "immer";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { supabase } from "../lib/supabase";
import {
  buildConciliationItems,
  computeXRay,
  createSnapshot,
  getAssetMetrics,
  getPortfolioSummary,
  getRoboMetrics,
  recalculateSubFunds,
} from "../lib/calculations";

import {
  DEFAULT_PORTFOLIO_STATE,
  PORTFOLIO_SCHEMA_VERSION,
  type Asset,
  type AssetMetrics,
  type ConciliationItem,
  type ISIN,
  type ISINLibraryEntry,
  type MonetaryAmount,
  type Movement,
  type PortfolioSettings,
  type PortfolioState,
  type PortfolioSummary,
  type RawMovementRow,
  type RoboAdvisor,
  type RoboAdvisorMetrics,
  type UsePortfolioReturn,
  type XRayResult,
} from "../types/portfolio";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Migración de esquema: si schemaVersion < actual, aplica transformaciones.
 * Actualmente solo inicializa campos faltantes.
 */
function migrateState(raw: unknown): PortfolioState {
  const state = raw as Partial<PortfolioState>;

  // Garantizar campos obligatorios introducidos en versiones posteriores
  return {
    ...DEFAULT_PORTFOLIO_STATE,
    ...state,
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    settings: {
      ...DEFAULT_PORTFOLIO_STATE.settings,
      ...state.settings,
      display: {
        ...DEFAULT_PORTFOLIO_STATE.settings.display,
        ...state.settings?.display,
      },
      xirr: {
        ...DEFAULT_PORTFOLIO_STATE.settings.xirr,
        ...state.settings?.xirr,
      },
      notifications: {
        ...DEFAULT_PORTFOLIO_STATE.settings.notifications,
        ...state.settings?.notifications,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function usePortfolio(): UsePortfolioReturn {
  const [state, setState] = useState<PortfolioState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referencia al userId para no depender del closure
  const userIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------------------------

  const loadState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Usuario no autenticado");
      userIdRef.current = user.id;

      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("portfolio_state")
        .eq("id", user.id)
        .single();

      if (dbError && dbError.code !== "PGRST116") {
        // PGRST116 = row not found → primer acceso, inicializar
        throw dbError;
      }

      if (data?.portfolio_state) {
        setState(migrateState(data.portfolio_state));
      } else {
        // Primera vez: crear perfil con estado vacío
        const initial = { ...DEFAULT_PORTFOLIO_STATE, createdAt: now(), updatedAt: now() };
        await supabase.from("profiles").upsert({
          id: user.id,
          portfolio_state: JSON.stringify(initial),
          updated_at: now(),
        });
        setState(initial);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error cargando el portfolio";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") loadState();
      if (event === "SIGNED_OUT") {
        setState(null);
        userIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [loadState]);

  // ---------------------------------------------------------------------------
  // PERSISTENCIA — núcleo del hook
  // Recibe el nuevo estado, actualiza React state y persiste en Supabase.
  // Maneja rollback si el upsert falla.
  // ---------------------------------------------------------------------------

  const persistState = useCallback(
    async (
      nextState: PortfolioState,
      prevState: PortfolioState | null
    ): Promise<boolean> => {
      if (!userIdRef.current) {
        toast.error("Sin sesión activa");
        return false;
      }

      const stateWithTimestamp = { ...nextState, updatedAt: now() };

      // Actualización optimista
      setState(stateWithTimestamp);
      setIsSaving(true);

      try {
        const { error: upsertError } = await supabase.from("profiles").upsert({
          id: userIdRef.current,
          portfolio_state: JSON.stringify(stateWithTimestamp),
          updated_at: now(),
        });

        if (upsertError) throw upsertError;
        return true;
      } catch (err) {
        // Rollback al estado previo
        setState(prevState);
        const msg = err instanceof Error ? err.message : "Error guardando cambios";
        setError(msg);
        toast.error(`Error al guardar: ${msg}`);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  /**
   * Helper para mutaciones con Immer.
   * Recibe un callback que muta el draft y persiste el resultado.
   */
  const mutate = useCallback(
    async (
      recipe: (draft: PortfolioState) => void,
      successMessage?: string
    ): Promise<boolean> => {
      if (!state) return false;

      const nextState = produce(state, recipe);
      const ok = await persistState(nextState, state);
      if (ok && successMessage) toast.success(successMessage);
      return ok;
    },
    [state, persistState]
  );

  // ---------------------------------------------------------------------------
  // ASSETS — CRUD
  // ---------------------------------------------------------------------------

  const addAsset = useCallback(
    async (assetData: Omit<Asset, "id" | "createdAt" | "updatedAt" | "movements">) => {
      await mutate((draft) => {
        draft.assets.push({
          ...assetData,
          id: uuidv4(),
          movements: [],
          createdAt: now(),
          updatedAt: today(),
        });
      }, "Activo añadido correctamente");
    },
    [mutate]
  );

  const updateAsset = useCallback(
    async (id: string, patch: Partial<Asset>) => {
      await mutate((draft) => {
        const idx = draft.assets.findIndex((a) => a.id === id);
        if (idx === -1) return;
        draft.assets[idx] = { ...draft.assets[idx], ...patch, updatedAt: now() };
      }, "Activo actualizado");
    },
    [mutate]
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      await mutate((draft) => {
        draft.assets = draft.assets.filter((a) => a.id !== id);
      }, "Activo eliminado");
    },
    [mutate]
  );

  /**
   * Actualización masiva de precios via API externa.
   * Recibe un array de { isin, price } y actualiza todos los assets coincidentes.
   */
  const bulkUpdatePrices = useCallback(
    async (updates: { isin: ISIN; price: MonetaryAmount }[]) => {
      const priceMap = new Map(updates.map((u) => [u.isin, u.price]));

      await mutate((draft) => {
        for (const asset of draft.assets) {
          const newPrice = priceMap.get(asset.isin);
          if (newPrice !== undefined) {
            asset.currentPrice = newPrice;
            asset.lastPriceUpdate = today();
            asset.updatedAt = now();
          }
        }
      }, `Precios actualizados (${updates.length} activos)`);
    },
    [mutate]
  );

  // ---------------------------------------------------------------------------
  // MOVIMIENTOS
  // ---------------------------------------------------------------------------

  const addMovement = useCallback(
    async (assetId: string, movement: Omit<Movement, "id">) => {
      await mutate((draft) => {
        const asset = draft.assets.find((a) => a.id === assetId);
        if (!asset) return;

        asset.movements.push({ ...movement, id: uuidv4() });
        asset.updatedAt = now();

        // Recalcular precio medio ponderado si es compra
        if (movement.type === "buy" && movement.shares && movement.pricePerShare) {
          const totalShares = asset.shares + movement.shares;
          asset.averageBuyPrice =
            (asset.shares * asset.averageBuyPrice + movement.shares * movement.pricePerShare) /
            totalShares;
          asset.shares = totalShares;
        }

        // Reducir shares si es venta
        if (movement.type === "sell" && movement.shares) {
          asset.shares = Math.max(0, asset.shares - movement.shares);
        }
      }, "Movimiento añadido");
    },
    [mutate]
  );

  const deleteMovement = useCallback(
    async (assetId: string, movementId: string) => {
      await mutate((draft) => {
        const asset = draft.assets.find((a) => a.id === assetId);
        if (!asset) return;
        asset.movements = asset.movements.filter((m) => m.id !== movementId);
        asset.updatedAt = now();
      }, "Movimiento eliminado");
    },
    [mutate]
  );

  // ---------------------------------------------------------------------------
  // ROBO-ADVISORS
  // ---------------------------------------------------------------------------

  const addRoboAdvisor = useCallback(
    async (roboData: Omit<RoboAdvisor, "id" | "createdAt" | "updatedAt" | "subFunds">) => {
      await mutate((draft) => {
        draft.roboAdvisors.push({
          ...roboData,
          id: uuidv4(),
          subFunds: [],
          createdAt: now(),
          updatedAt: now(),
        });
      }, "Robo-Advisor añadido");
    },
    [mutate]
  );

  const updateRoboAdvisor = useCallback(
    async (id: string, patch: Partial<RoboAdvisor>) => {
      await mutate((draft) => {
        const idx = draft.roboAdvisors.findIndex((r) => r.id === id);
        if (idx === -1) return;
        draft.roboAdvisors[idx] = {
          ...draft.roboAdvisors[idx],
          ...patch,
          updatedAt: now(),
        };
      }, "Robo-Advisor actualizado");
    },
    [mutate]
  );

  const deleteRoboAdvisor = useCallback(
    async (id: string) => {
      await mutate((draft) => {
        draft.roboAdvisors = draft.roboAdvisors.filter((r) => r.id !== id);
      }, "Robo-Advisor eliminado");
    },
    [mutate]
  );

  /**
   * Paso 1 de la importación: parsea los movimientos brutos y genera
   * sugerencias de conciliación. No persiste nada todavía.
   */
  const importRoboMovements = useCallback(
    async (
      _roboId: string,
      rows: RawMovementRow[]
    ): Promise<ConciliationItem[]> => {
      if (!state) return [];
      return buildConciliationItems(rows, state);
    },
    [state]
  );

  /**
   * Paso 2 de la importación: el usuario confirma las conciliaciones.
   * Persiste los movimientos en los activos/robos correspondientes.
   * Recalcula automáticamente los subFunds del Robo.
   */
  const confirmImport = useCallback(
    async (roboId: string, items: ConciliationItem[]) => {
      await mutate((draft) => {
        const robo = draft.roboAdvisors.find((r) => r.id === roboId);
        if (!robo) return;

        const libraryMap = new Map(draft.isinLibrary.map((e) => [e.isin, e]));

        for (const item of items) {
          if (item.action === "skip") continue;

          const baseMovement: Movement = {
            id: uuidv4(),
            date: item.rawRow.date,
            type: "buy",
            amount: item.rawRow.amount,
            currency: robo.currency,
            shares: item.rawRow.shares,
            pricePerShare: item.rawRow.pricePerShare,
            roboAdvisorId: roboId,
            subFundIsin: item.suggestedIsin,
          };

          if (item.action === "match_asset" && item.matchedAssetId) {
            const asset = draft.assets.find((a) => a.id === item.matchedAssetId);
            if (asset) asset.movements.push(baseMovement);
          } else if (item.action === "match_robo") {
            robo.movements.push(baseMovement);
          } else if (item.action === "create_asset" && item.suggestedIsin) {
            const libEntry = libraryMap.get(item.suggestedIsin);
            draft.assets.push({
              id: uuidv4(),
              isin: item.suggestedIsin,
              ticker: libEntry?.ticker,
              name: libEntry?.name,
              status: "active",
              shares: item.rawRow.shares ?? 0,
              averageBuyPrice: item.rawRow.pricePerShare ?? 0,
              currency: robo.currency,
              movements: [baseMovement],
              createdAt: now(),
              updatedAt: now(),
            });
          } else if (item.action === "create_robo") {
            robo.movements.push(baseMovement);
          }
        }

        // Recalcular subFunds automáticamente tras la importación
        robo.subFunds = recalculateSubFunds(robo.movements, libraryMap);
        robo.lastImport = today();
        robo.updatedAt = now();
      }, `Importación completada: ${items.filter((i) => i.action !== "skip").length} movimientos`);
    },
    [mutate]
  );

  // ---------------------------------------------------------------------------
  // LIBRERÍA ISIN
  // ---------------------------------------------------------------------------

  const addISINEntry = useCallback(
    async (entry: ISINLibraryEntry) => {
      await mutate((draft) => {
        const exists = draft.isinLibrary.some((e) => e.isin === entry.isin);
        if (exists) {
          // Actualizar si ya existe
          const idx = draft.isinLibrary.findIndex((e) => e.isin === entry.isin);
          draft.isinLibrary[idx] = { ...entry, lastUpdated: today() };
        } else {
          draft.isinLibrary.push({ ...entry, lastUpdated: today() });
        }
      }, `ISIN ${entry.isin} añadido a la librería`);
    },
    [mutate]
  );

  const updateISINEntry = useCallback(
    async (isin: ISIN, patch: Partial<ISINLibraryEntry>) => {
      await mutate((draft) => {
        const idx = draft.isinLibrary.findIndex((e) => e.isin === isin);
        if (idx === -1) return;
        draft.isinLibrary[idx] = {
          ...draft.isinLibrary[idx],
          ...patch,
          lastUpdated: today(),
        };
      }, `ISIN ${isin} actualizado`);
    },
    [mutate]
  );

  const deleteISINEntry = useCallback(
    async (isin: ISIN) => {
      await mutate((draft) => {
        draft.isinLibrary = draft.isinLibrary.filter((e) => e.isin !== isin);
      }, `ISIN ${isin} eliminado de la librería`);
    },
    [mutate]
  );

  // ---------------------------------------------------------------------------
  // CONFIGURACIÓN Y CASH
  // ---------------------------------------------------------------------------

  const updateSettings = useCallback(
    async (patch: Partial<PortfolioSettings>) => {
      await mutate((draft) => {
        draft.settings = { ...draft.settings, ...patch };
      }, "Configuración guardada");
    },
    [mutate]
  );

  const updateCashBalance = useCallback(
    async (amount: MonetaryAmount) => {
      await mutate((draft) => {
        draft.cashBalance = amount;
      }, "Saldo en efectivo actualizado");
    },
    [mutate]
  );

  // ---------------------------------------------------------------------------
  // MÉTRICAS SINCRÓNICAS — derivadas del estado, no persisten
  // ---------------------------------------------------------------------------

  const getSummary = useCallback((): PortfolioSummary | null => {
    if (!state) return null;
    return getPortfolioSummary(state);
  }, [state]);

  const getAssetMetricsById = useCallback(
    (assetId: string): AssetMetrics | null => {
      if (!state) return null;
      const asset = state.assets.find((a) => a.id === assetId);
      if (!asset) return null;
      const summary = getPortfolioSummary(state);
      return getAssetMetrics(asset, summary.totalValue, state.settings.xirr);
    },
    [state]
  );

  const getRoboMetricsById = useCallback(
    (roboId: string): RoboAdvisorMetrics | null => {
      if (!state) return null;
      const robo = state.roboAdvisors.find((r) => r.id === roboId);
      if (!robo) return null;
      const summary = getPortfolioSummary(state);
      return getRoboMetrics(robo, summary.totalValue);
    },
    [state]
  );

  const getXRay = useCallback((): XRayResult | null => {
    if (!state) return null;
    return computeXRay(state);
  }, [state]);

  // ---------------------------------------------------------------------------
  // SNAPSHOT — llamar periódicamente o al cerrar sesión
  // ---------------------------------------------------------------------------

  const saveSnapshot = useCallback(async () => {
    if (!state) return;
    await mutate((draft) => {
      const snap = createSnapshot(draft);
      const todayStr = today();
      // Reemplazar snapshot del día si ya existe
      const idx = draft.history.findIndex((h) => h.date === todayStr);
      if (idx >= 0) {
        draft.history[idx] = snap;
      } else {
        draft.history.push(snap);
        // Mantener máximo 730 días (2 años)
        if (draft.history.length > 730) draft.history.shift();
      }
    });
  }, [state, mutate]);

  // Guardar snapshot automáticamente cada 12 horas en sesión activa
  useEffect(() => {
    if (!state) return;
    saveSnapshot();
    const interval = setInterval(saveSnapshot, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state?.assets.length, state?.roboAdvisors.length]); // eslint-disable-line

  // ---------------------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------------------

  return {
    state,
    isLoading,
    isSaving,
    error,

    // Assets
    addAsset,
    updateAsset,
    deleteAsset,
    bulkUpdatePrices,

    // Movimientos
    addMovement,
    deleteMovement,

    // Robo-Advisors
    addRoboAdvisor,
    updateRoboAdvisor,
    deleteRoboAdvisor,
    importRoboMovements,
    confirmImport,

    // Librería ISIN
    addISINEntry,
    updateISINEntry,
    deleteISINEntry,

    // Configuración
    updateSettings,
    updateCashBalance,

    // Métricas (sync)
    getSummary,
    getAssetMetrics: getAssetMetricsById,
    getRoboMetrics: getRoboMetricsById,
    getXRay,

    // Utilidades
    refresh: loadState,
  };
}
