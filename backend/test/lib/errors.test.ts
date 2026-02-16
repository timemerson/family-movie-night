import { describe, it, expect } from "vitest";
import { HttpError, NotFoundError, ForbiddenError, ConflictError } from "../../src/lib/errors.js";

describe("HttpError hierarchy", () => {
  it("HttpError stores status and message", () => {
    const err = new HttpError(400, "Bad request");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Bad request");
    expect(err).toBeInstanceOf(Error);
  });

  it("NotFoundError defaults to 404", () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
  });

  it("ForbiddenError defaults to 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("ConflictError defaults to 409", () => {
    const err = new ConflictError();
    expect(err.status).toBe(409);
    expect(err.message).toBe("Conflict");
  });
});
