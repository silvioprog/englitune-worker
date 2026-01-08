import { describe, it, expect, vi } from "vitest";
import type { TranscriptWithSpeaker } from "../src/queries";
import app from "../src/index";

const mockTranscriptData = [
  {
    transcript: "Hello world",
    sequence: "001",
    speaker: "p225",
    age: 23,
    gender: "female",
    accent: "English",
    region: "Southern England"
  }
];

const createMockDatabase = (results = mockTranscriptData) => {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results })
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    mockStatement
  };
};

const createMockEnv = (corsOrigin = "https://englitune.silvioprog.dev") => ({
  DB: createMockDatabase(),
  CORS_ORIGIN: corsOrigin
});

describe("englitune-worker", () => {
  describe("basic functionality", () => {
    it("should return transcript data for valid request", async () => {
      const mockEnv = createMockEnv("*");
      const response = await app.request(
        "/?limit=1",
        {
          method: "GET",
          headers: { Origin: "https://example.com" }
        },
        mockEnv
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      const data = (await response.json()) as TranscriptWithSpeaker[];
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty("transcript");
      expect(data[0]).toHaveProperty("sequence");
      expect(data[0]).toHaveProperty("speaker");
    });

    it("should handle favicon requests", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/favicon.ico",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=604800, immutable"
      );
    });
  });

  describe("parameter validation", () => {
    it("should return 404 for invalid HTTP methods", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request("/", { method: "POST" }, mockEnv);
      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Not found");
    });

    it("should return 404 for invalid paths", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/invalid",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Not found");
    });

    it("should reject invalid limit values", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/?limit=abc",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("'limit' must be a number: abc");
    });

    it("should reject limit values out of range", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/?limit=101",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("'limit' must be less or equal to 100");
    });
  });

  describe("excluded parameter functionality", () => {
    it("should handle requests with excluded parameters", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/?limit=2&excluded=p225=001,002;p226=003",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(200);
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
      const query = mockEnv.DB.prepare.mock.calls[0][0];
      expect(query).toContain("WHERE NOT");
      expect(query).toContain("t.speaker_id = ?");
      expect(query).toContain("t.sequence IN");
    });

    it("should reject malformed excluded parameters", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/?excluded=invalid",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("'excluded' must be in format");
    });
  });

  describe("database error handling", () => {
    it("should handle database errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockEnv = createMockEnv();
      mockEnv.DB.mockStatement.all = vi
        .fn()
        .mockRejectedValue(new Error("Database connection failed"));
      const response = await app.request(
        "/?limit=1",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Internal server error");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("default behavior", () => {
    it("should use default limit of 1 when not specified", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request("/", { method: "GET" }, mockEnv);
      expect(response.status).toBe(200);
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
      const bindCalls =
        mockEnv.DB.prepare.mock.results[0].value.bind.mock.calls;
      expect(bindCalls[0]).toEqual([1]);
    });

    it("should work without excluded parameters", async () => {
      const mockEnv = createMockEnv();
      const response = await app.request(
        "/?limit=5",
        { method: "GET" },
        mockEnv
      );
      expect(response.status).toBe(200);
      const query = mockEnv.DB.prepare.mock.calls[0][0];
      expect(query).not.toContain("WHERE");
    });
  });

  describe("CORS", () => {
    it("should allow all origins when CORS_ORIGIN is *", async () => {
      const mockEnv = createMockEnv("*");
      const response = await app.request(
        "/",
        {
          method: "GET",
          headers: { Origin: "https://example.com" }
        },
        mockEnv
      );
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should allow specific origin when CORS_ORIGIN matches request origin", async () => {
      const mockEnv = createMockEnv("https://englitune.silvioprog.dev");
      const response = await app.request(
        "/",
        {
          method: "GET",
          headers: { Origin: "https://englitune.silvioprog.dev" }
        },
        mockEnv
      );
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://englitune.silvioprog.dev"
      );
    });

    it("should reject origin when CORS_ORIGIN does not match request origin", async () => {
      const mockEnv = createMockEnv("https://englitune.silvioprog.dev");
      const response = await app.request(
        "/",
        {
          method: "GET",
          headers: { Origin: "https://evil.com" }
        },
        mockEnv
      );
      const corsHeader = response.headers.get("Access-Control-Allow-Origin");
      expect(corsHeader === "" || corsHeader === null).toBe(true);
    });

    it("should handle OPTIONS preflight requests", async () => {
      const mockEnv = createMockEnv("*");
      const response = await app.request(
        "/",
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://example.com",
            "Access-Control-Request-Method": "GET"
          }
        },
        mockEnv
      );
      expect([200, 204]).toContain(response.status);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      const methods = response.headers.get("Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
      expect(methods).toContain("OPTIONS");
    });
  });
});
