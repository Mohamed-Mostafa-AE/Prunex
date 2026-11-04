const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const MAX_BODY_BYTES = 1_000_000;
const MAX_GAMES_PER_PAGE = 100;
const MAX_MEMORY_SAMPLES = 2048;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MEMORY_GRADES = new Set(["BRILLIANT", "GREAT", "BEST", "EXCELLENT", "GOOD"]);
const GAME_RESULTS = new Set(["white_win", "black_win", "draw", "in_progress"]);

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "")
    .split(",").map(value => value.trim()).filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,apikey",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
}

function parseJsonColumn(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function validateGameRecord(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return "A game record is required.";
  if (typeof game.id !== "string" || game.id.length < 1 || game.id.length > 128) return "Invalid game ID.";
  if (!GAME_RESULTS.has(game.result)) return "Invalid game result.";
  if (game.humanColor !== "w" && game.humanColor !== "b") return "Invalid player colour.";
  if (typeof game.createdAt !== "string" || game.createdAt.length > 64 || Number.isNaN(Date.parse(game.createdAt))) return "Invalid game timestamp.";
  if (typeof game.initialFen !== "string" || game.initialFen.length < 10 || game.initialFen.length > 256) return "Invalid initial FEN.";
  if (typeof game.finalFen !== "string" || game.finalFen.length < 10 || game.finalFen.length > 256) return "Invalid final FEN.";
  if (typeof game.pgn !== "string" || game.pgn.length > 200_000) return "Invalid PGN.";
  if (!Array.isArray(game.moves) || game.moves.length > 600) return "Invalid move list.";
  if (game.opponentVersion !== undefined && (typeof game.opponentVersion !== "string" || game.opponentVersion.length > 128)) return "Invalid opponent version.";
  return null;
}

export function validateMemorySamples(samples) {
  if (!Array.isArray(samples) || samples.length > MAX_MEMORY_SAMPLES) return "Invalid shared-position sample list.";
  for (const sample of samples) {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) return "Invalid shared-position sample.";
    if (typeof sample.id !== "string" || sample.id.length < 1 || sample.id.length > 128) return "Invalid shared-position sample ID.";
    if (typeof sample.positionKey !== "string" || sample.positionKey.length < 10 || sample.positionKey.length > 100) return "Invalid position key.";
    if (sample.sideToMove !== "w" && sample.sideToMove !== "b") return "Invalid side to move.";
    if (typeof sample.moveUci !== "string" || !UCI_PATTERN.test(sample.moveUci)) return "Invalid UCI move.";
    if (typeof sample.san !== "string" || sample.san.length < 1 || sample.san.length > 16) return "Invalid SAN move.";
    if (!Number.isInteger(sample.resultForMover) || ![-1, 0, 1].includes(sample.resultForMover)) return "Invalid result value.";
    if (!Number.isInteger(sample.evalLossCp) || sample.evalLossCp < 0 || sample.evalLossCp > 30) return "Invalid evaluation loss.";
    if (!MEMORY_GRADES.has(sample.grade)) return "Invalid move grade.";
  }
  return null;
}

async function authenticate(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return { error: "Authentication is required.", status: 401 };
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return { error: "Authentication is not configured.", status: 503 };

  let authResponse;
  try {
    authResponse = await fetch(new URL("/auth/v1/user", env.SUPABASE_URL), {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: authorization
      }
    });
  } catch {
    return { error: "The identity service is temporarily unavailable.", status: 503 };
  }

  if (authResponse.status === 401 || authResponse.status === 403) {
    return { error: "Your session is invalid or expired.", status: 401 };
  }
  if (!authResponse.ok) return { error: "Could not verify the current session.", status: 503 };

  const user = await authResponse.json();
  if (!user || typeof user.id !== "string" || user.id.length > 64) {
    return { error: "The identity service returned an invalid user.", status: 401 };
  }
  return { user, accessToken: authorization.slice(7) };
}

function gameRow(game, userId) {
  return {
    id: game.id,
    user_id: userId,
    created_at: game.createdAt,
    result: game.result,
    human_color: game.humanColor,
    initial_fen: game.initialFen,
    final_fen: game.finalFen,
    pgn: game.pgn,
    moves_json: JSON.stringify(game.moves),
    opponent_version: game.opponentVersion || "Prunex 0.8.0 browser opponent"
  };
}

