#!/usr/bin/env python3
"""End-to-end check of the God's L'Eye sheet bridge, including send tracking.

    # against the live Apps Script deployment
    BRIDGE_URL='https://script.google.com/macros/s/.../exec' BRIDGE_TOKEN='...' \
        python3 workspace/godseye-e2e.py

    # against the real Code.gs, run locally in a stubbed Apps Script runtime
    python3 workspace/godseye-e2e.py --mock

Contract under test (workspace/godseye-Code.gs v4, 2026-11-12 — 45-day ladder):
  to_send -> day4 (+4) -> day10 (+10) -> day18 (+18) -> day30 (+30) -> day45 (+45) -> done,
  every offset counted from `Sent At`, never from the previous step.
  GET  ?token=T[&status=queued]          -> {"rows":[...]}
  GET  ?token=T&view=today[&date=D]      -> {"date","count","rows":[... + "Variants"]}
  GET  ?token=T&view=messages&contact_id -> {"rows":[...]}
  POST {token, action:"append"|"update", rows:[...]}  -> {"ok","touched"}
  POST {token, action:"mark_sent"|"undo"|"skip"|"replied", contact_id, expect_stage,
        variant?, request_id}                         -> {"ok","row":{...}} | {"ok":false,"conflict":true}
  POST {token, action:"variants", contact_id, stage, variants:[{slot,body}]} -> {"ok","variants":[ids]}

The sending flow: mark sent -> double click -> stale tab -> undo -> skip -> replied,
each asserted on the sheet state, not on the app's memory. Exit code 0 = contract holds.
No third-party deps.
"""
import datetime
import json
import os
import random
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

URL = os.environ.get("BRIDGE_URL", "").rstrip("/")
TOKEN = os.environ.get("BRIDGE_TOKEN", "")
_HERE = os.path.dirname(os.path.abspath(__file__))
SIM = os.path.join(_HERE, "runs", "inbox_0c3edf91affee288d568f208f4d4a363", "test", "apps_script_sim.js")
if not os.path.exists(SIM):  # the harness moved with the v4 run; keep --mock working either way
    SIM = os.path.join(_HERE, "runs", "inbox_2bdef9e85832730a8e6099bcebc7d433", "test",
                       "apps_script_sim.js")
fails, total = [], 0
SIM_PROC = None


def check(label, cond, detail=""):
    global total
    total += 1
    print(("PASS  " if cond else "FAIL  ") + label + (("  <- " + str(detail)[:400]) if not cond else ""))
    if not cond:
        fails.append(label)
    return cond


