import type {
  CareerStats,
  Honors,
  PlayerResume,
} from "@/features/ranking/domain/player";

const CATALOG_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
type PoolSize = 25 | 50 | 100;

export interface PlayerCatalog {
  readonly catalogId: string;
  readonly asOf: string;
  readonly playersById: ReadonlyMap<string, PlayerResume>;
  readonly playerIdsByPool: Readonly<
    Record<PoolSize, readonly string[]>
  >;
}

const catalogCache = new Map<string, Promise<PlayerCatalog>>();

export async function loadCurrentCatalog(
  signal?: AbortSignal,
): Promise<PlayerCatalog> {
  const pointer = await fetchJson("/data/current.json", signal);
  if (!isRecord(pointer)) {
    throw new Error("Current catalog pointer is invalid.");
  }
  const catalogId = requiredString(pointer, "catalog_id");
  return loadCatalog(catalogId, signal);
}

export function loadCatalog(
  catalogId: string,
  signal?: AbortSignal,
): Promise<PlayerCatalog> {
  assertCatalogId(catalogId);
  const cached = catalogCache.get(catalogId);
  if (cached !== undefined) return cached;
  const loading = loadCatalogFiles(catalogId, signal).catch((error) => {
    catalogCache.delete(catalogId);
    throw error;
  });
  catalogCache.set(catalogId, loading);
  return loading;
}

export function clearCatalogCacheForTests(): void {
  catalogCache.clear();
}

async function loadCatalogFiles(
  catalogId: string,
  signal?: AbortSignal,
): Promise<PlayerCatalog> {
  const base = `/data/catalogs/${catalogId}`;
  const [playersPayload, poolsPayload] = await Promise.all([
    fetchJson(`${base}/players.json`, signal),
    fetchJson(`${base}/pools.json`, signal),
  ]);
  return parseCatalog(catalogId, playersPayload, poolsPayload);
}

