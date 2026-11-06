import { createClient } from "@supabase/supabase-js";
import { Pool, neonConfig } from "@neondatabase/serverless";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MEMORY_GRADES = new Set(["BRILLIANT", "GREAT", "BEST", "EXCELLENT", "GOOD"]);
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const PAGE_SIZE = 500;

if (typeof globalThis.WebSocket === "function") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

let sharedPool;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) {
  throw new ApiError(status, code, message);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getPool(environment = process.env) {
  if (!environment.NEON_DATABASE_URL) {
    fail(503, "ARCHIVE_NOT_CONFIGURED", "The private archive service is not configured.");
  }
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: environment.NEON_DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true
    });
  }
  return sharedPool;
}

async function verifyOwnerIdentity(token, environment = process.env) {
  const ownerEmail = normalizeEmail(environment.PRUNEX_OWNER_EMAIL);
  const supabaseUrl = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL;
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.SUPABASE_PUBLISHABLE_KEY;
  if (!ownerEmail || !supabaseUrl || !publishableKey) {
    fail(503, "ARCHIVE_NOT_CONFIGURED", "The private owner account has not been configured.");
  }
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    fail(401, "AUTH_REQUIRED", "A valid signed-in account is required.");
  }
  const user = data.user;
  const verifiedAt = user.email_confirmed_at || user.confirmed_at;
  if (
    user.is_anonymous === true ||
    !verifiedAt ||
    normalizeEmail(user.email) !== ownerEmail
  ) {
    fail(403, "OWNER_ONLY", "Cloud archive access is limited to the verified owner account.");
  }
  return { user, supabase };
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || "";
}

function assertSameOrigin(req) {
  const origin = req.headers?.origin;
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  if (!origin || !host) return;
  let parsed;
  try { parsed = new URL(origin); } catch { fail(403, "ORIGIN_DENIED", "Cross-origin archive requests are not allowed."); }
  if (parsed.host.toLowerCase() !== String(host).toLowerCase()) {
    fail(403, "ORIGIN_DENIED", "Cross-origin archive requests are not allowed.");
  }
}

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { fail(400, "INVALID_JSON", "The request body is not valid JSON."); }
  }
  return {};
}

function validateGameRecord(record) {
  if (!record || typeof record !== "object") return "A game record is required.";
  if (!UUID_PATTERN.test(String(record.id || ""))) return "The game identifier is invalid.";
  if (!["in_progress", "white_win", "black_win", "draw"].includes(record.result)) return "The game result is invalid.";
  if (!["w", "b"].includes(record.humanColor)) return "The player's color is invalid.";
  if (typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt))) return "The game date is invalid.";
  if (typeof record.initialFen !== "string" || record.initialFen.length > 256) return "The starting position is invalid.";
  if (typeof record.finalFen !== "string" || record.finalFen.length > 256) return "The final position is invalid.";
  if (typeof record.pgn !== "string" || record.pgn.length > 250000) return "The PGN is too large.";
  if (!Array.isArray(record.moves) || record.moves.length > 600) return "The move list is invalid.";
  if (record.opponentVersion != null && (typeof record.opponentVersion !== "string" || record.opponentVersion.length > 120)) {
    return "The opponent version is invalid.";
  }
  return null;
}

function validateReviewRecord(record) {
  if (!record || typeof record !== "object" || !UUID_PATTERN.test(String(record.id || ""))) {
    return "A valid reviewed game is required.";
  }
  if (!Array.isArray(record.analysis) || record.analysis.length > 600) return "The game analysis is invalid.";
  for (const accuracy of [record.whiteAccuracy, record.blackAccuracy]) {
    if (accuracy !== null && accuracy !== undefined &&
        (!Number.isFinite(Number(accuracy)) || Number(accuracy) < 0 || Number(accuracy) > 100)) {
      return "The review accuracy is invalid.";
    }
  }
  return null;
}

