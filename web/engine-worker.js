let enginePromise;
let activeRequest = 0;

self.onmessage = async (event) => {
    const data = event.data || {};
    if (data.type === "cancel") {
        activeRequest += 1;
        return;
    }
    if (data.type !== "search") return;

    const requestId = ++activeRequest;
    try {
        if (!enginePromise) {
            importScripts("./prunex.js");
            enginePromise = self.createPrunexModule({
                locateFile: (path) => new URL(path, self.location.href).toString()
            });
        }
        const engine = await enginePromise;
        if (requestId !== activeRequest) return;
        const bestMove = engine.ccall(
            "prunex_best_move",
            "string",
            ["string", "number", "number"],
            [data.fen, data.moveTimeMs, data.depth]
        );
        if (requestId === activeRequest) {
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
