"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { getRecord, listRecords } from "@/features/records/service";
import { listUsers } from "@/features/users/service";
import {
  can,
  canAccessUserAdmin,
  type Customer,
  type ManagedUser,
  type Reservation,
  type Vehicle,
} from "@/lib/api/contracts";
import { getReservation } from "./service";

export function useLiveEntityLookup({
  customerIds = [],
  vehicleIds = [],
  reservationIds = [],
  driverIds = [],
}: {
  customerIds?: readonly (number | null | undefined)[];
  vehicleIds?: readonly (number | null | undefined)[];
  reservationIds?: readonly (number | null | undefined)[];
  driverIds?: readonly (number | null | undefined)[];
} = {}) {
  const { user } = useSession();
  const scope = useLiveContext();

  const canViewCustomers = !!user && can(user, "customers.view");
  const canViewVehicles = !!user && can(user, "vehicles.view");
  const canViewReservations = !!user && can(user, "reservations.view");
  const canViewDrivers = !!user && canAccessUserAdmin(user, scope.companyId);

  const uniqueDriverIds = canViewDrivers
    ? [
        ...new Set(
          driverIds.filter(
            (id): id is number => typeof id === "number" && id > 0,
          ),
        ),
      ]
    : [];

  const driversList = useQuery({
    queryKey: [...scope.key, "drivers", "lookup"],
    queryFn: ({ signal }) =>
      listUsers(
        {
          companyId: scope.companyId,
          branch: "all",
          q: "",
          role: "driver",
          isActive: "",
          page: 1,
        },
        signal,
      ),
    enabled: canViewDrivers && uniqueDriverIds.length > 0,
    staleTime: 30_000,
  });

  const driverMap = new Map<number, ManagedUser>();
  for (const item of driversList.data?.items ?? []) {
    driverMap.set(item.id, item);
  }

  const customersList = useQuery({
    queryKey: [...scope.key, "customers", "lookup"],
    queryFn: ({ signal }) =>
      listRecords(
        "customers",
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: canViewCustomers,
    staleTime: 30_000,
  });

  const vehiclesList = useQuery({
    queryKey: [...scope.key, "vehicles", "lookup"],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: canViewVehicles,
    staleTime: 30_000,
  });

  const customerMap = new Map<number, Customer>();
  for (const item of (customersList.data?.items ?? []) as Customer[]) {
    customerMap.set(item.id, item);
  }
  const vehicleMap = new Map<number, Vehicle>();
  for (const item of (vehiclesList.data?.items ?? []) as Vehicle[]) {
    vehicleMap.set(item.id, item);
  }

  // Fallback single-record fetches for any reservation IDs whose customer_id wasn't returned on Rental
  const uniqueReservationIds = canViewReservations
    ? [
        ...new Set(
          reservationIds.filter(
            (id): id is number => typeof id === "number" && id > 0,
          ),
        ),
      ].slice(0, 25)
    : [];

  const reservationQueries = useQueries({
    queries: uniqueReservationIds.map((resId) => ({
      queryKey: [...scope.key, "reservations", "lookup-item", resId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getReservation(String(resId), scope.companyId, scope.branch, signal),
      staleTime: 30_000,
    })),
  });

  const reservationMap = new Map<number, Reservation>();
  for (const q of reservationQueries) {
    if (q.data) reservationMap.set(q.data.id, q.data);
  }

  const missingCustomerIds = canViewCustomers
    ? [
        ...new Set(
          [
            ...customerIds,
            ...[...reservationMap.values()].map((r) => r.customer_id),
          ].filter(
            (id): id is number =>
              typeof id === "number" && id > 0 && !customerMap.has(id),
          ),
        ),
      ].slice(0, 25)
    : [];

  const missingVehicleIds = canViewVehicles
    ? [
        ...new Set(
          vehicleIds.filter(
            (id): id is number =>
              typeof id === "number" && id > 0 && !vehicleMap.has(id),
          ),
        ),
      ].slice(0, 25)
    : [];

  const extraCustomerQueries = useQueries({
    queries: missingCustomerIds.map((custId) => ({
      queryKey: [...scope.key, "customers", "lookup-item", custId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getRecord(
          "customers",
          String(custId),
          scope.companyId,
          scope.branch,
          signal,
        ),
      staleTime: 30_000,
    })),
  });

  const extraVehicleQueries = useQueries({
    queries: missingVehicleIds.map((vehId) => ({
      queryKey: [...scope.key, "vehicles", "lookup-item", vehId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getRecord(
          "vehicles",
          String(vehId),
          scope.companyId,
          scope.branch,
          signal,
        ),
      staleTime: 30_000,
    })),
  });

  for (const q of extraCustomerQueries) {
    if (q.data && "name" in q.data) customerMap.set(q.data.id, q.data);
  }
  for (const q of extraVehicleQueries) {
    if (q.data && "registration" in q.data) vehicleMap.set(q.data.id, q.data);
  }

  return {
    customerId(item: {
      customer_id?: number | null;
      reservation_id?: number;
    }): number | null {
      return (
        item.customer_id ??
        (item.reservation_id
          ? (reservationMap.get(item.reservation_id)?.customer_id ?? null)
          : null)
      );
    },

    customerHref(item: {
      customer_id?: number | null;
      reservation_id?: number;
    }): string | null {
      if (!canViewCustomers) return null;
      const id =
        item.customer_id ??
        (item.reservation_id
          ? (reservationMap.get(item.reservation_id)?.customer_id ?? null)
          : null);
      if (!id) return null;
      return `/companies/${scope.companyId}/customers/${id}?branch=${encodeURIComponent(scope.branch)}`;
    },

    vehicleHref(vehicleId: number | null | undefined): string | null {
      if (!canViewVehicles || !vehicleId) return null;
      return `/companies/${scope.companyId}/vehicles/${vehicleId}?branch=${encodeURIComponent(scope.branch)}`;
    },

    driverDisplay(item: {
      driver_user_id?: number | null;
      driver_name?: string | null;
    }): { name: string; href: string | null } {
      if (!item.driver_user_id && !item.driver_name) {
        return { name: "Unassigned", href: null };
      }
      const found = item.driver_user_id
        ? driverMap.get(item.driver_user_id)
        : undefined;
      const name =
        item.driver_name ||
        found?.name ||
        (item.driver_user_id ? `Driver #${item.driver_user_id}` : "Unassigned");
      if (!canViewDrivers) {
        return { name, href: null };
      }
      const params = new URLSearchParams({
        branch: scope.branch,
        role: "driver",
      });
      const q = (found?.email || item.driver_name || found?.name || "").trim();
      if (q) params.set("q", q);
      return {
        name,
        href: `/companies/${scope.companyId}/users?${params.toString()}`,
      };
    },

    customerName(item: {
      customer_id?: number | null;
      customer_name?: string | null;
      reservation_id?: number;
    }): string {
      if (item.customer_name) return item.customer_name;
      const resolvedCustomerId =
        item.customer_id ??
        (item.reservation_id
          ? reservationMap.get(item.reservation_id)?.customer_id
          : undefined);
      if (resolvedCustomerId) {
        const found = customerMap.get(resolvedCustomerId);
        if (found) return found.name;
        return `Customer #${resolvedCustomerId}`;
      }
      return item.reservation_id
        ? `Reservation #${item.reservation_id}`
        : "Customer";
    },

    vehicleDisplay(item: {
      vehicle_id: number;
      vehicle_registration?: string | null;
      vehicle_label?: string | null;
    }): { registration: string; makeModel: string; full: string } {
      const found = vehicleMap.get(item.vehicle_id);
      const registration =
        item.vehicle_registration ||
        found?.registration ||
        `Vehicle #${item.vehicle_id}`;
      const makeModel =
        item.vehicle_label ||
        (found ? `${found.make} ${found.model}` : "");
      const full = makeModel ? `${registration} · ${makeModel}` : registration;
      return { registration, makeModel, full };
    },

    reservationWindow(item: {
      reservation_id?: number;
      starts_at?: string | null;
      ends_at?: string | null;
    }): { starts_at: string | null; ends_at: string | null } {
      const linked = item.reservation_id
        ? reservationMap.get(item.reservation_id)
        : undefined;
      return {
        starts_at: item.starts_at ?? linked?.starts_at ?? null,
        ends_at: item.ends_at ?? linked?.ends_at ?? null,
      };
    },
  };
}
