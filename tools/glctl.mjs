#!/usr/bin/env node
// glctl — the agent's control surface for the God's L'Eye dashboard.
//
// Written so an agent can set a person up without the UI: no browser, no clicking,
// one command per action, plain output on stdout, non-zero exit on failure.
//
//   node tools/glctl.mjs status
//   node tools/glctl.mjs demo                     # seed the demo campaign (idempotent)
//   node tools/glctl.mjs campaigns
//   node tools/glctl.mjs campaign:create --name "Q1 Founders" --icp "Founders of 5-50 person agencies"
//   node tools/glctl.mjs campaign:delete <id> --yes
//   node tools/glctl.mjs sheet:set <google-sheet-url>
//   node tools/glctl.mjs sheet:status
//   node tools/glctl.mjs today <campaign-id>
//
// Optional: --port 8787 (default), --json (machine-readable output).
// Exit codes: 0 ok · 1 command failed · 2 bad usage · 3 dashboard not reachable.

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);
const PORT = flag("port", process.env.PORT || "8787");
const JSON_OUT = has("json");
const BASE = `http://127.0.0.1:${PORT}`;

const [cmd, ...rest] = argv.filter((a) => !a.startsWith("--") && a !== flag("name") && a !== flag("icp") && a !== flag("port"));

function out(human, data) {
  if (JSON_OUT) console.log(JSON.stringify(data, null, 2));
  else if (human) console.log(human);
}

async function call(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: { "content-type": "application/json" }, ...opts });
  } catch (e) {
    console.error(`Cannot reach the dashboard on ${BASE}. Start it first (start.command / start.bat, or npm run dev in app/).`);
    process.exit(3);
  }
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    console.error(`${path} -> ${res.status}: ${body.error ?? body.detail ?? text.slice(0, 200)}`);
    process.exit(1);
  }
  return body;
}

function usage() {
  console.error(`glctl — control the dashboard without clicking

  status                       is it up, and what is in it
  demo                         seed the demo campaign (safe to run twice)
  campaigns                    list campaigns
  campaign:create --name N --icp "..."   create a campaign
  campaign:delete <id> --yes   delete a campaign with its leads and events
  sheet:set <url>              pair the dashboard with a Google Sheet
  sheet:status                 is a sheet paired
  today <campaign-id>          what is due today

  --port <n>   default 8787     --json   machine-readable`);
  process.exit(2);
}

(async () => {
  switch (cmd) {
    case "status": {
      const h = await call("/api/health");
      const c = await call("/api/config");
      out(
        `Dashboard up on ${BASE}\n` +
        `  campaigns ${h.campaign_count} · leads ${h.lead_count} · events ${h.event_count}\n` +
        `  sheet ${c.connected ? `paired: ${c.sheet_title ?? c.sheet_url}` : "not paired"}`,
        { base: BASE, ...h, config: c }
      );
      break;
    }
    case "demo": {
      const r = await call("/api/demo", { method: "POST" });
      out(`Demo ${r.created ? "created" : "already there"}: ${r.campaign_id}`, r);
      break;
    }
    case "campaigns": {
      const list = await call("/api/campaigns");
      out(list.map((c) => `${c.id}  ${c.name}  [${c.status}]`).join("\n") || "no campaigns yet", list);
      break;
    }
    case "campaign:create": {
      const name = flag("name");
      const icp = flag("icp");
      if (!name || !icp) usage();
      const chains = await call("/api/chains");
      const chain = chains[0];
      if (!chain) { console.error("No ladder defined in this build — cannot create a campaign."); process.exit(1); }
      const r = await call("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name, icp_sentence: icp, chain_id: chain.chain_id, chain_version: chain.version }),
      });
      const id = r?.id ?? r?.campaign?.id ?? r?.campaign_id;
      out(`Created ${id ?? "(no id in response)"} — ${name}`, r);
      break;
    }
    case "campaign:delete": {
      const id = rest[0];
      if (!id) usage();
      if (!has("yes")) {
        console.error(`Refusing to delete ${id} without --yes. This removes its leads and events too.`);
        process.exit(2);
      }
      const list = await call("/api/campaigns");
      const c = list.find((x) => x.id === id);
      if (!c) { console.error(`No campaign with id ${id}.`); process.exit(1); }
      const r = await call(`/api/campaigns/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: c.name }),
      });
      out(`Deleted "${c.name}". ${r.removed ? `Leads removed: ${r.removed.leads}, events: ${r.removed.events} (backed up under data/deleted/).` : ""}`.trim(), r);
      break;
    }
    case "sheet:set": {
      const url = rest[0];
      if (!url) usage();
      const r = await call("/api/config", { method: "POST", body: JSON.stringify({ sheet_url: url }) });
      out(r.connected ? "Sheet paired." : "Saved, but the dashboard does not consider it paired yet — check the URL.", r);
      break;
    }
    case "sheet:status": {
      const c = await call("/api/config");
      out(c.connected ? `Paired: ${c.sheet_title ?? c.sheet_url}` : "Not paired yet.", c);
      break;
    }
    case "today": {
      const id = rest[0];
      if (!id) usage();
      const t = await call(`/api/workday?campaign=${encodeURIComponent(id)}`);
      const cards = t.cards ?? [];
      out(`${cards.length} due today\n` + cards.map((c) => `  ${c.name} — ${c.company} — step ${c.step}`).join("\n"), t);
      break;
    }
    default:
      usage();
  }
})().catch((e) => {
  console.error(e?.message ?? String(e));
  process.exit(1);
});
