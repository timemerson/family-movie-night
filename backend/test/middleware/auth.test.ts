import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import type { AppEnv } from "../../src/middleware/auth.js";

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("/*", authMiddleware());
  app.get("/test", (c) => {
    return c.json({
      userId: c.get("userId"),
      email: c.get("email"),
    });
  });
  return app;
}

function makeRequest(claims?: Record<string, string>) {
  const event = claims
    ? {
        requestContext: {
          authorizer: {
            jwt: {
              claims,
            },
          },
        },
      }
    : {};

  const app = createApp();
  // Hono's app.request lets us set env which simulates Lambda event context
  return app.request("/test", {}, { event });
}

describe("authMiddleware", () => {
  it("extracts userId and email from JWT claims", async () => {
    const res = await makeRequest({
      sub: "user-abc",
      email: "test@example.com",
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.userId).toBe("user-abc");
    expect(body.email).toBe("test@example.com");
  });

  it("returns 401 when claims are missing", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(401);
  });

  it("returns 401 when sub is missing", async () => {
    const res = await makeRequest({ email: "test@example.com" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when email is missing", async () => {
    const res = await makeRequest({ sub: "user-abc" });
    expect(res.status).toBe(401);
  });
});
