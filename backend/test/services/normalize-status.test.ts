import { describe, it, expect } from "vitest";
import { normalizeStatus } from "../../src/models/round.js";

describe("normalizeStatus", () => {
  it("maps legacy 'picked' to 'selected'", () => {
    expect(normalizeStatus("picked")).toBe("selected");
  });

  it("passes through 'voting' unchanged", () => {
    expect(normalizeStatus("voting")).toBe("voting");
  });

  it("passes through 'closed' unchanged", () => {
    expect(normalizeStatus("closed")).toBe("closed");
  });

  it("passes through 'selected' unchanged", () => {
    expect(normalizeStatus("selected")).toBe("selected");
  });

  it("passes through 'watched' unchanged", () => {
    expect(normalizeStatus("watched")).toBe("watched");
  });

  it("passes through 'rated' unchanged", () => {
    expect(normalizeStatus("rated")).toBe("rated");
  });

  it("passes through 'discarded' unchanged", () => {
    expect(normalizeStatus("discarded")).toBe("discarded");
  });

  it("passes through unknown status values unchanged", () => {
    expect(normalizeStatus("some_future_status")).toBe("some_future_status");
  });
});
