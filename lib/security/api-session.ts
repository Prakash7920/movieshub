import { AsyncLocalStorage } from "node:async_hooks";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

type ApiSession = { user?: { id?: string } } | null;

const integrationSession = new AsyncLocalStorage<ApiSession>();

/**
 * Allows isolated integration tests to invoke an API route with a controlled
 * user session while retaining the real route and database behavior.
 */
export async function runWithApiSessionForIntegrationTest<T>(
  session: ApiSession,
  callback: () => Promise<T>,
): Promise<T> {
  if (process.env.MOVIESHUB_E2E !== "true") {
    throw new Error("Injected API sessions are only available during isolated integration tests.");
  }
  return integrationSession.run(session, callback);
}

export async function getApiSession(): Promise<ApiSession> {
  const injected = integrationSession.getStore();
  if (process.env.MOVIESHUB_E2E === "true" && injected !== undefined) return injected;
  return (await getServerSession(authOptions)) as ApiSession;
}
