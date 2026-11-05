import assert from "node:assert/strict";
import { createArchiveHandler, validateGameRecord, validateMemorySamples } from "../api/archive.js";

const gameId = "7ca3ec87-6404-47d7-a1cc-986d2c5e9c73";
const validGame = {
  id: gameId,
  createdAt: "2026-11-04T00:00:00.000Z",
  result: "in_progress",
  humanColor: "w",
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  pgn: "",
  moves: [],
  opponentVersion: "Prunex 0.8.0 browser opponent"
};
const validSample = {
  id: gameId + ":1",
  gameId,
  positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w",
  sideToMove: "w",
  moveUci: "e2e4",
  san: "e4",
  resultForMover: 1,
  evalLossCp: 0,
  grade: "BEST"
};

assert.equal(validateGameRecord(validGame), null);
assert.match(validateGameRecord({ ...validGame, humanColor: "white" }), /color/);
assert.match(validateGameRecord({ ...validGame, id: "not-a-uuid" }), /identifier/);
assert.match(validateGameRecord({ ...validGame, moves: Array(601).fill({}) }), /move list/);
assert.equal(validateMemorySamples([validSample], gameId), null);
assert.equal(validateMemorySamples([], gameId), null);
assert.match(validateMemorySamples([{ ...validSample, gameId: "another-game" }], gameId), /failed validation/);
assert.match(validateMemorySamples([{ ...validSample, moveUci: "z9e4" }], gameId), /failed validation/);
assert.match(validateMemorySamples([{ ...validSample, evalLossCp: 31 }], gameId), /failed validation/);
assert.match(validateMemorySamples(Array(2049).fill(validSample), gameId), /list is invalid/);

const ownerId = "9a3c5f8e-1c6d-4e12-9b7a-2b4f0c9d8e61";
const reviewId = "2b9b8ca7-28a9-4a7a-8a57-18f43e5c8b11";
const legacyRows = {
  prunex_games: [{
    id: gameId,
    user_id: ownerId,
    created_at: validGame.createdAt,
    result: validGame.result,
    human_color: validGame.humanColor,
    initial_fen: validGame.initialFen,
    final_fen: validGame.finalFen,
    pgn: validGame.pgn,
    moves: validGame.moves,
    opponent_version: validGame.opponentVersion
  }],
  prunex_game_reviews: [{
    id: reviewId,
    game_id: gameId,
    user_id: ownerId,
    created_at: validGame.createdAt,
    white_accuracy: 88.5,
    black_accuracy: 91.0,
    analysis_json: [],
    share_position_memory: false
  }],
  prunex_position_memory: []
};
let supabaseFetchCalls = 0;
const mockSupabase = {
  from(table) {
    let filterOwner = null;
    return {
      select() { return this; },
      eq(column, value) {
        if (column === "user_id") filterOwner = value;
        return this;
      },
      async range(start, end) {
        supabaseFetchCalls += 1;
        return {
          data: (legacyRows[table] || [])
            .filter(row => row.user_id === filterOwner)
            .slice(start, end + 1),
          error: null
        };
      }
    };
  }
};

