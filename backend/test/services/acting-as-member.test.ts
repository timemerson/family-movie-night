import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

let mockSend: ReturnType<typeof vi.fn>;

vi.mock("../../src/lib/dynamo.js", () => ({
  getDocClient: () => ({ send: (...args: any[]) => mockSend(...args) }),
  tableName: (name: string) => `test-${name.toLowerCase()}`,
}));

import { authMiddleware } from "../../src/middleware/auth.js";
import type { AppEnv } from "../../src/middleware/auth.js";
import { HttpError } from "../../src/lib/errors.js";

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", authMiddleware());
  app.get("/test", (c) => {
    return c.json({
      userId: c.get("userId"),
      actingMemberId: c.get("actingMemberId") ?? null,
    });
  });
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status as 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  });
  return app;
}

function makeRequest(actingAs?: string) {
  const headers: Record<string, string> = {};
  if (actingAs) {
    headers["X-Acting-As-Member"] = actingAs;
  }
  // Simulate Lambda event with JWT claims in the request context
  const event = {
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: "parent-1", email: "parent@example.com" },
        },
      },
    },
  };

  return new Request("http://localhost/test", {
    headers,
  });
}

describe("X-Acting-As-Member auth middleware", () => {
  beforeEach(() => {
    mockSend = vi.fn();
  });

  it("sets actingMemberId for valid managed member owned by caller", async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        user_id: "managed_abc",
        is_managed: true,
        parent_user_id: "parent-1",
      },
    });

    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Acting-As-Member": "managed_abc" },
    }, {
      event: {
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: "parent-1", email: "parent@example.com" } },
          },
        },
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actingMemberId).toBe("managed_abc");
  });

  it("rejects when managed member belongs to different parent", async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        user_id: "managed_abc",
        is_managed: true,
        parent_user_id: "other-parent",
      },
    });

    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Acting-As-Member": "managed_abc" },
    }, {
      event: {
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: "parent-1", email: "parent@example.com" } },
          },
        },
      },
    });

    // ForbiddenError should result in an error response
    expect(res.status).toBe(403);
  });

  it("rejects when target user is not managed", async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        user_id: "regular-user",
        is_managed: false,
        parent_user_id: null,
      },
    });

    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Acting-As-Member": "regular-user" },
    }, {
      event: {
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: "parent-1", email: "parent@example.com" } },
          },
        },
      },
    });

    expect(res.status).toBe(403);
  });

  it("rejects when target user does not exist", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Acting-As-Member": "managed_nonexistent" },
    }, {
      event: {
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: "parent-1", email: "parent@example.com" } },
          },
        },
      },
    });

    expect(res.status).toBe(403);
  });

  it("does not set actingMemberId when header is absent", async () => {
    const app = createApp();
    const res = await app.request("/test", {}, {
      event: {
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: "parent-1", email: "parent@example.com" } },
          },
        },
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actingMemberId).toBeNull();
  });
});
