import { createClient } from "@supabase/supabase-js";

const DB_NAME = "prunex-game-archive";
const DB_VERSION = 1;

function openLocalDatabase() {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("This browser does not support the local game archive."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("games")) {
        const games = db.createObjectStore("games", { keyPath: "id" });
        games.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("position_memory")) {
        const positions = db.createObjectStore("position_memory", { keyPath: "id" });
        positions.createIndex("positionKey", "positionKey", { unique: false });
        positions.createIndex("gameId", "gameId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the local game archive."));
    request.onblocked = () => reject(new Error("The local game archive is blocked by another tab."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Game archive transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Game archive transaction was cancelled."));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Game archive request failed."));
  });
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "game-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function isUsableMemory(sample) {
  return Number.isFinite(sample.evalLossCp) &&
    sample.evalLossCp <= 30 &&
    ["BRILLIANT", "GREAT", "BEST", "EXCELLENT", "GOOD"].includes(sample.grade);
}

function rankSamples(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    if (!sample || !sample.moveUci || !isUsableMemory(sample)) continue;
    const current = grouped.get(sample.moveUci) || { moveUci: sample.moveUci, count: 0, totalLoss: 0, wins: 0, draws: 0 };
    current.count += 1;
    current.totalLoss += Math.max(0, sample.evalLossCp);
    if (sample.resultForMover > 0) current.wins += 1;
    else current.draws += 1;
    grouped.set(sample.moveUci, current);
  }
  return [...grouped.values()].sort((a, b) => {
    const scoreA = a.count * 3 + a.wins * 2 + a.draws - a.totalLoss / Math.max(1, a.count) / 20;
    const scoreB = b.count * 3 + b.wins * 2 + b.draws - b.totalLoss / Math.max(1, b.count) / 20;
    return scoreB - scoreA;
  })[0] || null;
}

export function createGameArchive({ url = "", publishableKey = "" } = {}) {
  const supabase = url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    : null;

  let dbPromise = null;
  let userPromise = null;
  let sharedStatus = supabase ? "not-connected" : "not-configured";

  function database() {
    if (!dbPromise) dbPromise = openLocalDatabase();
    return dbPromise;
  }

  async function getRemoteUserId() {
    if (!supabase) return null;
    if (userPromise) return userPromise;
    userPromise = (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session?.user?.id) return sessionData.session.user.id;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!data.user?.id) throw new Error("Anonymous game-archive sign-in did not return a user.");
      return data.user.id;
    })();
    try {
      return await userPromise;
    } catch (error) {
      userPromise = null;
      throw error;
    }
  }

  async function saveGame(record) {
    const db = await database();
    const tx = db.transaction(["games"], "readwrite");
    const done = transactionComplete(tx);
    tx.objectStore("games").put(record);
    await done;

    if (supabase) {
      try {
        const userId = await getRemoteUserId();
        const { error } = await supabase.from("prunex_games").insert({
          id: record.id,
          user_id: userId,
          created_at: record.createdAt,
          result: record.result,
          human_color: record.humanColor,
          initial_fen: record.initialFen,
          final_fen: record.finalFen,
          pgn: record.pgn,
          moves: record.moves,
          opponent_version: record.opponentVersion
        });
        if (error) throw error;
        sharedStatus = "connected";
      } catch (error) {
        sharedStatus = "unavailable";
        console.warn("Shared Prunex game archive unavailable; game remains saved locally.", error);
      }
    }
    return { id: record.id, sharedStatus };
  }

  async function saveReview(record, samples) {
    const db = await database();
    const tx = db.transaction(["games", "position_memory"], "readwrite");
    const done = transactionComplete(tx);
    tx.objectStore("games").put(record);
    const memoryStore = tx.objectStore("position_memory");
    for (const sample of samples) {
      if (!isUsableMemory(sample)) continue;
      memoryStore.put(sample);
    }
    await done;

    if (supabase) {
      try {
        const userId = await getRemoteUserId();
        const { error: reviewError } = await supabase.from("prunex_game_reviews").insert({
          game_id: record.id,
          user_id: userId,
          created_at: new Date().toISOString(),
          white_accuracy: record.whiteAccuracy,
          black_accuracy: record.blackAccuracy,
          analysis_json: record.analysis
        });
        if (reviewError) throw reviewError;

        const remoteSamples = samples.filter(isUsableMemory).map(sample => ({
          id: sample.id,
          game_id: record.id,
          user_id: userId,
          position_key: sample.positionKey,
          side_to_move: sample.sideToMove,
          move_uci: sample.moveUci,
          san: sample.san,
          result_for_mover: sample.resultForMover,
          eval_loss_cp: sample.evalLossCp,
          grade: sample.grade,
          created_at: sample.createdAt
        }));
        if (remoteSamples.length) {
          const { error: memoryError } = await supabase.from("prunex_position_memory").insert(remoteSamples);
          if (memoryError) throw memoryError;
        }
        sharedStatus = "connected";
      } catch (error) {
        sharedStatus = "unavailable";
        console.warn("Shared Prunex review sync unavailable; review remains saved locally.", error);
      }
    }
    return { sharedStatus };
  }

  async function listGames(limit = 20) {
    const db = await database();
    const tx = db.transaction("games", "readonly");
    const rows = await requestValue(tx.objectStore("games").getAll());
    const byId = new Map(rows.map(row => [row.id, row]));

    if (supabase) {
      try {
        await getRemoteUserId();
        const { data, error } = await supabase
          .from("prunex_games")
          .select("id, created_at, result, human_color, pgn, initial_fen, moves")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        for (const row of data || []) {
          if (!byId.has(row.id)) {
            byId.set(row.id, {
              id: row.id,
              createdAt: row.created_at,
              result: row.result,
              humanColor: row.human_color,
              initialFen: row.initial_fen,
              pgn: row.pgn,
              remoteOnly: true,
              moves: Array.isArray(row.moves) ? row.moves : []
            });
          }
        }
        sharedStatus = "connected";
      } catch (error) {
        sharedStatus = "unavailable";
        console.warn("Could not load the shared Prunex game archive.", error);
      }
    }
    return [...byId.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  }

  async function findExperiencedMove(positionKey, sideToMove) {
    const db = await database();
    const tx = db.transaction("position_memory", "readonly");
    const localRows = await requestValue(
      tx.objectStore("position_memory").index("positionKey").getAll(positionKey)
    );
    let candidates = localRows.filter(row => row.sideToMove === sideToMove);

    if (supabase) {
      try {
        await getRemoteUserId();
        const { data, error } = await supabase
          .from("prunex_position_memory")
          .select("move_uci, result_for_mover, eval_loss_cp, grade")
          .eq("position_key", positionKey)
          .eq("side_to_move", sideToMove)
          .lte("eval_loss_cp", 30)
          .limit(60);
        if (error) throw error;
        candidates = candidates.concat((data || []).map(row => ({
          moveUci: row.move_uci,
          resultForMover: row.result_for_mover,
          evalLossCp: row.eval_loss_cp,
          grade: row.grade
        })));
        sharedStatus = "connected";
      } catch (error) {
        sharedStatus = "unavailable";
        console.warn("Prunex experience lookup fell back to local games.", error);
      }
    }

    return rankSamples(candidates)?.moveUci || null;
  }

  function getStatus() {
    return sharedStatus;
  }

  return { newId, saveGame, saveReview, listGames, findExperiencedMove, getStatus };
}