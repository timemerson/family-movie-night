import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { authMiddleware } from "./middleware/auth.js";
import type { AppEnv } from "./middleware/auth.js";
import { users } from "./routes/users.js";
import { groups } from "./routes/groups.js";
import { preferences } from "./routes/preferences.js";
import { picks } from "./routes/picks.js";
import { suggestions } from "./routes/suggestions.js";
import { watchlist } from "./routes/watchlist.js";
import { HttpError } from "./lib/errors.js";

const app = new Hono<AppEnv>();

// Public routes
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth middleware for all other routes
app.use("/*", authMiddleware());

// Routes
app.route("/", users);
app.route("/", groups);
app.route("/", preferences);
app.route("/", picks);
app.route("/", suggestions);
app.route("/", watchlist);

// Global error handler
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
export const handler = handle(app);
