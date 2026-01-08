import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import validators from "./validators";

type ValidatedQuery = {
  limit: number;
  excluded: Map<string, Set<string>>;
};

type ErrorResponse = {
  error: string;
};

const testValidators = async (url: string) => {
  let query: ValidatedQuery | undefined;
  const app = new Hono();
  app.get("/", validators, (c) => {
    query = c.req.valid("query");
    return c.json([]);
  });
  const res = await app.request(url, { method: "GET" });
  if (res.status === 200) {
    return { status: res.status, query };
  } else {
    const { error } = (await res.json()) as ErrorResponse;
    return { status: res.status, error };
  }
};

describe("validators", () => {
  describe("limit parameter validation", () => {
    it("should use default limit of 1 when not provided", async () => {
      const result = await testValidators("/");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(1);
    });

    it("should accept valid limit within range", async () => {
      const result = await testValidators("/?limit=50");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(50);
    });

    it("should accept minimum limit of 1", async () => {
      const result = await testValidators("/?limit=1");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(1);
    });

    it("should accept maximum limit of 100", async () => {
      const result = await testValidators("/?limit=100");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(100);
    });

    it("should reject limit below minimum", async () => {
      const result = await testValidators("/?limit=0");
      expect(result.status).toBe(400);
      expect(result.error).toBe("'limit' must be greater or equal to 1");
    });

    it("should reject negative limit", async () => {
      const result = await testValidators("/?limit=-5");
      expect(result.status).toBe(400);
      expect(result.error).toBe("'limit' must be greater or equal to 1");
    });

    it("should reject limit above maximum", async () => {
      const result = await testValidators("/?limit=101");
      expect(result.status).toBe(400);
      expect(result.error).toBe("'limit' must be less or equal to 100");
    });

    it("should reject non-numeric limit", async () => {
      const result = await testValidators("/?limit=abc");
      expect(result.status).toBe(400);
      expect(result.error).toBe("'limit' must be a number: abc");
    });

    it("should handle empty string limit as default", async () => {
      const result = await testValidators("/?limit=");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(1);
    });

    it("should handle decimal limit by truncating", async () => {
      const result = await testValidators("/?limit=50.5");
      expect(result.status).toBe(200);
      expect(result.query?.limit).toBe(50);
    });
  });

  describe("excluded parameter validation", () => {
    it("should return empty Map when excluded not provided", async () => {
      const result = await testValidators("/");
      expect(result.status).toBe(200);
      const expectedMap = new Map<string, Set<string>>();
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should parse single id with single sequence in excluded", async () => {
      const result = await testValidators("/?excluded=p225=001");
      expect(result.status).toBe(200);
      const expectedMap = new Map([["p225", new Set(["001"])]]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should parse single id with multiple sequences in excluded", async () => {
      const result = await testValidators("/?excluded=p225=001,002,003");
      expect(result.status).toBe(200);
      const expectedMap = new Map([["p225", new Set(["001", "002", "003"])]]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should parse multiple ids with multiple sequences in excluded", async () => {
      const result = await testValidators(
        "/?excluded=p225=001,002;p226=003,004"
      );
      expect(result.status).toBe(200);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002"])],
        ["p226", new Set(["003", "004"])]
      ]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should return error for invalid format (missing equals)", async () => {
      const result = await testValidators("/?excluded=p225=001;p226");
      expect(result.status).toBe(400);
      expect(result.error).toBe(
        "'excluded' must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p226"
      );
    });

    it("should handle empty excluded parameter", async () => {
      const result = await testValidators("/?excluded=");
      expect(result.status).toBe(200);
      const expectedMap = new Map<string, Set<string>>();
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should return error for missing sequences after equals", async () => {
      const result = await testValidators("/?excluded=p225=;p226=003");
      expect(result.status).toBe(400);
      expect(result.error).toBe(
        "'excluded' must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p225="
      );
    });

    it("should return error for single value without equals", async () => {
      const result = await testValidators("/?excluded=p225");
      expect(result.status).toBe(400);
      expect(result.error).toBe(
        "'excluded' must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p225"
      );
    });

    it("should handle excluded with spaces in sequences", async () => {
      const result = await testValidators(
        "/?excluded=p225=001, 002 ,003;p226= 004,005 "
      );
      expect(result.status).toBe(200);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002", "003"])],
        ["p226", new Set(["004", "005"])]
      ]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should handle duplicate sequences by automatically deduplicating", async () => {
      const result = await testValidators(
        "/?excluded=p225=001,002,001,003,002;p226=004,004,005"
      );
      expect(result.status).toBe(200);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002", "003"])],
        ["p226", new Set(["004", "005"])]
      ]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should return error for empty sequences after filtering", async () => {
      const result = await testValidators("/?excluded=p225=,,,");
      expect(result.status).toBe(400);
      expect(result.error).toBe(
        "'excluded' must have at least one sequence for id p225: p225=,,,"
      );
    });

    it("should filter out empty sequences but keep valid ones", async () => {
      const result = await testValidators("/?excluded=p225=001,,002, ,003");
      expect(result.status).toBe(200);
      const expectedMap = new Map([["p225", new Set(["001", "002", "003"])]]);
      expect(result.query?.excluded).toEqual(expectedMap);
    });
  });

  describe("complete request scenarios", () => {
    it("should handle request with all valid parameters", async () => {
      const result = await testValidators(
        "/?limit=25&excluded=p225=001,002;p226=003;p227=004,005"
      );
      expect(result.status).toBe(200);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002"])],
        ["p226", new Set(["003"])],
        ["p227", new Set(["004", "005"])]
      ]);
      expect(result.query?.limit).toBe(25);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should handle request with only limit parameter", async () => {
      const result = await testValidators("/?limit=75");
      expect(result.status).toBe(200);
      const expectedMap = new Map<string, Set<string>>();
      expect(result.query?.limit).toBe(75);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should handle request with only excluded parameter", async () => {
      const result = await testValidators("/?excluded=p225=001;p226=002,003");
      expect(result.status).toBe(200);
      const expectedMap = new Map([
        ["p225", new Set(["001"])],
        ["p226", new Set(["002", "003"])]
      ]);
      expect(result.query?.limit).toBe(1);
      expect(result.query?.excluded).toEqual(expectedMap);
    });

    it("should handle request with no parameters", async () => {
      const result = await testValidators("/");
      expect(result.status).toBe(200);
      const expectedMap = new Map<string, Set<string>>();
      expect(result.query?.limit).toBe(1);
      expect(result.query?.excluded).toEqual(expectedMap);
    });
  });
});
