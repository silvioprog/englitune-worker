import { Context } from "hono";
import { validator } from "hono/validator";

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_EXCLUDED = new Map<string, Set<string>>();

const jsonError = (c: Context, error: string) => c.json({ error }, 400);

const validateLimit = (value: unknown, c: Context) => {
  if (!value) {
    return { limit: MIN_LIMIT };
  }
  if (typeof value !== "string") {
    return jsonError(c, `'limit' must be a number: ${value}`);
  }
  const limit = parseInt(value);
  if (Number.isNaN(limit)) {
    return jsonError(c, `'limit' must be a number: ${value}`);
  }
  if (limit < MIN_LIMIT) {
    return jsonError(c, `'limit' must be greater or equal to ${MIN_LIMIT}`);
  }
  if (limit > MAX_LIMIT) {
    return jsonError(c, `'limit' must be less or equal to ${MAX_LIMIT}`);
  }

  return { limit };
};

const validateExcluded = (value: unknown, c: Context) => {
  if (!value) {
    return { excluded: DEFAULT_EXCLUDED };
  }
  if (typeof value !== "string") {
    return jsonError(c, `'excluded' must be a string: ${value}`);
  }
  const excluded = new Map<string, Set<string>>();
  const items = value.split(";");
  for (const item of items) {
    const trimmedItem = item.trim();
    if (!trimmedItem) continue;
    const [id, sequences] = trimmedItem.split("=");
    if (!id || !sequences) {
      return jsonError(
        c,
        `'excluded' must be in format id=sequence1,sequence2;id2=sequence3,sequence4: ${item}`
      );
    }
    const sequenceArray = sequences
      .split(",")
      .map((sequence) => sequence.trim())
      .filter((sequence) => sequence !== "");
    if (sequenceArray.length === 0) {
      return jsonError(
        c,
        `'excluded' must have at least one sequence for id ${id}: ${item}`
      );
    }
    excluded.set(id, new Set(sequenceArray));
  }

  return { excluded };
};

const validators = validator("query", ({ limit, excluded }, c) => {
  const limitResult = validateLimit(limit, c);
  if (limitResult instanceof Response) {
    return limitResult;
  }
  const excludedResult = validateExcluded(excluded, c);
  if (excludedResult instanceof Response) {
    return excludedResult;
  }

  return { ...limitResult, ...excludedResult };
});

export default validators;