function validateMemorySamples(samples, gameId) {
  if (!Array.isArray(samples) || samples.length > 2048) return "The private position-memory list is invalid.";
  for (const sample of samples) {
    if (
      !sample || typeof sample !== "object" ||
      typeof sample.id !== "string" || sample.id.length < 1 || sample.id.length > 128 ||
      sample.gameId !== gameId ||
      typeof sample.positionKey !== "string" || sample.positionKey.length < 10 || sample.positionKey.length > 100 ||
      !["w", "b"].includes(sample.sideToMove) ||
      typeof sample.moveUci !== "string" || !UCI_PATTERN.test(sample.moveUci) ||
      typeof sample.san !== "string" || sample.san.length < 1 || sample.san.length > 16 ||
      !Number.isInteger(sample.resultForMover) || ![-1, 0, 1].includes(sample.resultForMover) ||
      !Number.isInteger(sample.evalLossCp) || sample.evalLossCp < 0 || sample.evalLossCp > 30 ||
      !MEMORY_GRADES.has(sample.grade)
    ) {
      return "A private position-memory sample failed validation.";
    }
  }
  return null;
}

async function withOwnerTransaction(pool, ownerId, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // The owner id comes from Supabase's verified user record, never from the request body.
    await client.query("SELECT set_config('prunex.owner_id', $1, true)", [ownerId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function fetchAllOwnerRows(supabase, table, ownerId) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", ownerId)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function ensureLegacyImport(pool, ownerId, supabase) {
  const existing = await withOwnerTransaction(pool, ownerId, client =>
    client.query(
      "SELECT user_id FROM prunex_archive.migration_state WHERE user_id = $1",
      [ownerId]
    )
  );
  if (existing.rowCount) return;

  // Supabase RLS and the explicit user_id predicate restrict this import to the verified owner.
  const [games, reviews, positions] = await Promise.all([
    fetchAllOwnerRows(supabase, "prunex_games", ownerId),
    fetchAllOwnerRows(supabase, "prunex_game_reviews", ownerId),
    fetchAllOwnerRows(supabase, "prunex_position_memory", ownerId)
  ]);

  await withOwnerTransaction(pool, ownerId, async client => {
    for (const row of games) {
      await client.query(
        "INSERT INTO prunex_archive.games " +
        "(id,user_id,created_at,result,human_color,initial_fen,final_fen,pgn,moves,opponent_version) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) " +
        "ON CONFLICT (id) DO UPDATE SET created_at=EXCLUDED.created_at,result=EXCLUDED.result," +
        "human_color=EXCLUDED.human_color,initial_fen=EXCLUDED.initial_fen,final_fen=EXCLUDED.final_fen," +
        "pgn=EXCLUDED.pgn,moves=EXCLUDED.moves,opponent_version=EXCLUDED.opponent_version " +
        "WHERE prunex_archive.games.user_id = EXCLUDED.user_id",
        [
          row.id, ownerId, row.created_at, row.result, row.human_color, row.initial_fen,
          row.final_fen, row.pgn || "", JSON.stringify(row.moves || []),
          row.opponent_version || "Prunex 0.8.0 browser opponent"
        ]
      );
    }
    for (const row of reviews) {
      await client.query(
        "INSERT INTO prunex_archive.game_reviews " +
        "(id,game_id,user_id,created_at,white_accuracy,black_accuracy,analysis_json,include_in_private_memory) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) " +
        "ON CONFLICT (game_id,user_id) DO UPDATE SET id=EXCLUDED.id,created_at=EXCLUDED.created_at," +
        "white_accuracy=EXCLUDED.white_accuracy,black_accuracy=EXCLUDED.black_accuracy," +
        "analysis_json=EXCLUDED.analysis_json,include_in_private_memory=EXCLUDED.include_in_private_memory",
        [
          row.id, row.game_id, ownerId, row.created_at, row.white_accuracy, row.black_accuracy,
          JSON.stringify(row.analysis_json), row.share_position_memory === true
        ]
      );
    }
    for (const row of positions) {
      await client.query(
        "INSERT INTO prunex_archive.position_memory " +
        "(id,game_id,user_id,position_key,side_to_move,move_uci,san,result_for_mover,eval_loss_cp,grade,created_at) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
        "ON CONFLICT (id) DO UPDATE SET position_key=EXCLUDED.position_key," +
        "side_to_move=EXCLUDED.side_to_move,move_uci=EXCLUDED.move_uci,san=EXCLUDED.san," +
        "result_for_mover=EXCLUDED.result_for_mover,eval_loss_cp=EXCLUDED.eval_loss_cp,grade=EXCLUDED.grade " +
        "WHERE prunex_archive.position_memory.user_id = EXCLUDED.user_id",
        [
          row.id, row.game_id, ownerId, row.position_key, row.side_to_move, row.move_uci,
          row.san, row.result_for_mover, row.eval_loss_cp, row.grade, row.created_at
        ]
      );
    }
    await client.query(
      "INSERT INTO prunex_archive.migration_state " +
      "(user_id,games_imported,reviews_imported,positions_imported) VALUES ($1,$2,$3,$4) " +
      "ON CONFLICT (user_id) DO NOTHING",
      [ownerId, games.length, reviews.length, positions.length]
    );
  });
}

function mapNeonGame(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    result: row.result,
    humanColor: row.human_color,
    initialFen: row.initial_fen,
    finalFen: row.final_fen,
    pgn: row.pgn,
    opponentVersion: row.opponent_version,
    moves: Array.isArray(row.moves) ? row.moves : [],
    analysis: row.analysis_json ?? null,
    whiteAccuracy: row.white_accuracy ?? null,
    blackAccuracy: row.black_accuracy ?? null
  };
}

async function runNeonAction(pool, ownerId, action, body, query) {
  return withOwnerTransaction(pool, ownerId, async client => {
    if (action === "list") {
      const limit = Math.max(1, Math.min(50, Number.parseInt(query.limit || "12", 10) || 12));
      const result = await client.query(
        "SELECT g.*, r.analysis_json, r.white_accuracy, r.black_accuracy " +
        "FROM prunex_archive.games g " +
        "LEFT JOIN prunex_archive.game_reviews r ON r.game_id=g.id AND r.user_id=g.user_id " +
        "WHERE g.user_id=$1 ORDER BY g.created_at DESC LIMIT $2",
        [ownerId, limit]
      );
      return { games: result.rows.map(mapNeonGame) };
    }

    if (action === "positions") {
      const positionKey = String(query.positionKey || "");
      const sideToMove = String(query.sideToMove || "");
      if (positionKey.length < 10 || positionKey.length > 100 || !["w", "b"].includes(sideToMove)) {
        fail(400, "INVALID_POSITION", "The position lookup is invalid.");
      }
      const result = await client.query(
        "SELECT move_uci AS \"moveUci\", result_for_mover AS \"resultForMover\", " +
        "eval_loss_cp AS \"evalLossCp\", grade FROM prunex_archive.position_memory " +
        "WHERE user_id=$1 AND position_key=$2 AND side_to_move=$3 AND eval_loss_cp <= 30 LIMIT 60",
        [ownerId, positionKey, sideToMove]
      );
      return { samples: result.rows };
    }

    if (action === "save-game") {
      const record = body.record;
      const validationError = validateGameRecord(record);
      if (validationError) fail(400, "INVALID_GAME", validationError);
      const result = await client.query(
        "INSERT INTO prunex_archive.games " +
        "(id,user_id,created_at,result,human_color,initial_fen,final_fen,pgn,moves,opponent_version) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) " +
        "ON CONFLICT (id) DO UPDATE SET created_at=EXCLUDED.created_at,result=EXCLUDED.result," +
        "human_color=EXCLUDED.human_color,initial_fen=EXCLUDED.initial_fen,final_fen=EXCLUDED.final_fen," +
        "pgn=EXCLUDED.pgn,moves=EXCLUDED.moves,opponent_version=EXCLUDED.opponent_version " +
        "WHERE prunex_archive.games.user_id=EXCLUDED.user_id RETURNING id",
        [
          record.id, ownerId, record.createdAt, record.result, record.humanColor, record.initialFen,
          record.finalFen, record.pgn, JSON.stringify(record.moves),
          record.opponentVersion || "Prunex 0.8.0 browser opponent"
        ]
      );
      if (!result.rowCount) fail(409, "GAME_OWNERSHIP_CONFLICT", "The game identifier is already assigned to another account.");
      return { saved: true };
    }

    if (action === "save-review") {
      const record = body.record;
      const validationError = validateReviewRecord(record);
      if (validationError) fail(400, "INVALID_REVIEW", validationError);
      const samples = body.samples || [];
      const memoryError = validateMemorySamples(samples, record.id);
      if (memoryError) fail(400, "INVALID_MEMORY", memoryError);
      const game = await client.query(
        "SELECT id FROM prunex_archive.games WHERE id=$1 AND user_id=$2",
        [record.id, ownerId]
      );
      if (!game.rowCount) fail(404, "GAME_NOT_FOUND", "The game must be saved before its review.");
      await client.query(
        "INSERT INTO prunex_archive.game_reviews " +
        "(game_id,user_id,created_at,white_accuracy,black_accuracy,analysis_json,include_in_private_memory) " +
        "VALUES ($1,$2,now(),$3,$4,$5::jsonb,$6) " +
        "ON CONFLICT (game_id,user_id) DO UPDATE SET created_at=now()," +
        "white_accuracy=EXCLUDED.white_accuracy,black_accuracy=EXCLUDED.black_accuracy," +
        "analysis_json=EXCLUDED.analysis_json,include_in_private_memory=EXCLUDED.include_in_private_memory",
        [
          record.id, ownerId, record.whiteAccuracy ?? null, record.blackAccuracy ?? null,
          JSON.stringify(record.analysis), record.shareTrainingData === true
        ]
      );
      await client.query(
        "DELETE FROM prunex_archive.position_memory WHERE game_id=$1 AND user_id=$2",
        [record.id, ownerId]
      );
      if (record.shareTrainingData === true) {
        for (const sample of samples) {
          await client.query(
            "INSERT INTO prunex_archive.position_memory " +
            "(id,game_id,user_id,position_key,side_to_move,move_uci,san,result_for_mover,eval_loss_cp,grade,created_at) " +
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())",
            [
              sample.id, record.id, ownerId, sample.positionKey, sample.sideToMove,
              sample.moveUci, sample.san, sample.resultForMover, sample.evalLossCp, sample.grade
            ]
          );
        }
      }
      return { saved: true, positionSamples: record.shareTrainingData === true ? samples.length : 0 };
    }

    if (action === "delete-owner-data") {
      const result = await client.query(
        "DELETE FROM prunex_archive.games WHERE user_id=$1",
        [ownerId]
      );
      await client.query(
        "DELETE FROM prunex_archive.migration_state WHERE user_id=$1",
        [ownerId]
      );
      return { deleted: true, gamesDeleted: result.rowCount || 0 };
    }

    fail(400, "UNKNOWN_ACTION", "The archive action is not supported.");
  });
}

