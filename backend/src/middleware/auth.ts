import type { Context, Next } from "hono";
import type { LambdaEvent } from "hono/aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ForbiddenError } from "../lib/errors.js";

export type AppEnv = {
  Bindings: {
    event: unknown;
  };
  Variables: {
    userId: string;
    email: string;
    actingMemberId?: string;
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

    // Support acting-as-member for managed profiles
    const actingAs = c.req.header("X-Acting-As-Member");
    if (actingAs) {
      // Validate the managed member exists and belongs to this user
      const docClient = getDocClient();
      const result = await docClient.send(
        new GetCommand({
          TableName: tableName("USERS"),
          Key: { user_id: actingAs },
        }),
      );

      const managedUser = result.Item;
      if (!managedUser || !managedUser.is_managed || managedUser.parent_user_id !== userId) {
        throw new ForbiddenError("Managed member not found or access denied");
      }

      c.set("actingMemberId", actingAs);
    }

    await next();
  };
}
