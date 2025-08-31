const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_EXCLUDED = new Map<string, Set<string>>();

export class ParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

interface Params {
  isFavicon: boolean;
  limit: number;
  excluded: Map<string, Set<string>>;
}

const checkMethod = (method: string): void => {
  const allowedMethods = ["GET", "OPTIONS"];
  if (!allowedMethods.includes(method.toUpperCase())) {
    throw new ParamsError("Method must be GET");
  }
};

const isFavicon = (path: string) => path.toLowerCase() === "/favicon.ico";

const checkPath = (path: string): void => {
  if (path !== "/" && !isFavicon(path)) {
    throw new ParamsError("Path must be /");
  }
};

const validateLimit = (limit: string | null): number => {
  if (!limit) {
    return MIN_LIMIT;
  }
  const limitNumber = parseInt(limit);
  if (Number.isNaN(limitNumber)) {
    throw new ParamsError(`Limit must be a number: ${limit}`);
  }
  if (limitNumber < MIN_LIMIT) {
    throw new ParamsError(`Limit must be greater or equal to ${MIN_LIMIT}`);
  }
  if (limitNumber > MAX_LIMIT) {
    throw new ParamsError(`Limit must be less or equal to ${MAX_LIMIT}`);
  }
  return limitNumber;
};

const validateExcluded = (
  excluded: string | null
): Map<string, Set<string>> => {
  if (!excluded) {
    return DEFAULT_EXCLUDED;
  }
  return excluded.split(";").reduce((acc, item) => {
    const [id, sequences] = item.split("=");
    if (!id || !sequences) {
      throw new ParamsError(
        `Excluded must be in format id=sequence1,sequence2;id2=sequence3,sequence4: ${item}`
      );
    }
    const sequenceArray = sequences
      .split(",")
      .filter((sequence) => sequence.trim() !== "");
    if (sequenceArray.length === 0) {
      throw new ParamsError(
        `Excluded must have at least one sequence for id ${id}: ${item}`
      );
    }
    acc.set(id, new Set(sequenceArray));
    return acc;
  }, new Map<string, Set<string>>());
};

export const getParams = (request: Request): Params => {
  const url = new URL(request.url);
  checkMethod(request.method);
  checkPath(url.pathname);
  return {
    isFavicon: isFavicon(url.pathname),
    limit: validateLimit(url.searchParams.get("limit")),
    excluded: validateExcluded(url.searchParams.get("excluded"))
  };
};
