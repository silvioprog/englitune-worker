export interface TranscriptWithSpeaker {
  transcript: string;
  sequence: string;
  speaker: string;
  age: number;
  gender: string;
  accent: string;
  region?: string;
}

const getRandomTranscriptsWithSpeakerWhereClause = (
  excluded: Map<string, Set<string>>
) => {
  if (excluded.size === 0) {
    return "";
  }
  const conditions = Array.from(excluded.entries())
    .filter(([, sequences]) => sequences.size > 0)
    .map(([, sequences]) => {
      const placeholders = Array.from(
        { length: sequences.size },
        () => "?"
      ).join(", ");
      return `(t.speaker_id = ? AND t.sequence IN (${placeholders}))`;
    });
  if (conditions.length === 0) {
    return "";
  }
  return `WHERE NOT (${conditions.join(" OR ")})`;
};

export const getRandomTranscriptsWithSpeaker = async (
  db: D1Database,
  limit: number,
  excluded: Map<string, Set<string>>
): Promise<TranscriptWithSpeaker[]> => {
  const prepared = db.prepare(`
    SELECT
      t.transcript,
      t.sequence,
      t.speaker_id AS speaker,
      s.age,
      s.gender,
      s.accent,
      s.region
    FROM transcripts AS t
    INNER JOIN speakers AS s ON t.speaker_id = s.id
    ${getRandomTranscriptsWithSpeakerWhereClause(excluded)}
    ORDER BY RANDOM()
    LIMIT ?;
  `);
  const validEntries = Array.from(excluded.entries()).filter(
    ([, sequences]) => sequences.size > 0
  );
  const stmt =
    validEntries.length > 0
      ? prepared.bind(
          ...validEntries.flatMap(([speakerId, sequences]) => [
            speakerId,
            ...Array.from(sequences)
          ]),
          limit
        )
      : prepared.bind(limit);
  const { results } = await stmt.all<TranscriptWithSpeaker>();
  return results;
};
