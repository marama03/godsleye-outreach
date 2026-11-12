# Open your dashboard on your phone (Tailscale)

`http://localhost:...` only works on the computer that runs the dashboard. To open it on your phone, and put it on your home screen like an app, give it a private address with Tailscale. Only your own devices can open that address. It is free for personal use.

You do this once. About ten minutes.

> **Shortcut:** with the dashboard running (step 2), `node tools/phone-setup.mjs` does step 3 for you, checks the address answers, and prints it. Add `--install` to let it install Tailscale. An agent can run it for you.

## 1. Install Tailscale on both devices
- Computer: https://tailscale.com/download
- Phone: "Tailscale" in the App Store or Google Play

Sign in to the **same account** on both. Both should show as connected.

## 2. Start the dashboard in its steady mode
From the repo folder, in a terminal:

```
cd app
npm install
npm run build
npm start
```

Keep that window open. The dashboard now runs at http://127.0.0.1:8787. (If that port is taken, set `PORT=8790` first and use that number below.)

## 3. Give it a private address
In a second terminal on the same computer:

```
tailscale serve --bg --https=8446 http://127.0.0.1:8787
tailscale serve status
```

`status` prints your address, which looks like `https://<your-computer>.<your-tailnet>.ts.net:8446`. That is the link to use. It stays the same every time.

This address is private to your Tailscale account. Do **not** use `tailscale funnel`, which would make it public.

## 4. Put it on your phone's home screen
1. Make sure Tailscale is on, on the phone.
2. Open the address in Safari (iPhone) or Chrome (Android).
3. iPhone: Share, then **Add to Home Screen**. Android: menu, then **Install app** or **Add to Home screen**.

## If it stops working
- The computer must be on and the dashboard window still open. The address is permanent; the app behind it is not.
- Phone shows an error: check the Tailscale app is connected on the phone.
- Run `tailscale serve status` again; if the entry is missing, re-run the `tailscale serve` line from step 3.
- To remove it: `tailscale serve --https=8446 off`.
