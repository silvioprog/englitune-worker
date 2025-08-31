import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TranscriptWithSpeaker } from "../src/queries";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("englitune-worker", () => {
  let mockDb: any;
  let testEnv: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                transcript: "Hello world",
                sequence: "001",
                speaker: "p225",
                age: 23,
                gender: "female",
                accent: "English",
                region: "Southern England"
              }
            ]
          })
        })
      })
    };

    testEnv = {
      ...env,
      DB: mockDb
    };
  });

  describe("basic functionality", () => {
    it("should return transcript data for valid request", async () => {
      const request = new IncomingRequest("http://example.com/?limit=1");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as TranscriptWithSpeaker[];
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty("transcript");
      expect(data[0]).toHaveProperty("sequence");
      expect(data[0]).toHaveProperty("speaker");
    });

    it("should handle favicon requests", async () => {
      const request = new IncomingRequest("http://example.com/favicon.ico");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(204);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=604800, immutable"
      );
    });
  });

  describe("parameter validation", () => {
    it("should reject invalid HTTP methods", async () => {
      const request = new IncomingRequest("http://example.com/", {
        method: "POST"
      });
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Method must be GET");
    });

    it("should reject invalid paths", async () => {
      const request = new IncomingRequest("http://example.com/invalid");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Path must be /");
    });

    it("should reject invalid limit values", async () => {
      const request = new IncomingRequest("http://example.com/?limit=abc");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Limit must be a number: abc");
    });

    it("should reject limit values out of range", async () => {
      const request = new IncomingRequest("http://example.com/?limit=101");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Limit must be less or equal to 100");
    });
  });

  describe("excluded parameter functionality", () => {
    it("should handle requests with excluded parameters", async () => {
      const request = new IncomingRequest(
        "http://example.com/?limit=2&excluded=p225=001,002;p226=003"
      );
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(mockDb.prepare).toHaveBeenCalled();

      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).toContain("WHERE NOT");
      expect(query).toContain("t.speaker_id = ?");
      expect(query).toContain("t.sequence IN");
    });

    it("should reject malformed excluded parameters", async () => {
      const request = new IncomingRequest(
        "http://example.com/?excluded=invalid"
      );
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Excluded must be in format");
    });
  });

  describe("database error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock console.error to suppress expected error output
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const failingDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi
              .fn()
              .mockRejectedValue(new Error("Database connection failed"))
          })
        })
      };

      const request = new IncomingRequest("http://example.com/?limit=1");
      const ctx = createExecutionContext();

      const response = await worker.fetch(
        request,
        { ...testEnv, DB: failingDb },
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Internal server error");

      // Verify that console.error was called (error was logged)
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe("default behavior", () => {
    it("should use default limit of 1 when not specified", async () => {
      const request = new IncomingRequest("http://example.com/");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(mockDb.prepare).toHaveBeenCalled();

      const bindCalls = mockDb.prepare.mock.results[0].value.bind.mock.calls;
      expect(bindCalls[0]).toEqual([1]); // Default limit should be 1
    });

    it("should work without excluded parameters", async () => {
      const request = new IncomingRequest("http://example.com/?limit=5");
      const ctx = createExecutionContext();

      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).not.toContain("WHERE");
    });
  });
});
