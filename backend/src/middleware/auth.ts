import type { Context, Next } from "hono";
import type { LambdaEvent } from "hono/aws-lambda";

export type AppEnv = {
  Bindings: {
    event: unknown;
  };
  Variables: {
    userId: string;
    email: string;
  };
};

export function authMiddleware() {
  return async (c: Context<AppEnv>, next: Next) => {
    const event = c.env?.event as LambdaEvent | undefined;

    const authorizer = (event as unknown as Record<string, unknown>)?.requestContext as
      | Record<string, unknown>
      | undefined;
    const jwt = (authorizer?.authorizer as Record<string, unknown>)?.jwt as
      | Record<string, unknown>
      | undefined;
    const claims = jwt?.claims as Record<string, string> | undefined;

    const userId = claims?.sub;
    const email = claims?.email;

    if (!userId || !email) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", userId);
    c.set("email", email);

    await next();
  };
}
