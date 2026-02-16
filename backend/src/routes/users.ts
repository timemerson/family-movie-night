import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { UserService } from "../services/user-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";

const users = new Hono<AppEnv>();

users.get("/users/me", async (c) => {
  const userId = c.get("userId");
  const email = c.get("email");

  const service = new UserService(getDocClient(), tableName("USERS"));
  const user = await service.getOrCreateUser(userId, email);

  return c.json(user);
});

users.delete("/users/me", async (c) => {
  const userId = c.get("userId");

  const service = new UserService(getDocClient(), tableName("USERS"));
  await service.deleteUser(userId);

  return c.body(null, 204);
});

export { users };
