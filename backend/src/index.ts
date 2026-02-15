import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

export const handler = handle(app);
export { app };