function gameStatement(db, game, userId) {
  const row = gameRow(game, userId);
  return db.prepare(`
    INSERT INTO prunex_games (
      id, user_id, created_at, result, human_color, initial_fen,
      final_fen, pgn, moves_json, opponent_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      created_at = excluded.created_at,
      result = excluded.result,
      human_color = excluded.human_color,
      initial_fen = excluded.initial_fen,
      final_fen = excluded.final_fen,
      pgn = excluded.pgn,
      moves_json = excluded.moves_json,
      opponent_version = excluded.opponent_version
    WHERE prunex_games.user_id = excluded.user_id
  `).bind(
    row.id, row.user_id, row.created_at, row.result, row.human_color,
    row.initial_fen, row.final_fen, row.pgn, row.moves_json, row.opponent_version
  );
}

function mirrorQueueStatement(db, userId, eventType, payload) {
  return db.prepare(`
    INSERT INTO prunex_mirror_outbox (id, user_id, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, eventType, JSON.stringify(payload), new Date().toISOString());
}

function supabaseHeaders(env, token, extra = {}) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
    ...extra
  };
}

async function supabaseRequest(env, token, path, body) {
  const url = new URL(path, env.SUPABASE_URL);
  const result = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env, token),
    body: JSON.stringify(body)
  });
  if (!result.ok) {
    const message = (await result.text()).slice(0, 500);
    throw new Error(`Supabase mirror returned ${result.status}: ${message}`);
  }
}

async function mirrorEvent(env, token, eventType, payload) {
  if (eventType === "game_upsert") {
    await supabaseRequest(env, token, "/rest/v1/prunex_games?on_conflict=id", payload.game);
    return;
  }
  if (eventType === "review_bundle") {
    await supabaseRequest(env, token, "/rest/v1/prunex_games?on_conflict=id", payload.game);
    await supabaseRequest(env, token, "/rest/v1/prunex_game_reviews?on_conflict=game_id,user_id", payload.review);
    const rpcResponse = await fetch(new URL("/rest/v1/rpc/replace_my_position_memory_for_game", env.SUPABASE_URL), {
      method: "POST",
      headers: supabaseHeaders(env, token),
      body: JSON.stringify({
        target_game_id: payload.game.id,
        position_samples: payload.samples
      })
    });
    if (!rpcResponse.ok) {
      const message = (await rpcResponse.text()).slice(0, 500);
      throw new Error(`Supabase position-memory mirror returned ${rpcResponse.status}: ${message}`);
    }
    return;
  }
  throw new Error("Unsupported mirror event.");
}

async function flushMirrorQueue(db, env, userId, token, maximum = 5) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return { pending: -1, error: "Mirror is not configured." };
  const queued = await db.prepare(`
    SELECT id, event_type, payload_json, attempts
    FROM prunex_mirror_outbox
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(userId, maximum).all();

  let lastError = "";
  for (const event of queued.results || []) {
    try {
      await mirrorEvent(env, token, event.event_type, JSON.parse(event.payload_json));
      await db.prepare("DELETE FROM prunex_mirror_outbox WHERE id = ? AND user_id = ?")
        .bind(event.id, userId).run();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await db.prepare(`
        UPDATE prunex_mirror_outbox
        SET attempts = attempts + 1, last_error = ?
        WHERE id = ? AND user_id = ?
      `).bind(lastError.slice(0, 500), event.id, userId).run();
      break;
    }
  }

  const pending = await db.prepare("SELECT COUNT(*) AS count FROM prunex_mirror_outbox WHERE user_id = ?")
    .bind(userId).first();
  return { pending: Number(pending?.count || 0), error: lastError };
}

function responseWithCors(body, status, cors) {
  return response(body, status, cors);
}

async function handleApi(request, env, user, token, cors) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/v1/games" && request.method === "GET") {
    const limit = Math.max(1, Math.min(MAX_GAMES_PER_PAGE, Number(url.searchParams.get("limit") || 20)));
    const rows = await env.DB.prepare(`
      SELECT
        games.id, games.created_at, games.result, games.human_color,
        games.initial_fen, games.final_fen, games.pgn, games.moves_json,
        games.opponent_version,
        reviews.analysis_json, reviews.white_accuracy, reviews.black_accuracy,
        reviews.share_position_memory
      FROM prunex_games AS games
      LEFT JOIN prunex_game_reviews AS reviews
        ON reviews.game_id = games.id AND reviews.user_id = games.user_id
      WHERE games.user_id = ?
      ORDER BY games.created_at DESC
      LIMIT ?
    `).bind(user.id, limit).all();

    const mirror = await flushMirrorQueue(env.DB, env, user.id, token);
    const games = (rows.results || []).map(row => ({
      id: row.id,
      createdAt: row.created_at,
      result: row.result,
      humanColor: row.human_color,
      initialFen: row.initial_fen,
      finalFen: row.final_fen,
      pgn: row.pgn,
      moves: parseJsonColumn(row.moves_json, []),
      opponentVersion: row.opponent_version,
      analysis: row.analysis_json ? parseJsonColumn(row.analysis_json, null) : null,
      whiteAccuracy: row.white_accuracy,
      blackAccuracy: row.black_accuracy,
      shareTrainingData: row.share_position_memory === 1
    }));
    return responseWithCors({ games, mirrorStatus: mirror.pending === 0 ? "synced" : "pending", mirrorPending: mirror.pending }, 200, cors);
  }

  if (path === "/v1/games" && request.method === "POST") {
    const body = await readJson(request);
    const invalid = validateGameRecord(body?.game);
    if (invalid) return responseWithCors({ error: invalid }, 400, cors);
    const game = body.game;
    const statement = gameStatement(env.DB, game, user.id);
    const queued = mirrorQueueStatement(env.DB, user.id, "game_upsert", {
      game: {
        id: game.id,
        user_id: user.id,
        created_at: game.createdAt,
        result: game.result,
        human_color: game.humanColor,
        initial_fen: game.initialFen,
        final_fen: game.finalFen,
        pgn: game.pgn,
        moves: game.moves,
        opponent_version: game.opponentVersion || "Prunex 0.8.0 browser opponent"
      }
    });
    const results = await env.DB.batch([statement, queued]);
    if (Number(results[0]?.meta?.changes || 0) === 0) {
      return responseWithCors({ error: "This game ID is already owned by another account." }, 409, cors);
    }
    const mirror = await flushMirrorQueue(env.DB, env, user.id, token, 1);
    return responseWithCors({
      success: true,
      mirrorStatus: mirror.pending === 0 ? "synced" : "pending",
      mirrorPending: mirror.pending
    }, 200, cors);
  }

  if (path === "/v1/reviews" && request.method === "POST") {
    const body = await readJson(request);
    const invalid = validateGameRecord(body?.game);
    if (invalid) return responseWithCors({ error: invalid }, 400, cors);
    const review = body?.review;
    if (!review || typeof review !== "object" || Array.isArray(review)) {
      return responseWithCors({ error: "A review record is required." }, 400, cors);
    }
    if (!("analysis" in review) || JSON.stringify(review.analysis).length > 700_000) {
      return responseWithCors({ error: "Invalid or oversized review analysis." }, 400, cors);
    }
    for (const accuracy of [review.whiteAccuracy, review.blackAccuracy]) {
      if (accuracy !== null && accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100)) {
        return responseWithCors({ error: "Review accuracy must be between 0 and 100." }, 400, cors);
      }
    }
    const share = review.sharePositionMemory === true;
    const samples = share ? (body.samples || []) : [];
    const sampleError = validateMemorySamples(samples);
    if (sampleError) return responseWithCors({ error: sampleError }, 400, cors);

    const reviewId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const game = body.game;
    const gameUpsert = gameStatement(env.DB, game, user.id);
    const reviewUpsert = env.DB.prepare(`
      INSERT INTO prunex_game_reviews (
        id, game_id, user_id, created_at, white_accuracy, black_accuracy,
        analysis_json, share_position_memory
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id, user_id) DO UPDATE SET
        created_at = excluded.created_at,
        white_accuracy = excluded.white_accuracy,
        black_accuracy = excluded.black_accuracy,
        analysis_json = excluded.analysis_json,
        share_position_memory = excluded.share_position_memory
    `).bind(
      reviewId, game.id, user.id, createdAt,
      review.whiteAccuracy ?? null, review.blackAccuracy ?? null,
      JSON.stringify(review.analysis), share ? 1 : 0
    );
    const replaceSamples = env.DB.prepare("DELETE FROM prunex_position_memory WHERE game_id = ? AND user_id = ?")
      .bind(game.id, user.id);
    const insertSamples = env.DB.prepare(`
      INSERT INTO prunex_position_memory (
        id, game_id, user_id, position_key, side_to_move, move_uci, san,
        result_for_mover, eval_loss_cp, grade, created_at
      )
      SELECT
        json_extract(value, '$.id'), ?, ?,
        json_extract(value, '$.positionKey'), json_extract(value, '$.sideToMove'),
        json_extract(value, '$.moveUci'), json_extract(value, '$.san'),
        json_extract(value, '$.resultForMover'), json_extract(value, '$.evalLossCp'),
        json_extract(value, '$.grade'), ?
      FROM json_each(?)
    `).bind(game.id, user.id, createdAt, JSON.stringify(samples));
    const queue = mirrorQueueStatement(env.DB, user.id, "review_bundle", {
      game: {
        id: game.id,
        user_id: user.id,
        created_at: game.createdAt,
        result: game.result,
        human_color: game.humanColor,
        initial_fen: game.initialFen,
        final_fen: game.finalFen,
        pgn: game.pgn,
        moves: game.moves,
        opponent_version: game.opponentVersion || "Prunex 0.8.0 browser opponent"
      },
      review: {
        game_id: game.id,
        user_id: user.id,
        created_at: createdAt,
        white_accuracy: review.whiteAccuracy ?? null,
        black_accuracy: review.blackAccuracy ?? null,
        analysis_json: review.analysis,
        share_position_memory: share
      },
      samples: samples.map(sample => ({
        position_key: sample.positionKey,
        side_to_move: sample.sideToMove,
        move_uci: sample.moveUci,
        san: sample.san,
        result_for_mover: sample.resultForMover,
        eval_loss_cp: sample.evalLossCp,
        grade: sample.grade
      }))
    });

    const results = await env.DB.batch([gameUpsert, reviewUpsert, replaceSamples, insertSamples, queue]);
    if (Number(results[0]?.meta?.changes || 0) === 0) {
      return responseWithCors({ error: "This game ID is already owned by another account." }, 409, cors);
    }
    const mirror = await flushMirrorQueue(env.DB, env, user.id, token, 1);
    return responseWithCors({
      success: true,
      memorySamples: samples.length,
      mirrorStatus: mirror.pending === 0 ? "synced" : "pending",
      mirrorPending: mirror.pending
    }, 200, cors);
  }

  if (path === "/v1/positions" && request.method === "GET") {
    const positionKey = url.searchParams.get("positionKey") || "";
    const sideToMove = url.searchParams.get("sideToMove") || "";
    if (positionKey.length < 10 || positionKey.length > 100 || !["w", "b"].includes(sideToMove)) {
      return responseWithCors({ error: "Invalid position lookup." }, 400, cors);
    }
    const rows = await env.DB.prepare(`
      SELECT memory.move_uci, memory.result_for_mover, memory.eval_loss_cp, memory.grade
      FROM prunex_position_memory AS memory
      INNER JOIN prunex_game_reviews AS reviews
        ON reviews.game_id = memory.game_id AND reviews.user_id = memory.user_id
      WHERE memory.position_key = ?
        AND memory.side_to_move = ?
        AND memory.eval_loss_cp <= 30
        AND reviews.share_position_memory = 1
      ORDER BY memory.eval_loss_cp ASC, memory.created_at DESC
      LIMIT 60
    `).bind(positionKey, sideToMove).all();
    return responseWithCors({ samples: rows.results || [] }, 200, cors);
  }

  if (path === "/v1/account" && request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM prunex_mirror_outbox WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM prunex_games WHERE user_id = ?").bind(user.id)
    ]);
    return responseWithCors({ success: true }, 200, cors);
  }

  if (path === "/v1/mirror-status" && request.method === "GET") {
    const mirror = await flushMirrorQueue(env.DB, env, user.id, token);
    return responseWithCors({
      status: mirror.pending === 0 ? "synced" : "pending",
      pending: mirror.pending,
      lastError: mirror.error || ""
    }, 200, cors);
  }

  return responseWithCors({ error: "Not found." }, 404, cors);
}

export async function handleFetch(request, env) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins(env).has(origin)) return response({ error: "Origin not allowed." }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    try {
      await env.DB.prepare("SELECT 1 AS healthy").first();
      return response({ status: "ok", service: "prunex-archive-primary", database: "reachable" });
    } catch {
      return response({ status: "unavailable", database: "unreachable" }, 503);
    }
  }

  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins(env).has(origin)) return response({ error: "Origin not allowed." }, 403);
  if (!url.pathname.startsWith("/v1/")) return response({ error: "Not found." }, 404);

  const auth = await authenticate(request, env);
  if (auth.error) return responseWithCors({ error: auth.error }, auth.status, cors);

  try {
    return await handleApi(request, env, auth.user, auth.accessToken, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected archive error.";
    if (/body|invalid|too large|accuracy|sample|game|review|position/i.test(message)) {
      return responseWithCors({ error: message }, 400, cors);
    }
    console.error("Prunex archive API error:", message);
    return responseWithCors({ error: "The primary archive is temporarily unavailable." }, 503, cors);
  }
}
