# Sheet script — optional, not part of the setup

**This is the path the current design replaced.** The sheet is normally written by an agent through its
own Google connection: no script, no deployment, no token. Read this only if you specifically want the
script, or if you want to read the ladder arithmetic in one place.

If you do use it:

1. `Extensions → Apps Script` in a copy of the sheet, and paste `Code.gs` over the placeholder.
2. Run `setupBridge` once. It writes the header, installs the dropdowns, creates the `Messages` and
   `Events` tabs, adds the on-edit trigger, and prints a token.
3. `Deploy → New deployment → Web app`, execute as **Me**, access **Anyone**. Copy the `/exec` URL.
4. Put the URL and the token in the dashboard's `.env` as `BRIDGE_URL` and `BRIDGE_TOKEN`.

**Do not run the script and the Tracker against the same sheet.** Two writers on one row is the one
thing this design refuses: the script would re-stamp dates the Tracker is already keeping, and every
later due date moves with them. Pick one.
