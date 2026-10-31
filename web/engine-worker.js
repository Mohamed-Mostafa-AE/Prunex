let enginePromise;
let activeRequest = 0;

async function loadEngine() {
    if (!enginePromise) {
        importScripts("./prunex.js");
        enginePromise = self.createPrunexModule({
            locateFile: (path) => new URL(path, self.location.href).toString()
        });
    }
    return enginePromise;
}

self.onmessage = async (event) => {
    const data = event.data || {};
    if (data.type === "cancel") {
        activeRequest += 1;
        return;
    }

    if (data.type === "init") {
        try {
            await loadEngine();
            self.postMessage({ type: "ready" });
        } catch (error) {
            self.postMessage({
                type: "error",
                requestId: data.requestId,
                message: error instanceof Error ? error.message : String(error)
            });
        }
        return;
    }

    if (data.type !== "search") return;
    const requestToken = ++activeRequest;

    try {
        const engine = await loadEngine();
        if (requestToken !== activeRequest) return;
        const bestMove = engine.ccall(
            "prunex_best_move",
            "string",
            ["string", "number", "number"],
            [data.fen, data.moveTimeMs, data.depth]
        );
        if (requestToken === activeRequest) {
            self.postMessage({ type: "bestmove", requestId: data.requestId, bestMove });
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            requestId: data.requestId,
            message: error instanceof Error ? error.message : String(error)
        });
    }
};
