let apiPromise = null;
let activeWidgetId = null;

function loadTurnstileApi() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-prunex-turnstile="true"]');
    const script = existing || document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("Turnstile did not load in time.")), 15000);
    const ready = () => {
      window.clearTimeout(timeout);
      if (!window.turnstile) {
        reject(new Error("Turnstile loaded without its browser API."));
        return;
      }
      resolve(window.turnstile);
    };
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Could not load the Turnstile verification service."));
    }, { once: true });
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.prunexTurnstile = "true";
      document.head.append(script);
    }
  }).catch(error => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

export async function requestTurnstileToken({ siteKey = "", container, required = false } = {}) {
  if (!siteKey) {
    if (required) {
      throw new Error("Guest verification is required, but the Turnstile site key is not configured.");
    }
    return null;
  }
  if (!container) throw new Error("The Turnstile verification area is missing.");
  container.hidden = false;
  container.replaceChildren();
  const turnstile = await loadTurnstileApi();

  if (activeWidgetId !== null) {
    try { turnstile.remove(activeWidgetId); } catch { /* Widget may already be removed. */ }
    activeWidgetId = null;
  }

  return new Promise((resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      container.hidden = true;
      reject(new Error("Turnstile verification expired. Please retry."));
    }, 120000);
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      container.hidden = true;
      callback(value);
    };
    try {
      activeWidgetId = turnstile.render(container, {
        sitekey: siteKey,
        theme: "light",
        size: "normal",
        callback: token => finish(resolve, token),
        "expired-callback": () => finish(reject, new Error("Turnstile verification expired. Please retry.")),
        "error-callback": () => finish(reject, new Error("Turnstile verification failed. Please retry.")),
      });
    } catch (error) {
      finish(reject, error instanceof Error ? error : new Error("Could not start Turnstile verification."));
    }
  });
}
