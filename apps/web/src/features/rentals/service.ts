import { z } from "zod";
import { ApiError, read, request } from "@/lib/api/client";
import {
  normalizePage,
  pageSchema,
  rentalSchema,
  reservationSchema,
  type Rental,
  type Reservation,
} from "@/lib/api/contracts";

function assertScope(
  record: { id: number; company_id: number; branch_id: number },
  companyId: string,
  branch: string,
  expectedId?: string,
) {
  if (
    String(record.company_id) !== companyId ||
    (branch !== "all" && String(record.branch_id) !== branch) ||
    (expectedId !== undefined && String(record.id) !== expectedId)
  ) {
    throw new ApiError(
      404,
      "This record is unavailable in the selected context.",
    );
  }
}

export async function listReservations(
  params: {
    companyId: string;
    branch: string;
    status?: string;
    q?: string;
    page?: number;
    sort?: string;
    dir?: string;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  if (params.status) query.set("status", params.status);
  const trimmedQ = (params.q ?? "").trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir === "asc" || params.dir === "desc") {
      query.set("dir", params.dir);
    }
  }

  const payload = await read(
    `api/v1/reservations?${query.toString()}`,
    pageSchema(reservationSchema),
    signal,
  );
  const normalized = normalizePage(payload);
  // Pre-PR #9 backends may omit branch_id/status filtering on reservations index;
  // filter client-side instead of failing the entire table with 404.
  const scopedItems = normalized.items.filter((item) => {
    if (String(item.company_id) !== params.companyId) return false;
    if (params.branch !== "all" && String(item.branch_id) !== params.branch)
      return false;
    if (params.status && item.status !== params.status) return false;
    return true;
  });
  const total =
    scopedItems.length !== normalized.items.length && normalized.lastPage === 1
      ? scopedItems.length
      : normalized.total;
  return {
    ...normalized,
    items: scopedItems,
    total,
  } as {
    items: Reservation[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

export async function getReservation(
  id: string,
  companyId: string,
  branch: string,
  signal: AbortSignal,
): Promise<Reservation> {
  const payload = await read(
    `api/v1/reservations/${id}`,
    z.object({ data: reservationSchema }),
    signal,
  );
  assertScope(payload.data, companyId, branch, id);
  return payload.data;
}

export async function createReservation(
  body: {
    company_id: number;
    branch_id: number;
    customer_id: number;
    vehicle_id: number;
    starts_at: string;
    ends_at: string;
  },
  signal: AbortSignal,
): Promise<Reservation> {
  const payload = await request("api/v1/reservations", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: reservationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected reservation response.");
  }
  return parsed.data.data;
}

export async function cancelReservation(
  id: number,
  signal: AbortSignal,
): Promise<Reservation> {
  const payload = await request(`api/v1/reservations/${id}/cancel`, {
    method: "POST",
    body: {},
    signal,
  });
  const parsed = z.object({ data: reservationSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected cancellation response.");
  }
  return parsed.data.data;
}

export async function listRentals(
  params: {
    companyId: string;
    branch: string;
    status?: string;
    driverUserId?: number;
    q?: string;
    page?: number;
    sort?: string;
    dir?: string;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  if (params.status) query.set("status", params.status);
  if (params.driverUserId) {
    query.set("driver_user_id", String(params.driverUserId));
  }
  const trimmedQ = (params.q ?? "").trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.sort) {
    query.set("sort", params.sort);
    if (params.dir === "asc" || params.dir === "desc") {
      query.set("dir", params.dir);
    }
  }

  const payload = await read(
    `api/v1/rentals?${query.toString()}`,
    pageSchema(rentalSchema),
    signal,
  );
  const normalized = normalizePage(payload);
  // Pre-PR #9 backends may omit branch_id/status/driver filtering on rentals index;
  // filter client-side instead of failing the entire table with 404.
  const scopedItems = normalized.items.filter((item) => {
    if (String(item.company_id) !== params.companyId) return false;
    if (params.branch !== "all" && String(item.branch_id) !== params.branch)
      return false;
    if (params.status && item.status !== params.status) return false;
    if (
      params.driverUserId &&
      item.driver_user_id !== params.driverUserId
    )
      return false;
    return true;
  });
  const total =
    scopedItems.length !== normalized.items.length && normalized.lastPage === 1
      ? scopedItems.length
      : normalized.total;
  return {
    ...normalized,
    items: scopedItems,
    total,
  } as {
    items: Rental[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

export async function getRental(
  id: string,
  companyId: string,
  branch: string,
  signal: AbortSignal,
): Promise<Rental> {
  const payload = await read(
    `api/v1/rentals/${id}`,
    z.object({ data: rentalSchema }),
    signal,
  );
  assertScope(payload.data, companyId, branch, id);
  return payload.data;
}

export async function createRental(
  body: {
    reservation_id: number;
    driver_user_id?: number | null;
  },
  signal: AbortSignal,
): Promise<Rental> {
  const payload = await request("api/v1/rentals", {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: rentalSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected rental creation response.");
  }
  return parsed.data.data;
}

export async function transitionRental(
  id: number,
  action: "handover" | "return",
  body: {
    odometer: number;
    notes: string;
    vehicle_status?: "available" | "maintenance" | "damaged";
    extra_charge_minor?: number;
    extra_charge_description?: string;
  },
  signal: AbortSignal,
): Promise<Rental> {
  const payload = await request(`api/v1/rentals/${id}/${action}`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: rentalSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected rental transition response.");
  }
  return parsed.data.data;
}

export async function extendRental(
  id: number,
  body: { ends_at: string; notes?: string },
  signal: AbortSignal,
): Promise<Rental> {
  const payload = await request(`api/v1/rentals/${id}/extend`, {
    method: "POST",
    body,
    signal,
  });
  const parsed = z.object({ data: rentalSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected rental extension response.");
  }
  return parsed.data.data;
}

export async function assignRentalDriver(
  id: number,
  driverUserId: number | null,
  signal: AbortSignal,
): Promise<Rental> {
  const payload = await request(`api/v1/rentals/${id}/assign-driver`, {
    method: "POST",
    body: { driver_user_id: driverUserId },
    signal,
  });
  const parsed = z.object({ data: rentalSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, "Unexpected driver assignment response.");
  }
  return parsed.data.data;
}
