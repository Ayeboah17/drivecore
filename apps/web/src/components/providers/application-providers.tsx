"use client";
import { DevelopmentProvider } from "@/mocks/development-provider";
import { ContextProvider } from "@/lib/context/context-provider";
export function ApplicationProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DevelopmentProvider>
      <ContextProvider>{children}</ContextProvider>
    </DevelopmentProvider>
  );
}
