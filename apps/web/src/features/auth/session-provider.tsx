"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { createQueryClient } from "@/lib/data/query-client";
import { ApiError, initializeCsrf, read, request } from "@/lib/api/client";
import { userSchema, type User } from "@/lib/api/contracts";

interface Session {
  user: User | null;
  pending: boolean;
  error: Error | null;
  epoch: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  refresh: () => void;
}
const Context = createContext<Session | null>(null);
function SessionState({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [epoch, setEpoch] = useState(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const generation = useRef(0);
  const identity = useQuery({
    queryKey: ["identity", epoch],
    queryFn: async ({ signal }) => {
      try {
        return (
          await read("api/v1/auth/me", z.object({ data: userSchema }), signal)
        ).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const expire = useCallback(() => {
    generation.current++;
    void client.cancelQueries();
    client.clear();
    client.setQueryData(["identity", epoch + 1], null);
    setEpoch(epoch + 1);
  }, [client, epoch]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bus = new BroadcastChannel("drivecore-session");
    channel.current = bus;
    bus.onmessage = (event) => {
      if (event.data === "logout") expire();
    };
    return () => {
      channel.current = null;
      bus.close();
    };
  }, [expire]);
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.query.queryKey[0] === "live" &&
          event.query.queryKey[1] === epoch &&
          event.query.state.error instanceof ApiError &&
          event.query.state.error.status === 401
        )
          expire();
      }),
    [client, epoch, expire],
  );
  const signature = identity.data ? JSON.stringify(identity.data) : "anonymous";
  useEffect(() => {
    if (identity.error instanceof ApiError && identity.error.status === 403) {
      void client.cancelQueries({ queryKey: ["live"] });
      client.removeQueries({ queryKey: ["live"] });
    }
  }, [identity.error, client]);
  useEffect(() => {
    // Permission/membership refresh invalidates every dependent context before it can be reused.
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === "live" &&
        (query.queryKey[3] === "directory"
          ? query.queryKey[4] !== signature
          : query.queryKey[6] !== signature),
    };
    void client.cancelQueries(filters);
    client.removeQueries(filters);
  }, [signature, client]);
  return (
    <Context
      value={{
        user: identity.data ?? null,
        // A cached anonymous result is not a completed verification of the current session.
        pending:
          identity.isPending || (identity.data === null && identity.isFetching),
        error: identity.error,
        epoch,
        expire,
        refresh: () => {
          void identity.refetch();
        },
        login: async (email, password) => {
          const active = ++generation.current;
          await initializeCsrf();
          const payload = await request("api/v1/auth/login", {
            method: "POST",
            body: { email, password },
          });
          const parsed = z.object({ data: userSchema }).safeParse(payload);
          if (!parsed.success)
            throw new ApiError(
              502,
              "Unexpected sign-in response. Reload to verify your session.",
            );
          if (active !== generation.current) return;
          await client.cancelQueries();
          client.clear();
          client.setQueryData(["identity", epoch + 1], parsed.data.data);
          setEpoch(epoch + 1);
        },
        logout: async () => {
          try {
            await request("api/v1/auth/logout", { method: "POST", body: {} });
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 401))
              throw error;
          }
          expire();
          channel.current?.postMessage("logout");
        },
      }}
    >
      {children}
    </Context>
  );
}
export function LiveProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <SessionState>{children}</SessionState>
    </QueryClientProvider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Session provider missing");
  return value;
}