async function readSupabaseFallback(supabase, ownerId, action, query) {
  if (action === "list") {
    const limit = Math.max(1, Math.min(50, Number.parseInt(query.limit || "12", 10) || 12));
    const { data: games, error } = await supabase
      .from("prunex_games")
      .select("id,created_at,result,human_color,initial_fen,final_fen,pgn,moves,opponent_version")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const ids = (games || []).map(row => row.id);
    const reviewsByGame = new Map();
    if (ids.length) {
      const { data: reviews, error: reviewError } = await supabase
        .from("prunex_game_reviews")
        .select("game_id,white_accuracy,black_accuracy,analysis_json")
        .eq("user_id", ownerId)
        .in("game_id", ids)
        .order("created_at", { ascending: false });
      if (reviewError) throw reviewError;
      for (const review of reviews || []) {
        if (!reviewsByGame.has(review.game_id)) reviewsByGame.set(review.game_id, review);
      }
    }
    return {
      games: (games || []).map(row => mapNeonGame({
        ...row,
        analysis_json: reviewsByGame.get(row.id)?.analysis_json ?? null,
        white_accuracy: reviewsByGame.get(row.id)?.white_accuracy ?? null,
        black_accuracy: reviewsByGame.get(row.id)?.black_accuracy ?? null
      }))
    };
  }

  if (action === "positions") {
    const positionKey = String(query.positionKey || "");
    const sideToMove = String(query.sideToMove || "");
    if (positionKey.length < 10 || positionKey.length > 100 || !["w", "b"].includes(sideToMove)) {
      fail(400, "INVALID_POSITION", "The position lookup is invalid.");
    }
    const { data, error } = await supabase
      .from("prunex_position_memory")
      .select("move_uci,result_for_mover,eval_loss_cp,grade")
      .eq("user_id", ownerId)
      .eq("position_key", positionKey)
      .eq("side_to_move", sideToMove)
      .lte("eval_loss_cp", 30)
      .limit(60);
    if (error) throw error;
    return {
      samples: (data || []).map(row => ({
        moveUci: row.move_uci,
        resultForMover: row.result_for_mover,
        evalLossCp: row.eval_loss_cp,
        grade: row.grade
      }))
    };
  }

  fail(503, "PRIMARY_ARCHIVE_UNAVAILABLE", "The Neon archive is temporarily unavailable. New changes remain saved on this device.");
}

