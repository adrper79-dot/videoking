import { toNextJsHandler } from "better-auth/next-js";
import { authClient } from "@/lib/auth-client";

// BetterAuth handles all /api/auth/* routes
export const { GET, POST } = toNextJsHandler(authClient);