async function fetchJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load catalog (${response.status}).`);
  }
  return response.json() as Promise<unknown>;
}

function parseCatalog(
  expectedCatalogId: string,
  playersPayload: unknown,
  poolsPayload: unknown,
): PlayerCatalog {
  if (!isRecord(playersPayload) || !isRecord(poolsPayload)) {
    throw new Error("Catalog payload is invalid.");
  }
  assertMatchingCatalogId(expectedCatalogId, playersPayload);
  assertMatchingCatalogId(expectedCatalogId, poolsPayload);
  const asOf = requiredString(playersPayload, "as_of");
  const playerRecords = playersPayload.players;
  if (!Array.isArray(playerRecords)) {
    throw new Error("Catalog players must be an array.");
  }

  const players = playerRecords.map((record) =>
    parsePlayer(expectedCatalogId, asOf, record),
  );
  const playersById = new Map(
    players.map((player) => [player.id, player]),
  );
  if (playersById.size !== players.length) {
    throw new Error("Catalog player IDs must be unique.");
  }

  const poolsRecord = poolsPayload.pools;
  if (!isRecord(poolsRecord)) {
    throw new Error("Catalog pools are invalid.");
  }
  const playerIdsByPool = {
    25: parsePool(poolsRecord, 25, playersById),
    50: parsePool(poolsRecord, 50, playersById),
    100: parsePool(poolsRecord, 100, playersById),
  };
  assertNestedPools(playerIdsByPool);
  if (players.length !== 100) {
    throw new Error("Published catalog must contain exactly 100 players.");
  }

  return {
    catalogId: expectedCatalogId,
    asOf,
    playersById,
    playerIdsByPool,
  };
}

function parsePlayer(
  catalogId: string,
  catalogAsOf: string,
  value: unknown,
): PlayerResume {
  if (!isRecord(value)) {
    throw new Error("Catalog player is invalid.");
  }
  const id = requiredString(value, "id");
  const asOf = requiredString(value, "as_of");
  if (asOf !== catalogAsOf) {
    throw new Error(`${id} has a mismatched catalog date.`);
  }
  const imagePath = requiredString(value, "image_path");
  const expectedPrefix = `/assets/catalogs/${catalogId}/players/`;
  if (
    !imagePath.startsWith(expectedPrefix) ||
    imagePath.slice(expectedPrefix.length).includes("/")
  ) {
    throw new Error(`${id} has a non-canonical image path.`);
  }
  return {
    id,
    name: requiredString(value, "name"),
    era: requiredString(value, "era"),
    seasons: positiveInteger(value, "seasons"),
    regularSeason: parseStats(value.regular_season, true),
    playoffs: parseStats(value.playoffs, false),
    honors: parseHonors(value.honors),
    imagePath,
    asOf,
    sourceNote: requiredString(value, "source_note"),
  };
}

function parseStats(value: unknown, requireGames: boolean): CareerStats {
  if (!isRecord(value)) {
    throw new Error("Career statistics are invalid.");
  }
  return {
    games: requireGames
      ? positiveInteger(value, "games")
      : nonNegativeInteger(value, "games"),
    ppg: nullableNonNegativeNumber(value, "ppg"),
    rpg: nullableNonNegativeNumber(value, "rpg"),
    apg: nullableNonNegativeNumber(value, "apg"),
    spg: nullableNonNegativeNumber(value, "spg"),
    bpg: nullableNonNegativeNumber(value, "bpg"),
    fgPct: nullablePercentage(value, "fg_pct"),
    threePct: nullablePercentage(value, "three_pct"),
    ftPct: nullablePercentage(value, "ft_pct"),
  };
}

function parseHonors(value: unknown): Honors {
  if (!isRecord(value)) {
    throw new Error("Player honors are invalid.");
  }
  const honors: Honors = {
    mvp: nonNegativeInteger(value, "mvp"),
    allNba: nonNegativeInteger(value, "all_nba"),
    dpoy: nullableNonNegativeInteger(value, "dpoy"),
    championships: nonNegativeInteger(value, "championships"),
    finalsMvp: nullableNonNegativeInteger(value, "finals_mvp"),
  };
  if (
    honors.finalsMvp !== null &&
    honors.finalsMvp > honors.championships
  ) {
    throw new Error("Finals MVP count cannot exceed championships.");
  }
  return honors;
}

function parsePool(
  pools: Record<string, unknown>,
  poolSize: PoolSize,
  playersById: ReadonlyMap<string, PlayerResume>,
): readonly string[] {
  const value = pools[String(poolSize)];
  if (
    !Array.isArray(value) ||
    value.length !== poolSize ||
    !value.every((playerId) => typeof playerId === "string")
  ) {
    throw new Error(`Candidate pool ${poolSize} has an invalid size.`);
  }
  const playerIds = value;
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error(`Candidate pool ${poolSize} has duplicate players.`);
  }
  if (playerIds.some((playerId) => !playersById.has(playerId))) {
    throw new Error(`Candidate pool ${poolSize} has an unknown player.`);
  }
  return [...playerIds];
}

function assertNestedPools(
  pools: Readonly<Record<PoolSize, readonly string[]>>,
): void {
  const fifty = new Set(pools[50]);
  const oneHundred = new Set(pools[100]);
  if (pools[25].some((playerId) => !fifty.has(playerId))) {
    throw new Error("Candidate pool 25 must be nested in pool 50.");
  }
  if (pools[50].some((playerId) => !oneHundred.has(playerId))) {
    throw new Error("Candidate pool 50 must be nested in pool 100.");
  }
}

function assertMatchingCatalogId(
  expected: string,
  payload: Record<string, unknown>,
): void {
  if (requiredString(payload, "catalog_id") !== expected) {
    throw new Error("Catalog payload ID does not match its directory.");
  }
}

function assertCatalogId(catalogId: string): void {
  if (!CATALOG_ID_PATTERN.test(catalogId)) {
    throw new Error("Catalog ID has an invalid format.");
  }
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value;
}

function positiveInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value as number;
}

function nonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${key} must be a non-negative integer.`);
  }
  return value as number;
}

function nullableNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  requireKey(record, key);
  if (record[key] === null) return null;
  return nonNegativeInteger(record, key);
}

function nullableNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  requireKey(record, key);
  const value = record[key];
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(`${key} must be a non-negative number or null.`);
  }
  return value;
}

function nullablePercentage(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = nullableNonNegativeNumber(record, key);
  if (value !== null && value > 100) {
    throw new Error(`${key} must be between 0 and 100 or null.`);
  }
  return value;
}

function requireKey(
  record: Record<string, unknown>,
  key: string,
): void {
  if (!(key in record)) {
    throw new Error(`${key} is required.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