let migrationState = false;
let ownerContext = null;
const insertCounts = { games: 0, reviews: 0, positions: 0, migrationState: 0 };
const importedGame = {
  id: gameId,
  created_at: validGame.createdAt,
  result: validGame.result,
  human_color: validGame.humanColor,
  initial_fen: validGame.initialFen,
  final_fen: validGame.finalFen,
  pgn: validGame.pgn,
  opponent_version: validGame.opponentVersion,
  moves: [],
  analysis_json: [],
  white_accuracy: 88.5,
  black_accuracy: 91.0
};
const mockClient = {
  async query(statement, params = []) {
    const sql = String(statement).replace(/\s+/g, " ").trim();
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("SELECT set_config('prunex.owner_id'")) {
      ownerContext = params[0];
      return { rows: [{ set_config: ownerContext }], rowCount: 1 };
    }
    if (sql.startsWith("SELECT user_id FROM prunex_archive.migration_state")) {
      const rows = migrationState ? [{ user_id: ownerId }] : [];
      return { rows, rowCount: rows.length };
    }
    if (sql.startsWith("INSERT INTO prunex_archive.games")) {
      assert.equal(ownerContext, ownerId, "game import must use verified owner context");
      assert.equal(params[1], ownerId, "game import must never trust a request-supplied owner");
      insertCounts.games += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO prunex_archive.game_reviews")) {
      assert.equal(ownerContext, ownerId, "review import must use verified owner context");
      assert.equal(params[2], ownerId, "review import must be owner-scoped");
      insertCounts.reviews += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO prunex_archive.position_memory")) {
      assert.equal(ownerContext, ownerId, "position import must use verified owner context");
      insertCounts.positions += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO prunex_archive.migration_state")) {
      assert.equal(ownerContext, ownerId, "migration marker must use verified owner context");
      assert.equal(params[0], ownerId);
      assert.deepEqual(params.slice(1), [1, 1, 0]);
      migrationState = true;
      insertCounts.migrationState += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT g.*, r.analysis_json, r.white_accuracy, r.black_accuracy")) {
      assert.equal(ownerContext, ownerId, "archive reads must use verified owner context");
      return { rows: [importedGame], rowCount: 1 };
    }
    throw new Error("Unexpected archive SQL in migration test: " + sql);
  },
  release() {}
};
const mockPool = { async connect() { return mockClient; } };
const archiveHandler = createArchiveHandler({
  environment: {},
  poolFactory: () => mockPool,
  authenticate: async token => {
    assert.equal(token, "verified-owner-token");
    return { user: { id: ownerId }, supabase: mockSupabase };
  },
  logger: { warn() {}, error() {} }
});
function makeResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
const archiveRequest = {
  method: "GET",
  url: "/api/archive?action=list",
  headers: {
    authorization: "Bearer verified-owner-token",
    origin: "https://prunex.example",
    host: "prunex.example"
  }
};
const firstArchiveResponse = makeResponse();
await archiveHandler(archiveRequest, firstArchiveResponse);
assert.equal(firstArchiveResponse.statusCode, 200);
assert.equal(firstArchiveResponse.body.backend, "neon");
assert.equal(firstArchiveResponse.body.data.games.length, 1);
assert.equal(firstArchiveResponse.body.data.games[0].id, gameId);
assert.deepEqual(insertCounts, { games: 1, reviews: 1, positions: 0, migrationState: 1 });
assert.equal(supabaseFetchCalls, 3, "initial import should read the three legacy owner tables");

const secondArchiveResponse = makeResponse();
await archiveHandler(archiveRequest, secondArchiveResponse);
assert.equal(secondArchiveResponse.statusCode, 200);
assert.equal(secondArchiveResponse.body.backend, "neon");
assert.deepEqual(insertCounts, { games: 1, reviews: 1, positions: 0, migrationState: 1 });
assert.equal(supabaseFetchCalls, 3, "completed legacy import must not replay on later reads");

const crossOriginResponse = makeResponse();
await archiveHandler({
  ...archiveRequest,
  headers: { ...archiveRequest.headers, origin: "https://attacker.example" }
}, crossOriginResponse);
assert.equal(crossOriginResponse.statusCode, 403, "cross-origin archive requests must be rejected");

const unauthenticatedResponse = makeResponse();
await archiveHandler({
  ...archiveRequest,
  headers: { origin: "https://prunex.example", host: "prunex.example" }
}, unauthenticatedResponse);
assert.equal(unauthenticatedResponse.statusCode, 401, "archive reads must require an authenticated owner");

console.log("Archive API: validation, owner isolation, and idempotent Supabase-to-Neon import passed.");


console.log("Archive API: input validation and owner-data shape checks passed.");