export function createArchiveHandler({
  environment = process.env,
  poolFactory = getPool,
  authenticate = verifyOwnerIdentity,
  logger = console
} = {}) {
  return async function archiveHandler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      assertSameOrigin(req);
      const method = String(req.method || "GET").toUpperCase();
      const url = new URL(req.url || "/", "https://" + (req.headers?.host || "localhost"));
      let action;
      let body = {};
      let query = Object.fromEntries(url.searchParams.entries());
      if (method === "GET") {
        action = query.action || "list";
      } else if (method === "POST") {
        if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers?.["content-type"] || ""))) {
          fail(415, "JSON_REQUIRED", "Archive requests must use JSON.");
        }
        const contentLength = Number(req.headers?.["content-length"] || 0);
        if (contentLength > MAX_BODY_BYTES) fail(413, "BODY_TOO_LARGE", "The archive request is too large.");
        body = getRequestBody(req);
        if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
          fail(413, "BODY_TOO_LARGE", "The archive request is too large.");
        }
        action = body.action;
      } else {
        res.status(405).json({ ok: false, error: "Method not allowed." });
        return;
      }

      const token = bearerToken(req);
      if (!token) fail(401, "AUTH_REQUIRED", "A signed-in owner session is required.");
      const { user, supabase } = await authenticate(token, environment);
      const ownerId = user.id;

      if (action === "delete-owner-data" && method !== "POST") {
        fail(405, "METHOD_NOT_ALLOWED", "Deleting archive data requires POST.");
      }
      if (action !== "delete-owner-data") {
        if (method === "POST" && action === "save-game") {
          const validationError = validateGameRecord(body.record);
          if (validationError) fail(400, "INVALID_GAME", validationError);
        } else if (method === "POST" && action === "save-review") {
          const validationError = validateReviewRecord(body.record);
          if (validationError) fail(400, "INVALID_REVIEW", validationError);
          const memoryError = validateMemorySamples(body.samples || [], body.record.id);
          if (memoryError) fail(400, "INVALID_MEMORY", memoryError);
        } else if (method === "POST") {
          fail(400, "UNKNOWN_ACTION", "The archive action is not supported.");
        }
      }

      let pool;
      try {
        pool = poolFactory(environment);
        if (action !== "delete-owner-data") {
          await ensureLegacyImport(pool, ownerId, supabase);
        }
        const data = await runNeonAction(pool, ownerId, action, body, query);
        res.status(200).json({ ok: true, backend: "neon", userId: ownerId, data });
        return;
      } catch (primaryError) {
        if (action !== "list" && action !== "positions") {
          throw primaryError;
        }
        logger.warn?.("Prunex Neon archive read failed; using the owner-scoped Supabase read fallback.", {
          name: primaryError?.name || "Error",
          code: primaryError?.code || "UNKNOWN"
        });
      }

      const fallbackData = await readSupabaseFallback(supabase, ownerId, action, query);
      res.status(200).json({
        ok: true,
        backend: "supabase-fallback",
        userId: ownerId,
        readOnly: true,
        data: fallbackData
      });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      const code = error?.code || "ARCHIVE_UNAVAILABLE";
      if (status >= 500) {
        logger.error?.("Prunex archive request failed.", {
          name: error?.name || "Error",
          code
        });
      }
      res.status(status).json({
        ok: false,
        code,
        error: error instanceof ApiError
          ? error.message
          : "The private archive is temporarily unavailable. Your game remains saved on this device."
      });
    }
  };
}

export { validateGameRecord, validateMemorySamples };
export default createArchiveHandler();
