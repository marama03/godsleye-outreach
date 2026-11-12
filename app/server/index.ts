import { createApp } from "./app.js";
import { DATA_DIR } from "./store.js";

const PORT = Number(process.env.PORT ?? 8787);
const app = createApp();

const HOST = process.env.HOST ?? "127.0.0.1"; // set HOST=0.0.0.0 only to serve a phone straight from `npm start`
const srv = app.listen(PORT, HOST, () => {
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