class _PostRedirect(urllib.request.HTTPRedirectHandler):
    """Apps Script answers POST /exec with a 302; keep the body on the hop."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and req.get_method() == "POST" and req.data is not None:
            new.data = req.data
            new.add_header("Content-Type", req.get_header("Content-type") or "text/plain")
        return new


OPENER = urllib.request.build_opener(_PostRedirect)


def get(params):
    q = urllib.parse.urlencode(params)
    try:
        with OPENER.open(URL + "?" + q, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return _json_or(e)


def post(payload):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "text/plain"}, method="POST")
    try:
        with OPENER.open(req, timeout=60) as r:
            return _json_or(r)
    except urllib.error.HTTPError as e:
        return _json_or(e)


def _json_or(resp):
    raw = resp.read().decode()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_non_json": raw[:300]}


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_sim():
    global URL, TOKEN, SIM_PROC
    port = free_port()
    TOKEN = "local-test"
    URL = "http://127.0.0.1:%d" % port
    SIM_PROC = subprocess.Popen(["node", SIM, "--serve", str(port)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
                                env=dict(os.environ, BRIDGE_TOKEN=TOKEN))
    for _ in range(60):
        time.sleep(0.25)
        try:
            with urllib.request.urlopen(URL + "?token=" + TOKEN, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            continue
    raise RuntimeError("mock bridge did not start")


def stop_sim():
    if SIM_PROC:
        SIM_PROC.terminate()


def _iso(offset_days=0):
    d = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=offset_days)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (d.microsecond // 1000)


def today():
    return datetime.date.today()


def plus(n):
    return (today() + datetime.timedelta(days=n)).isoformat()


def main():
    if not URL or not TOKEN:
        print("No BRIDGE_URL — starting the local stub of the real Code.gs (--mock mode).\n")
        start_sim()

    suffix = "%05d" % (int(time.time()) % 100000)
    cid = lambda k: "e2e%s%s" % (suffix, k)  # noqa: E731
    base = lambda k, name, extra=None: dict({  # noqa: E731
        "Contact ID": cid(k), "Full Name": name, "Title": "E2E", "Company": "Harness Co",
        "LinkedIn URL": "https://www.linkedin.com/in/e2e-%s-%s" % (k, suffix),
        "Segment": "test", "Campaign": "e2e", "Date Added": _iso(),
        "Accepted?": "Yes", "Research Status": "ready"}, **(extra or {}))

    r = get({"token": "wrong-token"})
    check("bad token rejected", r.get("error") == "unauthorized", r)

    r = get({"token": TOKEN})
    check("good token returns rows", isinstance(r.get("rows"), list), r)

    # ---- fixtures -------------------------------------------------------
    rows = [
        base("a", "E2E Aaa"),
        base("b", "E2E Bbb"),
        base("c", "E2E Ccc", {"Stage": "day4",
                              "Sent At": _iso(-9),
                              "Next Due": plus(-5)}),
        base("d", "E2E Ddd", {"Stage": "day10", "Sent At": _iso(),
                              "Next Due": plus(6)}),
        base("e", "E2E Eee", {"Stage": "done", "Sent At": _iso(),
                              "Next Due": ""}),
        base("f", "E2E Fff", {"Research Status": "queued"}),
        base("g", "E2E Ggg", {"Stage": "day18", "Sent At": _iso(-20), "Next Due": plus(-2)}),
        base("h", "E2E Hhh", {"Stage": "day45", "Sent At": _iso(-46), "Next Due": plus(0)}),
        base("i", "E2E Iii", {"Stage": "replied", "Sent At": _iso(-12), "Next Due": ""}),
    ]
    r = post({"token": TOKEN, "action": "append", "rows": rows})
    check("fixtures appended", r.get("ok") is True and r.get("touched") == 9, r)

    # ---- Today view -----------------------------------------------------
    r = get({"token": TOKEN, "view": "today"})
    day = r.get("date", "")
    ids = [x.get("Contact ID") for x in r.get("rows", [])]
    ours = [i for i in ids if str(i).startswith("e2e" + suffix)]
    check("today view returns date + rows", bool(day) and isinstance(r.get("rows"), list), r)
    check("today includes to_send, overdue day4, overdue day18", 
          cid("a") in ids and cid("b") in ids and cid("c") in ids and cid("g") in ids, ours)
    check("today includes day45 due exactly today", cid("h") in ids, ours)
    check("today excludes future day10", cid("d") not in ids, ours)
    check("today excludes done", cid("e") not in ids, ours)
    check("today excludes unresearched", cid("f") not in ids, ours)
    check("today excludes replied", cid("i") not in ids, ours)
    check("today order: stage rank (to_send, day4, day18, day45), then due, then name",
          ours[:5] == [cid("a"), cid("b"), cid("c"), cid("g"), cid("h")], ours[:5])

    # ---- variants -------------------------------------------------------
    r = post({"token": TOKEN, "action": "variants", "contact_id": cid("a"), "stage": "to_send",
              "variants": [{"slot": 1, "body": "E2E Aaa — variant one."},
                           {"slot": 2, "body": "E2E Aaa — variant two, hook theme."},
                           {"slot": 3, "body": "E2E Aaa — variant three."}]})
    vids = r.get("variants") or []
    check("three variants stored", r.get("ok") is True and len(vids) == 3, r)
    check("variant id shape V<n>-4hex", all(len(v) == 7 and v[0] == "V" and v[2] == "-" for v in vids), vids)
    v2 = vids[1] if len(vids) > 1 else "V2-0000"
    m = get({"token": TOKEN, "view": "messages", "contact_id": cid("a")})
    check("variant text readable back", any(x.get("Variant") == v2 and "hook theme" in str(x.get("Body"))
                                            for x in m.get("rows", [])), m)
    tv = get({"token": TOKEN, "view": "today"})
    row_a = next((x for x in tv.get("rows", []) if x.get("Contact ID") == cid("a")), {})
    check("today rows carry their variants", len(row_a.get("Variants") or []) == 3, row_a.get("Variants"))

    # ---- Mark sent ------------------------------------------------------
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "to_send", "variant": "V9-dead", "request_id": "e2e-%s-q" % suffix})
    check("unknown variant refused", r.get("ok") is False and r.get("error") == "bad_payload", r)

    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "to_send", "variant": v2, "request_id": "e2e-%s-1" % suffix})
    row = r.get("row") or {}
    check("mark sent advances to day4", r.get("ok") is True and row.get("Stage") == "day4", r)
    check("mark sent records the variant", row.get("Variant") == v2, row)
    check("mark sent stamps Sent At", str(row.get("Sent At", "")).startswith("20"), row)
    check("next due is 4 days after the send date",
          3 <= (_date(row.get("Next Due")) - _date(str(row.get("Sent At"))[:10])).days <= 5, row)
    ids = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today"}).get("rows", [])]
    check("sent row leaves the Today queue", cid("a") not in ids, ids[-5:])

    # ---- double click ---------------------------------------------------
    before = row
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "to_send", "variant": v2, "request_id": "e2e-%s-1" % suffix})
    check("replayed click is idempotent, not a second stamp",
          r.get("ok") is True and r.get("idempotent") is True, r)
    now_row = _row(get({"token": TOKEN}), cid("a"))
    check("idempotent replay changed nothing", now_row.get("Sent At") == before.get("Sent At"), now_row)

    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "to_send", "variant": v2, "request_id": "e2e-%s-2" % suffix})
    check("second click from the same stale view conflicts",
          r.get("ok") is False and r.get("conflict") is True, r)
    check("second click did not re-stamp",
          _row(get({"token": TOKEN}), cid("a")).get("Sent At") == before.get("Sent At"))

    # ---- undo -----------------------------------------------------------
    r = post({"token": TOKEN, "action": "undo", "contact_id": cid("a"),
              "expect_stage": "day4", "request_id": "e2e-%s-3" % suffix})
    row = r.get("row") or {}
    check("undo restores to_send", r.get("ok") is True and row.get("Stage") == "to_send", r)
    check("undo clears Variant / Sent At / Next Due",
          not row.get("Variant") and not row.get("Sent At") and not row.get("Next Due"), row)
    ids = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today"}).get("rows", [])]
    check("undone row is back in Today", cid("a") in ids)
    r = post({"token": TOKEN, "action": "undo", "contact_id": cid("a"),
              "expect_stage": "day4", "request_id": "e2e-%s-4" % suffix})
    check("double-click undo does not step twice",
          r.get("ok") is False and r.get("conflict") is True
          and _row(get({"token": TOKEN}), cid("a")).get("Stage") == "to_send", r)

    # ---- stale tab after two real steps ---------------------------------
    post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
          "expect_stage": "to_send", "variant": v2, "request_id": "e2e-%s-5" % suffix})
    post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
          "expect_stage": "day4", "request_id": "e2e-%s-6" % suffix})
    check("row advanced to day10", _row(get({"token": TOKEN}), cid("a")).get("Stage") == "day10")
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "day4", "request_id": "e2e-%s-7" % suffix})
    check("stale tab refused, current stage reported",
          r.get("ok") is False and r.get("conflict") is True and r.get("stage") == "day10", r)
    check("stale write left the row at day10", _row(get({"token": TOKEN}), cid("a")).get("Stage") == "day10")
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("a"),
              "expect_stage": "day10", "request_id": "e2e-%s-8" % suffix})
    row = r.get("row") or {}
    check("day10 -> day18, due = sent + 18", r.get("ok") is True and row.get("Stage") == "day18"
          and row.get("Next Due") == _plus_sent(row, 18), row)
    check("follow-up at stamped", str(row.get("Follow-up At", "")).startswith("20"), row)

    # ---- the ladder, rung by rung on one row ----------------------------
    # A wrong predecessor is refused at every rung; the right one advances with
    # Sent At + offset; undo replays the prior state; the last rung closes it.
    LADDER = [("to_send", "day4", 4), ("day4", "day10", 10), ("day10", "day18", 18),
              ("day18", "day30", 30), ("day30", "day45", 45), ("day45", "done", None)]
    post({"token": TOKEN, "action": "append",
          "rows": [base("w", "E2E Walk", {"Stage": "to_send", "Sent At": _iso(-3)})]})
    seeded_sent = _row(get({"token": TOKEN}), cid("w")).get("Sent At")
    check("walk row starts at to_send", _row(get({"token": TOKEN}), cid("w")).get("Stage") == "to_send")

    for n, (stage, nxt, off) in enumerate(LADDER, 1):
        if stage != "to_send":
            before = _row(get({"token": TOKEN}), cid("w"))
            r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("w"),
                      "expect_stage": "to_send", "request_id": "e2e-%s-w%d" % (suffix, n)})
            after = _row(get({"token": TOKEN}), cid("w"))
            check("a write addressed to to_send is refused while at %s" % stage,
                  r.get("ok") is False and r.get("conflict") is True and r.get("stage") == stage
                  and after.get("Stage") == before.get("Stage"), r)
        cur = _row(get({"token": TOKEN}), cid("w"))
        prior = {"Stage": cur.get("Stage"), "Next Due": cur.get("Next Due") or "",
                 "Follow-up At": cur.get("Follow-up At") or "", "Sent At": cur.get("Sent At") or ""}
        r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("w"),
                  "expect_stage": stage, "request_id": "e2e-%s-x%d" % (suffix, n),
                  **({"variant": vids[0]} if stage == "to_send" else {})})
        row = r.get("row") or {}
        # the first send stamps its own Sent At, so read the offset from the row
        want = "" if off is None else _plus_sent(row, off)
        check("%s -> %s" % (stage, nxt), r.get("ok") is True and row.get("Stage") == nxt, r)
        check("%s -> %s: next due %s" % (stage, nxt, "empty" if off is None else "sent+%d" % off),
              (row.get("Next Due") or "") == want, [row.get("Next Due"), want])
        if stage != "to_send":
            check("%s -> %s: Sent At untouched, Follow-up At stamped" % (stage, nxt),
                  row.get("Sent At") == prior["Sent At"]
                  and str(row.get("Follow-up At") or "") >= prior["Follow-up At"], row)
        if nxt != "done":
            r = post({"token": TOKEN, "action": "undo", "contact_id": cid("w"),
                      "expect_stage": nxt, "request_id": "e2e-%s-u%d" % (suffix, n)})
            back = r.get("row") or {}
            check("undo from %s returns to %s exactly" % (nxt, stage),
                  r.get("ok") is True and back.get("Stage") == prior["Stage"]
                  and (back.get("Next Due") or "") == prior["Next Due"]
                  and (back.get("Follow-up At") or "") == prior["Follow-up At"], r)
            # re-advance so the walk can continue
            post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("w"),
                  "expect_stage": stage, "request_id": "e2e-%s-y%d" % (suffix, n),
                  **({"variant": vids[0]} if stage == "to_send" else {})})
    check("full 5-rung walk ends at done with no next due",
          _row(get({"token": TOKEN}), cid("w")).get("Stage") == "done"
          and not _row(get({"token": TOKEN}), cid("w")).get("Next Due"), _row(get({"token": TOKEN}), cid("w")))
    check("the walk kept the first-send stamp, not the seeded one",
          str(_row(get({"token": TOKEN}), cid("w")).get("Sent At", ""))[:10] == plus(0)
          and str(seeded_sent)[:10] == plus(-3),
          [_row(get({"token": TOKEN}), cid("w")).get("Sent At"), seeded_sent])
    check("a finished row refuses another send",
          post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("w"),
                "expect_stage": "done", "request_id": "e2e-%s-z" % suffix}).get("conflict") is True)

    # ---- a late follow-up does not shift the rest of the ladder ---------
    late = cid("l")
    post({"token": TOKEN, "action": "append",
          "rows": [base("l", "E2E Late", {"Stage": "day4", "Sent At": _iso(-9), "Next Due": plus(-5)})]})
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": late,
              "expect_stage": "day4", "request_id": "e2e-%s-late" % suffix})
    row = r.get("row") or {}
    check("day4 sent late -> day10 due on sent+10, not today+10",
          r.get("ok") is True and row.get("Stage") == "day10" and row.get("Next Due") == plus(1), row)
    check("the late send did not re-date Sent At", str(row.get("Sent At", ""))[:10] == plus(-9), row)

    # ---- skip -----------------------------------------------------------
    r = post({"token": TOKEN, "action": "skip", "contact_id": cid("b"),
              "expect_stage": "to_send", "request_id": "e2e-%s-9" % suffix})
    row = r.get("row") or {}
    check("skip defers to tomorrow", r.get("ok") is True and row.get("Next Due") == plus(1), r)
    check("skipped row keeps its stage", row.get("Stage") == "to_send", row)
    ids = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today"}).get("rows", [])]
    check("skipped row is out of today", cid("b") not in ids)
    ids_t = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today", "date": plus(1)}).get("rows", [])]
    check("skipped row is back tomorrow", cid("b") in ids_t)
    r = post({"token": TOKEN, "action": "undo", "contact_id": cid("b"),
              "expect_stage": "to_send", "request_id": "e2e-%s-10" % suffix})
    check("undo skip makes it due again today", r.get("ok") is True and not r["row"].get("Next Due"), r)

    # ---- replied --------------------------------------------------------
    r = post({"token": TOKEN, "action": "replied", "contact_id": cid("b"),
              "expect_stage": "to_send", "request_id": "e2e-%s-11" % suffix})
    row = r.get("row") or {}
    check("replied stops the sequence", r.get("ok") is True and row.get("Stage") == "replied"
          and not row.get("Next Due"), r)
    ids = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today"}).get("rows", [])]
    check("replied row leaves today", cid("b") not in ids)
    r = post({"token": TOKEN, "action": "undo", "contact_id": cid("b"),
              "expect_stage": "replied", "request_id": "e2e-%s-12" % suffix})
    check("undo replied restores the row", r.get("ok") is True and r["row"].get("Stage") == "to_send", r)

    # ---- skip at every follow-up rung, replied at every rung ------------
    RUNGS = [("to_send", 0), ("day4", 4), ("day10", 10), ("day18", 18), ("day30", 30),
             ("day45", 45)]
    rows = []
    for stage, off in RUNGS:
        extra = {"Stage": stage, "Sent At": _iso(-12), "Next Due": plus(2)}
        if stage == "to_send":
            extra = {"Stage": "to_send"}
        rows.append(base("k" + stage.replace("_", ""), "E2E %s" % stage, extra))
    r = post({"token": TOKEN, "action": "append", "rows": rows})
    check("one fixture per rung appended", r.get("ok") is True and r.get("touched") == 6, r)

    for stage, _off in RUNGS:
        key = "k" + stage.replace("_", "")
        cur = _row(get({"token": TOKEN}), cid(key))
        r = post({"token": TOKEN, "action": "skip", "contact_id": cid(key),
                  "expect_stage": stage, "request_id": "e2e-%s-sk%s" % (suffix, stage)})
        row = r.get("row") or {}
        check("skip at %s defers one day and keeps the stage" % stage,
              r.get("ok") is True and row.get("Stage") == stage and row.get("Next Due") == plus(1), r)
        r = post({"token": TOKEN, "action": "undo", "contact_id": cid(key),
                  "expect_stage": stage, "request_id": "e2e-%s-sku%s" % (suffix, stage)})
        check("undo skip at %s restores its due date" % stage,
              r.get("ok") is True and (r["row"].get("Next Due") or "") == (cur.get("Next Due") or ""), r)

    for stage, _off in RUNGS:
        key = "k" + stage.replace("_", "")
        r = post({"token": TOKEN, "action": "replied", "contact_id": cid(key),
                  "expect_stage": stage, "request_id": "e2e-%s-rp%s" % (suffix, stage)})
        row = r.get("row") or {}
        check("replied from %s stops the sequence" % stage,
              r.get("ok") is True and row.get("Stage") == "replied" and not row.get("Next Due"), r)
        ids = [x.get("Contact ID") for x in get({"token": TOKEN, "view": "today"}).get("rows", [])]
        check("replied from %s leaves Today" % stage, cid(key) not in ids, ids[-6:])
        r = post({"token": TOKEN, "action": "undo", "contact_id": cid(key),
                  "expect_stage": "replied", "request_id": "e2e-%s-rpu%s" % (suffix, stage)})
        check("undo replied from %s restores %s" % (stage, stage),
              r.get("ok") is True and r["row"].get("Stage") == stage, r)

    # double-click undo at a later rung: the second click is refused
    key = "kday18"
    post({"token": TOKEN, "action": "mark_sent", "contact_id": cid(key),
          "expect_stage": "day18", "request_id": "e2e-%s-dd18" % suffix})
    post({"token": TOKEN, "action": "undo", "contact_id": cid(key),
          "expect_stage": "day30", "request_id": "e2e-%s-dd18u" % suffix})
    r = post({"token": TOKEN, "action": "undo", "contact_id": cid(key),
              "expect_stage": "day30", "request_id": "e2e-%s-dd18u2" % suffix})
    check("double-click undo at day30 does not step twice",
          r.get("ok") is False and r.get("conflict") is True
          and _row(get({"token": TOKEN}), cid(key)).get("Stage") == "day18", r)

    # ---- refusals -------------------------------------------------------
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("e"),
              "expect_stage": "done", "request_id": "e2e-%s-13" % suffix})
    check("mark sent on a finished row conflicts", r.get("ok") is False and r.get("conflict") is True, r)
    r = post({"token": TOKEN, "action": "mark_snet", "contact_id": cid("a")})
    check("misspelled action refused", r.get("ok") is False and r.get("error") == "bad_action", r)
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": "ghost-" + suffix,
              "expect_stage": "to_send", "request_id": "e2e-%s-14" % suffix})
    check("unknown contact refused", r.get("ok") is False and r.get("error") == "no_row", r)
    r = post({"token": TOKEN, "action": "mark_sent", "contact_id": cid("b"), "variant": "manual"})
    check("missing expect_stage refused", r.get("ok") is False and r.get("error") == "bad_payload", r)

    # ---- one writer for sequence state ----------------------------------
    r = post({"token": TOKEN, "action": "update",
              "rows": [{"Contact ID": cid("c"), "Stage": "replied", "Sent At": "2000-01-01T00:00:00Z"}]})
    row = _row(get({"token": TOKEN}), cid("c"))
    check("generic update cannot write sequence state",
          row.get("Stage") == "day4" and row.get("Sent At") != "2000-01-01T00:00:00Z", row)
    r = post({"token": TOKEN, "action": "update",
              "rows": [{"Contact ID": cid("f"), "Dossier URL": "https://d/e2e",
                        "Research Status": "ready"}]})
    check("research ready seeds Stage=to_send", _row(get({"token": TOKEN}), cid("f")).get("Stage") == "to_send", r)

    # ---- legacy contract ------------------------------------------------
    r = get({"token": TOKEN, "status": "queued"})
    check("status=queued filter still works",
          all(str(x.get("Research Status")).strip() == "queued" for x in r.get("rows", [])), r.get("rows", [])[:3])
    r = post({"token": TOKEN, "action": "update", "rows": [{"Contact ID": "no-such-id-" + suffix}]})
    check("unknown row skipped", r.get("ok") is True and r.get("touched") == 0, r)
    before_c = _row(get({"token": TOKEN}), cid("c"))
    r = post({"token": TOKEN, "action": "update",
              "rows": [{"Contact ID": cid("c"), "No Such Column": "x"}]})
    check("unknown column writes nothing", _row(get({"token": TOKEN}), cid("c")) == before_c, r)
    r = post({"token": TOKEN, "action": "update",
              "rows": [{"Contact ID": "typo-" + suffix, "LinkedIn URL": "", "Notes": "SHOULD NOT LAND"}]})
    landed = any(x.get("Notes") == "SHOULD NOT LAND" for x in get({"token": TOKEN}).get("rows", []))
    check("blank-URL payload writes nothing", r.get("touched") == 0 and not landed, r)

    print("\n%d/%d checks passed" % (total - len(fails), total) if not fails
          else "\n%d/%d FAILED: %s" % (len(fails), total, ", ".join(fails)))
    if URL.startswith("http://127.0.0.1"):
        print("Ran against the real Code.gs in a local stub of the Apps Script runtime (throwaway).")
    else:
        print("E2E fixture rows left in the sheet with Contact IDs e2e%s* (no delete verb)." % suffix)
    return 0 if not fails else 1


def _row(payload, contact_id):
    return next((x for x in payload.get("rows", []) if x.get("Contact ID") == contact_id), {})


def _date(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except ValueError:
        return datetime.date(1970, 1, 1)


def _plus(iso_or_day, n):
    """The date `n` days after an ISO timestamp (or a YYYY-MM-DD day)."""
    return (_date(str(iso_or_day)[:10]) + datetime.timedelta(days=n)).isoformat()


def _plus_sent(row, n):
    return _plus(row.get("Sent At") or "", n)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print("HTTP %s from bridge: %s" % (e.code, e.read()[:400]), file=sys.stderr)
        sys.exit(3)
    finally:
        stop_sim()
