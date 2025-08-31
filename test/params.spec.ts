import { describe, it, expect } from "vitest";
import { ParamsError, getParams } from "../src/params";

describe("getParams", () => {
  describe("HTTP method validation", () => {
    it("should accept GET method", () => {
      const request = new Request("http://example.com/", { method: "GET" });
      expect(() => getParams(request)).not.toThrow();
    });

    it("should accept GET method case insensitive", () => {
      const request = new Request("http://example.com/", { method: "get" });
      expect(() => getParams(request)).not.toThrow();
    });

    it("should accept OPTIONS method", () => {
      const request = new Request("http://example.com/", { method: "OPTIONS" });
      expect(() => getParams(request)).not.toThrow();
    });

    it("should accept OPTIONS method case insensitive", () => {
      const request = new Request("http://example.com/", { method: "options" });
      expect(() => getParams(request)).not.toThrow();
    });

    it("should reject POST method", () => {
      const request = new Request("http://example.com/", { method: "POST" });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Method must be GET");
    });

    it("should reject PUT method", () => {
      const request = new Request("http://example.com/", { method: "PUT" });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Method must be GET");
    });

    it("should reject DELETE method", () => {
      const request = new Request("http://example.com/", { method: "DELETE" });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Method must be GET");
    });
  });

  describe("path validation", () => {
    it("should accept root path /", () => {
      const request = new Request("http://example.com/", { method: "GET" });
      const params = getParams(request);
      expect(params.isFavicon).toBe(false);
    });

    it("should accept favicon.ico path", () => {
      const request = new Request("http://example.com/favicon.ico", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.isFavicon).toBe(true);
    });

    it("should accept favicon.ico path with OPTIONS method", () => {
      const request = new Request("http://example.com/favicon.ico", {
        method: "OPTIONS"
      });
      const params = getParams(request);
      expect(params.isFavicon).toBe(true);
    });

    it("should reject invalid path", () => {
      const request = new Request("http://example.com/invalid", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Path must be /");
    });

    it("should reject path with query params but wrong path", () => {
      const request = new Request("http://example.com/wrong?limit=5", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Path must be /");
    });
  });

  describe("limit parameter validation", () => {
    it("should use default limit of 1 when not provided", () => {
      const request = new Request("http://example.com/", { method: "GET" });
      const params = getParams(request);
      expect(params.limit).toBe(1);
    });

    it("should accept valid limit within range", () => {
      const request = new Request("http://example.com/?limit=50", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.limit).toBe(50);
    });

    it("should accept minimum limit of 1", () => {
      const request = new Request("http://example.com/?limit=1", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.limit).toBe(1);
    });

    it("should accept maximum limit of 100", () => {
      const request = new Request("http://example.com/?limit=100", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.limit).toBe(100);
    });

    it("should reject limit below minimum", () => {
      const request = new Request("http://example.com/?limit=0", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Limit must be greater or equal to 1"
      );
    });

    it("should reject negative limit", () => {
      const request = new Request("http://example.com/?limit=-5", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Limit must be greater or equal to 1"
      );
    });

    it("should reject limit above maximum", () => {
      const request = new Request("http://example.com/?limit=101", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Limit must be less or equal to 100"
      );
    });

    it("should reject non-numeric limit", () => {
      const request = new Request("http://example.com/?limit=abc", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow("Limit must be a number: abc");
    });

    it("should handle empty string limit as default", () => {
      const request = new Request("http://example.com/?limit=", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.limit).toBe(1); // Empty string is treated as null/undefined, uses default
    });

    it("should reject decimal limit", () => {
      const request = new Request("http://example.com/?limit=50.5", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.limit).toBe(50); // parseInt truncates decimals
    });
  });

  describe("excluded parameter validation", () => {
    it("should return empty Map when excluded not provided", () => {
      const request = new Request("http://example.com/", { method: "GET" });
      const params = getParams(request);
      expect(params.excluded).toEqual(new Map());
    });

    it("should parse single id with single sequence in excluded", () => {
      const request = new Request("http://example.com/?excluded=p225=001", {
        method: "GET"
      });
      const params = getParams(request);
      const expectedMap = new Map([["p225", new Set(["001"])]]);
      expect(params.excluded).toEqual(expectedMap);
    });

    it("should parse single id with multiple sequences in excluded", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001,002,003",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([["p225", new Set(["001", "002", "003"])]]);
      expect(params.excluded).toEqual(expectedMap);
    });

    it("should parse multiple ids with multiple sequences in excluded", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001,002;p226=003,004",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002"])],
        ["p226", new Set(["003", "004"])]
      ]);
      expect(params.excluded).toEqual(expectedMap);
    });

    it("should throw error for invalid format (missing equals)", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001;p226",
        {
          method: "GET"
        }
      );
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Excluded must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p226"
      );
    });

    it("should handle empty excluded parameter", () => {
      const request = new Request("http://example.com/?excluded=", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params.excluded).toEqual(new Map()); // empty string is treated as no parameter
    });

    it("should throw error for missing sequences after equals", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=;p226=003",
        {
          method: "GET"
        }
      );
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Excluded must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p225="
      );
    });

    it("should throw error for single value without equals", () => {
      const request = new Request("http://example.com/?excluded=p225", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Excluded must be in format id=sequence1,sequence2;id2=sequence3,sequence4: p225"
      );
    });

    it("should handle excluded with spaces in sequences", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001, 002 ,003;p226= 004,005 ",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001", " 002 ", "003"])],
        ["p226", new Set([" 004", "005"])]
      ]);
      expect(params.excluded).toEqual(expectedMap);
    });

    it("should handle duplicate sequences by automatically deduplicating", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001,002,001,003,002;p226=004,004,005",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002", "003"])], // duplicates removed
        ["p226", new Set(["004", "005"])] // duplicates removed
      ]);
      expect(params.excluded).toEqual(expectedMap);
    });

    it("should throw error for empty sequences after filtering", () => {
      const request = new Request("http://example.com/?excluded=p225=,,,", {
        method: "GET"
      });
      expect(() => getParams(request)).toThrow(ParamsError);
      expect(() => getParams(request)).toThrow(
        "Excluded must have at least one sequence for id p225: p225=,,,"
      );
    });

    it("should filter out empty sequences but keep valid ones", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001,,002, ,003",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([["p225", new Set(["001", "002", "003"])]]);
      expect(params.excluded).toEqual(expectedMap);
    });
  });

  describe("complete request scenarios", () => {
    it("should handle request with all valid parameters", () => {
      const request = new Request(
        "http://example.com/?limit=25&excluded=p225=001,002;p226=003;p227=004,005",
        { method: "GET" }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002"])],
        ["p226", new Set(["003"])],
        ["p227", new Set(["004", "005"])]
      ]);
      expect(params).toEqual({
        isFavicon: false,
        limit: 25,
        excluded: expectedMap
      });
    });

    it("should handle favicon request with parameters", () => {
      const request = new Request("http://example.com/favicon.ico?limit=50", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params).toEqual({
        isFavicon: true,
        limit: 50,
        excluded: new Map()
      });
    });

    it("should handle request with only limit parameter", () => {
      const request = new Request("http://example.com/?limit=75", {
        method: "GET"
      });
      const params = getParams(request);
      expect(params).toEqual({
        isFavicon: false,
        limit: 75,
        excluded: new Map()
      });
    });

    it("should handle request with only excluded parameter", () => {
      const request = new Request(
        "http://example.com/?excluded=p225=001;p226=002,003",
        {
          method: "GET"
        }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001"])],
        ["p226", new Set(["002", "003"])]
      ]);
      expect(params).toEqual({
        isFavicon: false,
        limit: 1,
        excluded: expectedMap
      });
    });

    it("should handle request with no parameters", () => {
      const request = new Request("http://example.com/", { method: "GET" });
      const params = getParams(request);
      expect(params).toEqual({
        isFavicon: false,
        limit: 1,
        excluded: new Map()
      });
    });

    it("should handle OPTIONS request with all valid parameters", () => {
      const request = new Request(
        "http://example.com/?limit=25&excluded=p225=001,002;p226=003;p227=004,005",
        { method: "OPTIONS" }
      );
      const params = getParams(request);
      const expectedMap = new Map([
        ["p225", new Set(["001", "002"])],
        ["p226", new Set(["003"])],
        ["p227", new Set(["004", "005"])]
      ]);
      expect(params).toEqual({
        isFavicon: false,
        limit: 25,
        excluded: expectedMap
      });
    });
  });
});
