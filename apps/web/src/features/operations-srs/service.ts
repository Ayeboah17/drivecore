import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  fuelTransactionSchema,
  maintenanceScheduleSchema,
  normalizePage,
  pageSchema,
  rateCardSchema,
  vehicleComponentSchema,
  vehicleInspectionSchema,
  type FuelTransaction,
  type MaintenanceSchedule,
  type RateCard,
  type VehicleComponent,
  type VehicleInspection,
} from "@/lib/api/contracts";
import { getCompanySettings } from "@/features/quotations/service";
import {
  DEFAULT_UNIT_PREFERENCES,
  type UnitPreferences,
} from "@/lib/units";

export function useUnitPreferences(companyId?: string): UnitPreferences {
  const q = useQuery({
    queryKey: ["live", "company-settings", companyId ?? "none"],
    queryFn: ({ signal }) => getCompanySettings(companyId!, signal),
    enabled: !!companyId,
    staleTime: 60_000,
    retry: false,
  });
  if (!q.data) return DEFAULT_UNIT_PREFERENCES;
  return {
    distance: q.data.distance_unit ?? "km",
    volume: q.data.volume_unit ?? "l",
    fuelEfficiency: q.data.fuel_efficiency_unit ?? "l_per_100km",
    weight: q.data.weight_unit ?? "kg",
  };
}

export async function listRateCards(
  params: { companyId: string; branchId?: string; q?: string; page?: number },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: RateCard[]; total: number }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  try {
    const payload = await read(
      `api/v1/rate-cards?${sp.toString()}`,
      pageSchema(rateCardSchema),
      signal,
    );
    const norm = normalizePage(payload);
    return { supported: true, items: norm.items, total: norm.total };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [], total: 0 };
    }
    throw err;
  }
}

export async function createRateCard(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RateCard> {
  const payload = await request("api/v1/rate-cards", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: rateCardSchema }).parse(payload).data;
}

export async function listInspections(
  params: { companyId: string; rentalId?: number; vehicleId?: number },
  signal?: AbortSignal,
): Promise<VehicleInspection[]> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.rentalId) sp.set("rental_id", String(params.rentalId));
  if (params.vehicleId) sp.set("vehicle_id", String(params.vehicleId));
  try {
    const payload = await read(
      `api/v1/inspections?${sp.toString()}`,
      pageSchema(vehicleInspectionSchema),
      signal,
    );
    return payload.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

export async function listMaintenanceSchedules(
  params: {
    companyId: string;
    branchId?: string;
    vehicleId?: number;
    status?: string;
    q?: string;
  },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: MaintenanceSchedule[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.vehicleId) sp.set("vehicle_id", String(params.vehicleId));
  if (params.status) sp.set("status", params.status);
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  try {
    const payload = await read(
      `api/v1/maintenance-schedules?${sp.toString()}`,
      pageSchema(maintenanceScheduleSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createMaintenanceSchedule(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<MaintenanceSchedule> {
  const payload = await request("api/v1/maintenance-schedules", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: maintenanceScheduleSchema }).parse(payload).data;
}

export async function listVehicleComponents(
  params: {
    companyId: string;
    branchId?: string;
    vehicleId?: number;
    componentType?: string;
    status?: string;
    q?: string;
  },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: VehicleComponent[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.vehicleId) sp.set("vehicle_id", String(params.vehicleId));
  if (params.componentType) sp.set("component_type", params.componentType);
  if (params.status) sp.set("status", params.status);
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  try {
    const payload = await read(
      `api/v1/vehicle-components?${sp.toString()}`,
      pageSchema(vehicleComponentSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createVehicleComponent(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<VehicleComponent> {
  const payload = await request("api/v1/vehicle-components", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: vehicleComponentSchema }).parse(payload).data;
}

export async function updateVehicleComponent(
  id: number,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<VehicleComponent> {
  const payload = await request(`api/v1/vehicle-components/${id}`, {
    method: "PATCH",
    body,
    signal,
  });
  return z.object({ data: vehicleComponentSchema }).parse(payload).data;
}

export async function listFuelTransactions(
  params: {
    companyId: string;
    branchId?: string;
    vehicleId?: number;
    abnormalOnly?: boolean;
    from?: string;
    to?: string;
    q?: string;
  },
  signal?: AbortSignal,
): Promise<{ supported: boolean; items: FuelTransaction[] }> {
  const sp = new URLSearchParams({ company_id: params.companyId });
  if (params.branchId) sp.set("branch_id", params.branchId);
  if (params.vehicleId) sp.set("vehicle_id", String(params.vehicleId));
  if (params.abnormalOnly) sp.set("abnormal_only", "1");
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 100));
  try {
    const payload = await read(
      `api/v1/fuel-transactions?${sp.toString()}`,
      pageSchema(fuelTransactionSchema),
      signal,
    );
    return { supported: true, items: payload.data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { supported: false, items: [] };
    }
    throw err;
  }
}

export async function createFuelTransaction(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<FuelTransaction> {
  const payload = await request("api/v1/fuel-transactions", {
    method: "POST",
    body,
    signal,
  });
  return z.object({ data: fuelTransactionSchema }).parse(payload).data;
}
