import { describe, it, expect, vi } from "vitest";
import { getRandomTranscriptsWithSpeaker } from "../src/queries";

// Mock D1Database types for testing
interface MockD1PreparedStatement {
  bind: (...values: any[]) => MockD1PreparedStatement;
  all: <T = Record<string, any>>() => Promise<{ results: T[] }>;
}

interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
}

// Test data
const mockTranscriptData = [
  {
    transcript: "Hello, how are you today?",
    sequence: "T001",
    speaker: "101",
    age: 25,
    gender: "female",
    accent: "american",
    region: "north"
  },
  {
    transcript: "I'm doing great, thank you!",
    sequence: "T002",
    speaker: "102",
    age: 30,
    gender: "male",
    accent: "british",
    region: "south"
  },
  {
    transcript: "What about the weather?",
    sequence: "T003",
    speaker: "103",
    age: 35,
    gender: "female",
    accent: "australian"
  }
];

describe("getRandomTranscriptsWithSpeaker", () => {
  const createMockDatabase = (
    results: any[] = mockTranscriptData
  ): MockD1Database & { mockStatement: MockD1PreparedStatement } => {
    const mockStatement: MockD1PreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results })
    };

    const mockDatabase = {
      prepare: vi.fn().mockReturnValue(mockStatement),
      mockStatement
    };

    return mockDatabase;
  };

  describe("basic functionality", () => {
    it("should return transcripts with speaker data", async () => {
      const mockDb = createMockDatabase();
      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        2,
        new Map()
      );

      expect(result).toEqual(mockTranscriptData);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT")
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("FROM transcripts AS t")
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining(
          "INNER JOIN speakers AS s ON t.speaker_id = s.id"
        )
      );
    });

    it("should include LIMIT in query", async () => {
      const mockDb = createMockDatabase();
      await getRandomTranscriptsWithSpeaker(mockDb as any, 5, new Map());

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT ?")
      );
    });

    it("should include ORDER BY RANDOM() in query", async () => {
      const mockDb = createMockDatabase();
      await getRandomTranscriptsWithSpeaker(mockDb as any, 3, new Map());

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY RANDOM()")
      );
    });

    it("should select correct columns with aliases", async () => {
      const mockDb = createMockDatabase();
      await getRandomTranscriptsWithSpeaker(mockDb as any, 1, new Map());

      const query = (mockDb.prepare as any).mock.calls[0][0];
      expect(query).toContain("t.transcript");
      expect(query).toContain("t.sequence");
      expect(query).toContain("t.speaker_id AS speaker");
      expect(query).toContain("s.age");
      expect(query).toContain("s.gender");
      expect(query).toContain("s.accent");
      expect(query).toContain("s.region");
    });
  });

  describe("excluded parameter handling", () => {
    it("should not include WHERE clause when excluded map is empty", async () => {
      const mockDb = createMockDatabase();

      await getRandomTranscriptsWithSpeaker(mockDb as any, 5, new Map());

      const query = (mockDb.prepare as any).mock.calls[0][0];
      expect(query).not.toContain("WHERE");
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(5);
    });

    it("should include WHERE clause with single excluded speaker and sequence", async () => {
      const mockDb = createMockDatabase();
      const excluded = new Map([["101", new Set(["T001"])]]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 3, excluded);

      const query = (mockDb.prepare as any).mock.calls[0][0];
      expect(query).toContain(
        "WHERE NOT ((t.speaker_id = ? AND t.sequence IN (?)))"
      );
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith("101", "T001", 3);
    });

    it("should include WHERE clause with multiple excluded speakers", async () => {
      const mockDb = createMockDatabase();
      const excluded = new Map([
        ["101", new Set(["T001"])],
        ["102", new Set(["T002"])],
        ["103", new Set(["T003"])]
      ]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 2, excluded);

      const query = (mockDb.prepare as any).mock.calls[0][0];
      expect(query).toContain(
        "WHERE NOT ((t.speaker_id = ? AND t.sequence IN (?)) OR (t.speaker_id = ? AND t.sequence IN (?)) OR (t.speaker_id = ? AND t.sequence IN (?)))"
      );
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(
        "101",
        "T001",
        "102",
        "T002",
        "103",
        "T003",
        2
      );
    });

    it("should include WHERE clause with speaker having multiple excluded sequences", async () => {
      const mockDb = createMockDatabase();
      const excluded = new Map([["101", new Set(["T001", "T002", "T003"])]]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 2, excluded);

      const query = (mockDb.prepare as any).mock.calls[0][0];
      expect(query).toContain(
        "WHERE NOT ((t.speaker_id = ? AND t.sequence IN (?, ?, ?)))"
      );
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(
        "101",
        "T001",
        "T002",
        "T003",
        2
      );
    });

    it("should handle large excluded maps", async () => {
      const mockDb = createMockDatabase();
      const largeExcludedMap = new Map(
        Array.from({ length: 50 }, (_, i) => [
          `speaker${i + 1}`,
          new Set([`T${String(i + 1).padStart(3, "0")}`])
        ])
      );

      await getRandomTranscriptsWithSpeaker(mockDb as any, 1, largeExcludedMap);

      const query = (mockDb.prepare as any).mock.calls[0][0];
      const expectedConditions = Array.from(
        { length: 50 },
        () => "(t.speaker_id = ? AND t.sequence IN (?))"
      ).join(" OR ");
      expect(query).toContain(`WHERE NOT (${expectedConditions})`);
      const expectedParams = Array.from({ length: 50 }, (_, i) => [
        `speaker${i + 1}`,
        `T${String(i + 1).padStart(3, "0")}`
      ]).flat();
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(
        ...expectedParams,
        1
      );
    });
  });

  describe("parameter binding", () => {
    it("should bind limit when no excluded IDs", async () => {
      const mockDb = createMockDatabase();

      await getRandomTranscriptsWithSpeaker(mockDb as any, 7, new Map());

      expect(mockDb.mockStatement.bind).toHaveBeenCalledTimes(1);
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(7);
    });

    it("should bind excluded speakers and sequences followed by limit", async () => {
      const mockDb = createMockDatabase();
      const excluded = new Map([
        ["101", new Set(["T001"])],
        ["102", new Set(["T002"])],
        ["103", new Set(["T003"])]
      ]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 4, excluded);

      expect(mockDb.mockStatement.bind).toHaveBeenCalledTimes(1);
      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(
        "101",
        "T001",
        "102",
        "T002",
        "103",
        "T003",
        4
      );
    });
  });

  describe("return value handling", () => {
    it("should return empty array when no results", async () => {
      const mockDb = createMockDatabase([]);

      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        5,
        new Map()
      );

      expect(result).toEqual([]);
    });

    it("should return single result", async () => {
      const singleResult = [mockTranscriptData[0]];
      const mockDb = createMockDatabase(singleResult);

      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        1,
        new Map()
      );

      expect(result).toEqual(singleResult);
      expect(result).toHaveLength(1);
    });

    it("should return multiple results", async () => {
      const mockDb = createMockDatabase(mockTranscriptData);

      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        3,
        new Map()
      );

      expect(result).toEqual(mockTranscriptData);
      expect(result).toHaveLength(3);
    });

    it("should preserve all transcript properties", async () => {
      const mockDb = createMockDatabase([mockTranscriptData[0]]);

      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        1,
        new Map()
      );

      expect(result[0]).toHaveProperty(
        "transcript",
        "Hello, how are you today?"
      );
      expect(result[0]).toHaveProperty("sequence", "T001");
      expect(result[0]).toHaveProperty("speaker", "101");
      expect(result[0]).toHaveProperty("age", 25);
      expect(result[0]).toHaveProperty("gender", "female");
      expect(result[0]).toHaveProperty("accent", "american");
      expect(result[0]).toHaveProperty("region", "north");
    });

    it("should handle optional region field", async () => {
      const resultWithoutRegion = [
        {
          ...mockTranscriptData[2],
          region: undefined
        }
      ];
      const mockDb = createMockDatabase(resultWithoutRegion);

      const result = await getRandomTranscriptsWithSpeaker(
        mockDb as any,
        1,
        new Map()
      );

      expect(result[0]).toHaveProperty("region", undefined);
    });
  });

  describe("edge cases", () => {
    it("should handle limit of 0", async () => {
      const mockDb = createMockDatabase([]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 0, new Map());

      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(0);
    });

    it("should handle duplicate excluded sequences (automatically deduplicated by Set)", async () => {
      const mockDb = createMockDatabase();
      const excluded = new Map([
        ["101", new Set(["T001", "T001", "T001"])] // Set automatically deduplicates
      ]);

      await getRandomTranscriptsWithSpeaker(mockDb as any, 1, excluded);

      expect(mockDb.mockStatement.bind).toHaveBeenCalledWith(
        "101",
        "T001", // Only one T001 because Set deduplicates
        1
      );
    });
  });

  describe("database error handling", () => {
    it("should propagate database errors", async () => {
      const mockStatement: MockD1PreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error("Database connection failed"))
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStatement)
      };

      await expect(
        getRandomTranscriptsWithSpeaker(mockDb as any, 1, new Map())
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle SQL syntax errors", async () => {
      const mockStatement: MockD1PreparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error("SQL syntax error"))
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStatement)
      };

      const excluded = new Map([
        ["101", new Set(["T001"])],
        ["102", new Set(["T002"])]
      ]);

      await expect(
        getRandomTranscriptsWithSpeaker(mockDb as any, 5, excluded)
      ).rejects.toThrow("SQL syntax error");
    });
  });
});
