// Server-only Clerk helper. Resolves the current Clerk userId.
// Requires clerkMiddleware() to be installed as a global request middleware.
import { auth } from "@clerk/tanstack-react-start/server";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return userId;
}

export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}