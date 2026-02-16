import { Hono } from "hono";
import { UserService } from "../services/user-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";

const users = new Hono();

users.get("/users/me", async (c) => {
  const userId = c.get("userId") as string;
  const email = c.get("email") as string;

  const service = new UserService(getDocClient(), tableName("USERS"));
  const user = await service.getOrCreateUser(userId, email);

  return c.json(user);
});

users.delete("/users/me", async (c) => {
  const userId = c.get("userId") as string;

  const service = new UserService(getDocClient(), tableName("USERS"));
  await service.deleteUser(userId);

  return c.body(null, 204);
});

export { users };
