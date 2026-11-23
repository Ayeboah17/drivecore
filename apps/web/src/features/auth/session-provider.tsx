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

export type LoginResult =
  | { status: "authenticated" }
  | { status: "two_factor_required"; challengeToken: string };

interface Session {
  user: User | null;
  pending: boolean;
  error: Error | null;
  notice: string | null;
  epoch: number;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (input: {
    challengeToken: string;
    code?: string;
    recoveryCode?: string;
  }) => Promise<void>;
  adoptUser: (user: User, resetSession?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  refresh: () => void;
}
const Context = createContext<Session | null>(null);
function SessionState({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const generation = useRef(0);
  const justSignedInEpoch = useRef<number | null>(null);
  const identity = useQuery({
    queryKey: ["identity", epoch],
    queryFn: async ({ signal }) => {
      try {
        const user = (
          await read("api/v1/auth/me", z.object({ data: userSchema }), signal)
        ).data;
        if (justSignedInEpoch.current === epoch)
          justSignedInEpoch.current = null;
        setNotice(null);
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          if (justSignedInEpoch.current === epoch) {
            justSignedInEpoch.current = null;
            setNotice(
              "Sign-in succeeded, but the API did not recognize your session cookie (/api/v1/auth/me returned 401). Confirm SANCTUM_STATEFUL_DOMAINS on the API includes this domain and DRIVECORE_SESSION_COOKIE_NAME matches Laravel SESSION_COOKIE.",
            );
          }
          return null;
        }
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
        notice,
        epoch,
        expire,
        refresh: () => {
          void identity.refetch();
        },
        login: async (email, password): Promise<LoginResult> => {
          const active = ++generation.current;
          setNotice(null);
          await initializeCsrf();
          const payload = await request("api/v1/auth/login", {
            method: "POST",
            body: { email, password },
          });
          const challenge = z
            .object({
              two_factor_required: z.literal(true),
              challenge_token: z.string().min(1),
            })
            .safeParse(payload);
          if (challenge.success) {
            return {
              status: "two_factor_required",
              challengeToken: challenge.data.challenge_token,
            };
          }
          const parsed = z.object({ data: userSchema }).safeParse(payload);
          if (!parsed.success)
            throw new ApiError(
              502,
              "Unexpected sign-in response. Reload to verify your session.",
            );
          if (active !== generation.current) return { status: "authenticated" };
          const nextEpoch = epoch + 1;
          justSignedInEpoch.current = nextEpoch;
          await client.cancelQueries();
          client.clear();
          client.setQueryData(["identity", nextEpoch], parsed.data.data);
          setEpoch(nextEpoch);
          return { status: "authenticated" };
        },
        verifyTwoFactor: async ({ challengeToken, code, recoveryCode }) => {
          const active = ++generation.current;
          setNotice(null);
          await initializeCsrf();
          const payload = await request("api/v1/auth/two-factor/challenge", {
            method: "POST",
            body: {
              challenge_token: challengeToken,
              ...(code ? { code } : {}),
              ...(recoveryCode ? { recovery_code: recoveryCode } : {}),
            },
          });
          const parsed = z.object({ data: userSchema }).safeParse(payload);
          if (!parsed.success)
            throw new ApiError(
              502,
              "Unexpected two-factor verification response. Reload to verify your session.",
            );
          if (active !== generation.current) return;
          const nextEpoch = epoch + 1;
          justSignedInEpoch.current = nextEpoch;
          await client.cancelQueries();
          client.clear();
          client.setQueryData(["identity", nextEpoch], parsed.data.data);
          setEpoch(nextEpoch);
        },
        adoptUser: async (nextUser, resetSession = false) => {
          setNotice(null);
          if (resetSession) {
            const nextEpoch = epoch + 1;
            justSignedInEpoch.current = nextEpoch;
            await client.cancelQueries();
            client.clear();
            client.setQueryData(["identity", nextEpoch], nextUser);
            setEpoch(nextEpoch);
          } else {
            client.setQueryData(["identity", epoch], nextUser);
          }
        },
        logout: async () => {
          justSignedInEpoch.current = null;
          setNotice(null);
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
