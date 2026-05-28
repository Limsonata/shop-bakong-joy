// Server-only Clerk helper. Resolves the current Clerk userId from the
// incoming request. Throws Response(401) when not signed in.
import { getAuth } from "@clerk/tanstack-react-start/server";
import { getRequest } from "@tanstack/react-start/server";

export async function requireUserId(): Promise<string> {
  const { userId } = await getAuth(getRequest());
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return userId;
}

export async function getUserId(): Promise<string | null> {
  const { userId } = await getAuth(getRequest());
  return userId ?? null;
}