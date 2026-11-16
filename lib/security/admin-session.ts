import { AsyncLocalStorage } from "node:async_hooks";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

type AdminSession = { user?: { id?: string } } | null;
type SessionResolver = () => Promise<AdminSession>;

const integrationSession = new AsyncLocalStorage<AdminSession>();

/**
 * Allows route integration tests to provide a session while still invoking the
 * real route handler and real database. It is unavailable outside the isolated
 * integration-test environment; production always resolves NextAuth normally.
 */
export async function runWithAdminSessionForIntegrationTest<T>(
  session: AdminSession,
  callback: () => Promise<T>,
): Promise<T> {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Injected admin sessions are only available during isolated integration tests.");
  }
  return integrationSession.run(session, callback);
}

export async function getAdminSession(): Promise<AdminSession> {
  const injected = integrationSession.getStore();
  if (process.env.MOVIESHUB_E2E === "true" && injected !== undefined) return injected;
  return (await getServerSession(authOptions)) as AdminSession;
}
