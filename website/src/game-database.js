import { createClient } from "@supabase/supabase-js";

const DB_NAME = "prunex-game-archive";
const DB_VERSION = 1;
const SHARED_MEMORY_GRADES = new Set(["BRILLIANT", "GREAT", "BEST", "EXCELLENT", "GOOD"]);
const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

export function isUsableMemory(sample) {
  return Boolean(
    sample &&
    typeof sample === "object" &&
    typeof sample.id === "string" &&
    sample.id.length >= 1 &&
    sample.id.length <= 128 &&
    typeof sample.positionKey === "string" &&
    sample.positionKey.length >= 10 &&
    sample.positionKey.length <= 100 &&
    (sample.sideToMove === "w" || sample.sideToMove === "b") &&
    typeof sample.moveUci === "string" &&
    UCI_MOVE_PATTERN.test(sample.moveUci) &&
    typeof sample.san === "string" &&
    sample.san.length >= 1 &&
    sample.san.length <= 16 &&
    Number.isInteger(sample.evalLossCp) &&
    sample.evalLossCp >= 0 &&
    sample.evalLossCp <= 30 &&
    Number.isInteger(sample.resultForMover) &&
    [-1, 0, 1].includes(sample.resultForMover) &&
    SHARED_MEMORY_GRADES.has(sample.grade)
  );
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

export function createGameArchive({
  url = "",
  publishableKey = "",
  captchaTokenProvider = null,
  clientFactory = createClient,
  getRedirectTo = () => typeof window === "undefined" ? "" : window.location.origin,
  fetchImpl = (...args) => globalThis.fetch(...args)
} = {}) {
  // Supabase remains the identity provider and a read-only emergency archive fallback.
  // All normal archive reads/writes go through the same-origin server API to Neon.
  const supabase = url && publishableKey
    ? clientFactory(url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  let dbPromise = null;
  let sessionPromise = null;
  let sharedStatus = supabase ? "not-connected" : "not-configured";
  let lastSharedError = "";
  const authStateListeners = new Set();

  if (supabase?.auth?.onAuthStateChange) {
    supabase.auth.onAuthStateChange((event, session) => {
      sessionPromise = null;
      const user = session?.user ? {
        email: session.user.email || "",
        isAnonymous: session.user.is_anonymous === true,
        emailConfirmed: Boolean(session.user.email_confirmed_at || session.user.confirmed_at)
      } : null;
      for (const listener of authStateListeners) {
        try {
          listener(event, user);
        } catch (error) {
          console.warn("A Prunex account-state listener failed.", error);
        }
      }
    });
  }

  function database() {
    if (!dbPromise) dbPromise = openLocalDatabase();
    return dbPromise;
  }

  async function getSession() {
    if (!supabase) return null;
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (sessionData.session) return sessionData.session;

        const captchaToken = captchaTokenProvider ? await captchaTokenProvider() : null;
        const signInOptions = captchaToken ? { options: { captchaToken } } : undefined;
        const { data, error } = await supabase.auth.signInAnonymously(signInOptions);
        if (error) throw error;
        if (!data.session?.user?.id) {
          throw new Error("Guest archive sign-in did not return a session.");
        }
        return data.session;
      })();
    }
    try {
      return await sessionPromise;
    } catch (error) {
      sessionPromise = null;
      throw error;
    }
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

  async function archiveRequest(action, { method = "GET", payload = {}, query = {} } = {}) {
    if (!supabase) return { ownerAccess: false, backend: "local" };
    const session = await getSession();
    if (!session?.user?.id || session.user.is_anonymous) {
      return { ownerAccess: false, backend: "local", userId: session?.user?.id || null };
    }

    const params = new URLSearchParams({ action });
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }

    const headers = { Authorization: "Bearer " + session.access_token };
    const options = { method, headers, cache: "no-store" };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({ action, ...payload });
    }

    const response = await fetchImpl("/api/archive?" + params.toString(), options);
    let result = {};
    try { result = await response.json(); } catch {}
    if (response.status === 403 && result.code === "OWNER_ONLY") {
      return { ownerAccess: false, backend: "local", userId: session.user.id };
    }
    if (!response.ok || result.ok !== true) {
      throw new Error(result.error || "The private cloud archive is temporarily unavailable.");
    }
    return {
      ownerAccess: true,
      backend: result.backend || "neon",
      userId: session.user.id,
      data: result.data || {}
    };
  }

  function setBackendStatus(backend) {
    sharedStatus = backend === "supabase-fallback" ? "fallback" : "connected";
    lastSharedError = backend === "supabase-fallback"
      ? "Neon is temporarily unavailable. Existing cloud history is being read from the Supabase fallback."
      : "";
  }

  async function syncGameRecord(record, userId) {
    if (record.remoteUserId && record.remoteUserId !== userId) {
      throw new Error("This locally saved game belongs to a different account and was not transferred.");
    }
    const result = await archiveRequest("save-game", {
      method: "POST",
      payload: { record }
    });
    if (!result.ownerAccess) {
      return { ...record, remoteGameSyncStatus: "local-only", remoteSyncError: "" };
    }
    const synced = {
      ...record,
      remoteUserId: userId,
      remoteGameSyncStatus: "synced",
      remoteGameSyncedAt: new Date().toISOString(),
      remoteSyncError: ""
    };
    setBackendStatus(result.backend);
    await storeLocalGame(synced);
    return synced;
  }

  async function syncReviewRecord(record, samples, userId) {
    if (record.remoteUserId && record.remoteUserId !== userId) {
      throw new Error("This locally saved review belongs to a different account and was not transferred.");
    }
    const result = await archiveRequest("save-review", {
      method: "POST",
      payload: { record, samples: Array.isArray(samples) ? samples : [] }
    });
    if (!result.ownerAccess) {
      return { ...record, remoteReviewSyncStatus: "local-only", remoteMemorySyncStatus: "local-only" };
    }
    const synced = {
      ...record,
      remoteUserId: userId,
      remoteReviewSyncStatus: "synced",
      remoteMemorySyncStatus: record.shareTrainingData === true ? "synced" : "private-only",
      remoteReviewSyncedAt: new Date().toISOString(),
      remoteSyncError: ""
    };
    setBackendStatus(result.backend);
    await storeLocalGame(synced);
    return synced;
  }

  async function saveGame(record) {
    let session = null;
    if (supabase) {
      try { session = await getSession(); } catch (error) {
        lastSharedError = error instanceof Error ? error.message : String(error);
        sharedStatus = "unavailable";
      }
    }
    let localRecord = {
      ...record,
      ...(session?.user?.id ? { remoteUserId: session.user.id } : {}),
      remoteGameSyncStatus: "pending",
      remoteSyncError: ""
    };
    await storeLocalGame(localRecord);

    if (!supabase) {
      sharedStatus = "not-configured";
      return { id: record.id, sharedStatus, savedLocally: true };
    }
    if (session?.user?.is_anonymous) {
      sharedStatus = "owner-only";
      return { id: record.id, sharedStatus, savedLocally: true };
    }

    try {
      localRecord = await syncGameRecord(localRecord, session.user.id);
      if (localRecord.remoteGameSyncStatus === "local-only") sharedStatus = "owner-only";
    } catch (error) {
      sharedStatus = "unavailable";
      lastSharedError = error instanceof Error ? error.message : String(error);
      localRecord = {
        ...localRecord,
        remoteGameSyncStatus: "pending",
        remoteSyncError: lastSharedError
      };
      await storeLocalGame(localRecord);
      console.warn("Prunex cloud archive unavailable; the game is queued on this device.", error);
    }
    return { id: record.id, sharedStatus, savedLocally: true };
  }

  async function saveReview(record, samples, { shareTrainingData = false } = {}) {
    let session = null;
    if (supabase) {
      try { session = await getSession(); } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
      }
    }
    const localRecord = {
      ...record,
      ...(session?.user?.id ? { remoteUserId: session.user.id } : {}),
      shareTrainingData: Boolean(shareTrainingData),
      remoteReviewSyncStatus: "pending",
      remoteMemorySyncStatus: shareTrainingData ? "pending" : "private-only",
      remoteSyncError: ""
    };
    const db = await database();
    const tx = db.transaction(["games", "position_memory"], "readwrite");
    const done = transactionComplete(tx);
    tx.objectStore("games").put(localRecord);
    const memoryStore = tx.objectStore("position_memory");
    for (const sample of samples || []) {
      if (!isUsableMemory(sample)) continue;
      memoryStore.put(sample);
    }
    await done;

    if (!supabase) {
      sharedStatus = "not-configured";
      return { sharedStatus, savedLocally: true };
    }
    if (session?.user?.is_anonymous) {
      sharedStatus = "owner-only";
      return { sharedStatus, savedLocally: true };
    }

    try {
      const userId = session.user.id;
      const gameRecord = await syncGameRecord(localRecord, userId);
      if (gameRecord.remoteGameSyncStatus === "local-only") {
        sharedStatus = "owner-only";
        return { sharedStatus, savedLocally: true };
      }
      await syncReviewRecord(localRecord, samples, userId);
    } catch (error) {
      sharedStatus = "unavailable";
      lastSharedError = error instanceof Error ? error.message : String(error);
      await storeLocalGame({
        ...localRecord,
        remoteReviewSyncStatus: "pending",
        remoteMemorySyncStatus: shareTrainingData ? "pending" : "private-only",
        remoteSyncError: lastSharedError
      });
      console.warn("Prunex review archive unavailable; the review is queued on this device.", error);
    }
    return { sharedStatus, savedLocally: true };
  }

  async function listGames(limit = 20) {
    const db = await database();
    const tx = db.transaction("games", "readonly");
    const initialRows = await requestValue(tx.objectStore("games").getAll());
    if (!supabase) {
      return initialRows
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    }

    let session;
    try {
      session = await getSession();
    } catch (error) {
      sharedStatus = "unavailable";
      lastSharedError = error instanceof Error ? error.message : String(error);
      return initialRows.slice(0, limit);
    }
    const userId = session?.user?.id || null;
    const visibleRows = userId
      ? initialRows.filter(row => !row.remoteUserId || row.remoteUserId === userId)
      : initialRows.filter(row => !row.remoteUserId);

    if (!userId || session.user.is_anonymous) {
      sharedStatus = "owner-only";
      return visibleRows
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    }

    for (let record of visibleRows) {
      if (record.remoteUserId !== userId) continue;
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
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        await storeLocalGame({ ...record, remoteSyncError: lastSharedError });
      }
    }

    try {
      const remote = await archiveRequest("list", {
        method: "GET",
        query: { limit }
      });
      if (!remote.ownerAccess) {
        sharedStatus = "owner-only";
        return visibleRows
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, limit);
      }
      setBackendStatus(remote.backend);
      const refreshedTx = db.transaction("games", "readonly");
      const refreshedRows = await requestValue(refreshedTx.objectStore("games").getAll());
      const byId = new Map(
        refreshedRows
          .filter(row => !row.remoteUserId || row.remoteUserId === userId)
          .map(row => [row.id, row])
      );
      for (const row of remote.data.games || []) {
        const remoteRecord = {
          ...row,
          remoteUserId: userId,
          remoteGameSyncStatus: "synced",
          remoteReviewSyncStatus: row.analysis ? "synced" : "not-reviewed",
          remoteOnly: !byId.has(row.id)
        };
        const existing = byId.get(row.id);
        if (existing) Object.assign(existing, remoteRecord, { remoteOnly: false });
        else byId.set(row.id, remoteRecord);
      }
      return [...byId.values()]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    } catch (error) {
      sharedStatus = "unavailable";
      lastSharedError = error instanceof Error ? error.message : String(error);
      console.warn("Could not read the Prunex cloud archive.", error);
      return visibleRows
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    }
  }

  async function findExperiencedMove(positionKey, sideToMove) {
    const db = await database();
    const tx = db.transaction("position_memory", "readonly");
    const localRows = await requestValue(
      tx.objectStore("position_memory").index("positionKey").getAll(positionKey)
    );
    const gameTx = db.transaction("games", "readonly");
    const localGames = await requestValue(gameTx.objectStore("games").getAll());
    const session = supabase ? await getSession().catch(() => null) : null;
    const userId = session?.user?.id || null;
    const permittedGameIds = new Set(
      localGames
        .filter(gameRecord => !gameRecord.remoteUserId || !userId || gameRecord.remoteUserId === userId)
        .map(gameRecord => gameRecord.id)
    );
    let candidates = localRows.filter(row =>
      row.sideToMove === sideToMove && permittedGameIds.has(row.gameId)
    );

    if (supabase && userId && !session.user.is_anonymous) {
      try {
        const remote = await archiveRequest("positions", {
          method: "GET",
          query: { positionKey, sideToMove }
        });
        if (remote.ownerAccess) {
          candidates = candidates.concat(remote.data.samples || []);
          setBackendStatus(remote.backend);
        } else {
          sharedStatus = "owner-only";
        }
      } catch (error) {
        sharedStatus = "unavailable";
        lastSharedError = error instanceof Error ? error.message : String(error);
        console.warn("Private position-memory lookup fell back to this device.", error);
      }
    }
    return rankSamples(candidates)?.moveUci || null;
  }

  function normalizeRecoveryEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }
    return normalizedEmail;
  }

  function authEmailRedirectTo() {
    const redirectTo = getRedirectTo();
    let parsedRedirect;
    try {
      parsedRedirect = new URL(redirectTo);
    } catch {
      throw new Error("Email sign-in requires a secure HTTPS redirect URL.");
    }
    if (parsedRedirect.protocol !== "https:" || parsedRedirect.origin !== redirectTo) {
      throw new Error("Email sign-in requires a secure HTTPS origin URL.");
    }
    return redirectTo;
  }

  async function linkGuestEmail(email) {
    if (!supabase) throw new Error("Cloud account recovery is not configured.");
    const normalizedEmail = normalizeRecoveryEmail(email);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error("Your guest session is not available.");
    if (!userData.user.is_anonymous) {
      throw new Error("This archive already has a permanent sign-in identity.");
    }
    const { error } = await supabase.auth.updateUser(
      { email: normalizedEmail },
      { emailRedirectTo: authEmailRedirectTo() }
    );
    if (error) throw error;
    return { email: normalizedEmail, verificationRequired: true };
  }


  async function getAccountState() {
    if (!supabase) {
      return { configured: false, authenticated: false, email: "", isAnonymous: false, emailConfirmed: false };
    }
    const session = await getSession();
    if (!session?.user?.id) {
      return { configured: true, authenticated: false, email: "", isAnonymous: false, emailConfirmed: false };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (!user) {
      return { configured: true, authenticated: false, email: "", isAnonymous: false, emailConfirmed: false };
    }
    return {
      configured: true,
      authenticated: true,
      email: user.email || "",
      isAnonymous: user.is_anonymous === true,
      emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at)
    };
  }

  async function setAccountPassword(password) {
    if (!supabase) throw new Error("Password setup is not configured.");
    const value = String(password || "");
    if (value.length < 12) throw new Error("Use a password with at least 12 characters.");
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (!user) throw new Error("Your Prunex session is not available.");
    if (!user.email || !(user.email_confirmed_at || user.confirmed_at)) {
      throw new Error("Verify the guest email in this browser before setting a password. Your game archive has not been moved.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: value });
    if (updateError) throw updateError;
    return { email: user.email || "" };
  }

  async function signInWithPassword(email, password) {
    if (!supabase) throw new Error("Password sign-in is not configured.");
    const normalizedEmail = normalizeRecoveryEmail(email);
    const value = String(password || "");
    if (!value) throw new Error("Enter your Prunex password.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: value
    });
    if (error) throw error;
    if (!data?.session?.user?.id || data.session.user.is_anonymous === true) {
      throw new Error("Password sign-in did not return a permanent account session.");
    }
    sessionPromise = Promise.resolve(data.session);
    return { email: data.user?.email || normalizedEmail };
  }

  async function sendPasswordReset(email) {
    if (!supabase) throw new Error("Password recovery is not configured.");
    const normalizedEmail = normalizeRecoveryEmail(email);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: authEmailRedirectTo()
    });
    if (error) throw error;
    return { email: normalizedEmail, verificationRequired: true };
  }

  function subscribeAuthState(listener) {
    if (typeof listener !== "function") throw new TypeError("An account-state listener function is required.");
    authStateListeners.add(listener);
    return () => authStateListeners.delete(listener);
  }

  async function sendRecoveryLink(email) {
    if (!supabase) throw new Error("Cloud account recovery is not configured.");
    const normalizedEmail = normalizeRecoveryEmail(email);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authEmailRedirectTo()
      }
    });
    if (error) throw error;
    return { email: normalizedEmail, verificationRequired: true };
  }

  async function deleteAccount() {
    if (!supabase) throw new Error("Cloud account deletion is not configured.");
    const session = await getSession();
    if (session?.user && !session.user.is_anonymous) {
      const deletion = await archiveRequest("delete-owner-data", { method: "POST" });
      if (!deletion.ownerAccess) {
        throw new Error("The verified owner account is required to delete the private cloud archive.");
      }
    }
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "DELETE_MY_PRUNEX_ACCOUNT" }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "The account could not be deleted.");

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The server has already revoked and deleted the user.
    }
    sessionPromise = null;
    sharedStatus = "not-connected";
    lastSharedError = "";

    await new Promise((resolve, reject) => {
      if (!("indexedDB" in globalThis)) return resolve();
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not clear this device's game archive."));
      request.onblocked = () => reject(new Error("Close other Prunex tabs before clearing local archive data."));
    });
    dbPromise = null;
    return { success: true };
  }

  function getStatus() {
    return sharedStatus;
  }

  function getLastError() {
    return lastSharedError;
  }

  return {
    newId, saveGame, saveReview, listGames, findExperiencedMove,
    linkGuestEmail, sendRecoveryLink, getAccountState, setAccountPassword,
    signInWithPassword, sendPasswordReset, subscribeAuthState,
    deleteAccount, getStatus, getLastError
  };
}
