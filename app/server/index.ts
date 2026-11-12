import { createApp } from "./app.js";
import { DATA_DIR } from "./store.js";

const PORT = Number(process.env.PORT ?? 8787);
const app = createApp();

const srv = app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] API listening on http://127.0.0.1:${PORT}  (data: ${DATA_DIR})`);
});
srv.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" || err.code === "EACCES") {
    console.error(`[server] port ${PORT} is not available (${err.code}). Something else is listening on it.`);
    console.error(`[server] Run with another port:  PORT=8788 npm run dev   (the web proxy follows PORT automatically)`);
    process.exit(1);
  }
  throw err;
});
