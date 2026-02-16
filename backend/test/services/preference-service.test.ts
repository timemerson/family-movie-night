import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreferenceService } from "../../src/services/preference-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("PreferenceService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: PreferenceService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new PreferenceService(client as any, "test-preferences");
  });

  describe("getPreferences", () => {
    it("returns preferences when found", async () => {
      const prefs = {
        group_id: "g-1",
        user_id: "u-1",
        genre_likes: ["28", "35"],
        genre_dislikes: ["27"],
        max_content_rating: "PG-13",
        updated_at: "2026-02-14T00:00:00Z",
      };
      mockSend.mockResolvedValueOnce({ Item: prefs });

      const result = await service.getPreferences("g-1", "u-1");

      expect(result).toEqual(prefs);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-preferences");
      expect(cmd.input.Key).toEqual({ group_id: "g-1", user_id: "u-1" });
    });

    it("returns null when not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await service.getPreferences("g-1", "u-1");

      expect(result).toBeNull();
    });
  });

  describe("putPreferences", () => {
    it("writes preference item and returns it with timestamp", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.putPreferences("g-1", "u-1", {
        genre_likes: ["28", "35"],
        genre_dislikes: ["27"],
        max_content_rating: "PG-13",
      });

      expect(result.group_id).toBe("g-1");
      expect(result.user_id).toBe("u-1");
      expect(result.genre_likes).toEqual(["28", "35"]);
      expect(result.genre_dislikes).toEqual(["27"]);
      expect(result.max_content_rating).toBe("PG-13");
      expect(result.updated_at).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-preferences");
      expect(cmd.input.Item.group_id).toBe("g-1");
    });

    it("overwrites existing preferences (idempotent PUT)", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.putPreferences("g-1", "u-1", {
        genre_likes: ["16", "14"],
        genre_dislikes: [],
        max_content_rating: "G",
      });

      expect(result.genre_likes).toEqual(["16", "14"]);
      expect(result.max_content_rating).toBe("G");
    });
  });
});
