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

export function rankSamples(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    if (!sample || !sample.moveUci || !isUsableMemory(sample)) continue;
    const current = grouped.get(sample.moveUci) || {
      moveUci: sample.moveUci,
      count: 0,
      totalLoss: 0,
      wins: 0,
      draws: 0,
      losses: 0
    };
    current.count += 1;
    current.totalLoss += Math.max(0, sample.evalLossCp);
    if (sample.resultForMover > 0) current.wins += 1;
    else if (sample.resultForMover < 0) current.losses += 1;
    else current.draws += 1;
    grouped.set(sample.moveUci, current);
  }
  return [...grouped.values()].sort((a, b) => {
    const averageLossA = a.totalLoss / Math.max(1, a.count);
    const averageLossB = b.totalLoss / Math.max(1, b.count);
    const scoreA = a.count * 4 + a.wins * 0.4 + a.draws * 0.1 -
      a.losses * 0.5 - averageLossA / 20;
    const scoreB = b.count * 4 + b.wins * 0.4 + b.draws * 0.1 -
      b.losses * 0.5 - averageLossB / 20;
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
  let lastSharedError = "";

  function database() {
    if (!dbPromise) dbPromise = openLocalDatabase();
    return dbPromise;
  }

  async function storeLocalGame(record) {
    const db = await database();
    const tx = db.transaction(["games"], "readwrite");
    const done = transactionComplete(tx);
    tx.objectStore("games").put(record);
    await done;
  }

  async function loadLocalSamples(gameId) {
    const db = await database();
    const tx = db.transaction("position_memory", "readonly");
    return requestValue(tx.objectStore("position_memory").index("gameId").getAll(gameId));
  }

  async function syncGameRecord(record, userId) {
    if (record.remoteUserId && record.remoteUserId !== userId) {
      throw new Error("This locally saved game belongs to a different guest profile and was not transferred.");
    }
    const { error } = await supabase.from("prunex_games").upsert({
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
    }, { onConflict: "id" });
    if (error) throw error;
    const synced = {
      ...record,
      remoteUserId: userId,
      remoteGameSyncStatus: "synced",
      remoteGameSyncedAt: new Date().toISOString(),
      remoteSyncError: ""
    };
    await storeLocalGame(synced);
    return synced;
  }

  async function syncReviewRecord(record, samples, userId) {
    if (record.remoteUserId && record.remoteUserId !== userId) {
      throw new Error("This locally saved review belongs to a different guest profile and was not transferred.");
    }
    const { error: reviewError } = await supabase.from("prunex_game_reviews").upsert({
      game_id: record.id,
      user_id: userId,
      created_at: new Date().toISOString(),
      white_accuracy: record.whiteAccuracy,
      black_accuracy: record.blackAccuracy,
      analysis_json: record.analysis
    }, { onConflict: "game_id,user_id" });
    if (reviewError) throw reviewError;

    const remoteSamples = (record.shareTrainingData ? samples : [])
      .filter(isUsableMemory)
      .map(sample => ({
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
      const { error: memoryError } = await supabase
        .from("prunex_position_memory")
        .upsert(remoteSamples, { onConflict: "id" });
      if (memoryError) throw memoryError;
    }

    const synced = {
      ...record,
      remoteUserId: userId,
      remoteReviewSyncStatus: "synced",
      remoteMemorySyncStatus: record.shareTrainingData ? "synced" : "not-shared",
      remoteReviewSyncedAt: new Date().toISOString(),
      remoteSyncError: ""
    };
    await storeLocalGame(synced);
    return synced;
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
    let localRecord = {
      ...record,
      remoteGameSyncStatus: supabase ? "pending" : "local-only",
      remoteSyncError: ""
    };
    await storeLocalGame(localRecord);

    if (supabase) {
      try {
        const userId = await getRemoteUserId();
        localRecord = await syncGameRecord(localRecord, userId);
        sharedStatus = "connected";
        lastSharedError = "";
      } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        localRecord = {
          ...localRecord,
          remoteGameSyncStatus: "pending",
          remoteSyncError: lastSharedError
        };
        await storeLocalGame(localRecord);
        console.warn("Shared Prunex game archive unavailable; game is queued locally for retry.", error);
      }
    }
    return { id: record.id, sharedStatus, savedLocally: true };
  }

  async function saveReview(record, samples, { shareTrainingData = false } = {}) {
    const localRecord = {
      ...record,
      shareTrainingData: Boolean(shareTrainingData),
      remoteReviewSyncStatus: supabase ? "pending" : "local-only",
      remoteMemorySyncStatus: shareTrainingData ? "pending" : "not-shared",
      remoteSyncError: ""
    };
    const db = await database();
    const tx = db.transaction(["games", "position_memory"], "readwrite");
    const done = transactionComplete(tx);
    tx.objectStore("games").put(localRecord);
    const memoryStore = tx.objectStore("position_memory");
    for (const sample of samples) {
      if (!isUsableMemory(sample)) continue;
      memoryStore.put(sample);
    }
    await done;

    if (supabase) {
      try {
        const userId = await getRemoteUserId();
        await syncGameRecord(localRecord, userId);
        await syncReviewRecord(localRecord, samples, userId);
        sharedStatus = "connected";
        lastSharedError = "";
      } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        await storeLocalGame({
          ...localRecord,
          remoteReviewSyncStatus: "pending",
          remoteMemorySyncStatus: shareTrainingData ? "pending" : "not-shared",
          remoteSyncError: lastSharedError
        });
        console.warn("Shared Prunex review sync unavailable; review is queued locally for retry.", error);
      }
    }
    return { sharedStatus, savedLocally: true };
  }

  async function listGames(limit = 20) {
    const db = await database();
    const tx = db.transaction("games", "readonly");
    const initialRows = await requestValue(tx.objectStore("games").getAll());
    let syncFailed = false;
    let syncFailureMessage = "";

    if (supabase) {
      try {
        const userId = await getRemoteUserId();
        for (let record of initialRows) {
          if (record.remoteUserId && record.remoteUserId !== userId) continue;
          try {
            if (record.remoteGameSyncStatus !== "synced") {
              record = await syncGameRecord(record, userId);
            }
            if (Array.isArray(record.analysis) && record.analysis.length &&
                record.remoteReviewSyncStatus !== "synced") {
              const samples = await loadLocalSamples(record.id);
              await syncReviewRecord(record, samples, userId);
            }
          } catch (error) {
            syncFailed = true;
            syncFailureMessage = error instanceof Error ? error.message : String(error);
            await storeLocalGame({ ...record, remoteSyncError: syncFailureMessage });
          }
        }

        const refreshedTx = db.transaction("games", "readonly");
        const refreshedRows = await requestValue(refreshedTx.objectStore("games").getAll());
        const byId = new Map(refreshedRows.map(row => [row.id, row]));

        const { data, error } = await supabase
          .from("prunex_games")
          .select("id, created_at, result, human_color, pgn, initial_fen, moves")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;

        const remoteIds = (data || []).map(row => row.id);
        const reviewsByGame = new Map();
        if (remoteIds.length) {
          const { data: reviews, error: reviewError } = await supabase
            .from("prunex_game_reviews")
            .select("game_id, white_accuracy, black_accuracy, analysis_json")
            .in("game_id", remoteIds)
            .order("created_at", { ascending: false });
          if (reviewError) throw reviewError;
          for (const review of reviews || []) {
            if (!reviewsByGame.has(review.game_id)) reviewsByGame.set(review.game_id, review);
          }
        }

        for (const row of data || []) {
          const review = reviewsByGame.get(row.id);
          const remoteRecord = {
            id: row.id,
            createdAt: row.created_at,
            result: row.result,
            humanColor: row.human_color,
            initialFen: row.initial_fen,
            pgn: row.pgn,
            remoteOnly: !byId.has(row.id),
            moves: Array.isArray(row.moves) ? row.moves : [],
            analysis: review?.analysis_json ?? null,
            whiteAccuracy: review?.white_accuracy ?? null,
            blackAccuracy: review?.black_accuracy ?? null
          };
          const existing = byId.get(row.id);
          if (existing) Object.assign(existing, remoteRecord, { remoteOnly: false });
          else byId.set(row.id, remoteRecord);
        }
        if (!syncFailed) {
          sharedStatus = "connected";
          lastSharedError = "";
        } else {
          sharedStatus = "unavailable";
          lastSharedError = syncFailureMessage;
        }
        return [...byId.values()]
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, limit);
      } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        console.warn("Could not synchronize the Prunex game archive.", error);
      }
    }

    return initialRows
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
        lastSharedError = "";
      } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        console.warn("Prunex experience lookup fell back to local games.", error);
      }
    }

    return rankSamples(candidates)?.moveUci || null;
  }

  function getStatus() {
    return sharedStatus;
  }

  function getLastError() {
    return lastSharedError;
  }

  return { newId, saveGame, saveReview, listGames, findExperiencedMove, getStatus, getLastError };
}