import { handleFetch } from "./index.js";

export default {
  async fetch(request, env) {
    return handleFetch(request, env);
  }
};
