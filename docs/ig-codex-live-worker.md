# Paid IG/FB live Codex worker

This is the dedicated local conversation owner for verified paid Meta lead conversations. Its conversation contract is deliberately isolated from the normal Balance AI coach, lead/client DM-manager wording, and unrelated older episodes. Existing production transport and safety gates remain in place.

## Flow

1. `ig-instant-draft` handles the webhook normally and builds the usual draft and safety review.
2. Every exact unlinked `paid_meta` thread uses the live worker unless its `ig_threads.custom_data.codex_live_chat_enabled` value is explicitly `false`. The function leaves the alert pending and stamps `data.codex_live_chat_required=true` instead of immediately dispatching the scripted reply.
3. The webhook atomically transfers that exact controller action from `dm_manager` to `codex_live_worker`. This prevents the normal manager from winning the race and sending its generic draft. The Windows worker polls only stamped alerts and claims only its dedicated owner.
4. The test opener `What is the Founders Pass?` starts a fresh test episode. Normal production threads retain their own background conversation, and a retry of the same alert reuses it instead of creating another one.
5. Codex reads the complete current episode and follows a flexible conversational path rather than fixed reply copy: brief answer, plant-based connection, goal, blocker, optional matched client proof, app video, and a personalised app preview before payment. It moves one natural step at a time and can change the order from live context. Every non-link reply must end with one purposeful question; preview and checkout link turns contain no question. Preview acceptance sends the signed preview immediately and never collects name or email in the DM. The worker signs the exact thread-bound preview URL before starting the turn, so Codex does not need to discover or regenerate the destination.
6. The scheduled ten-minute manager remains the fallback whenever the local worker is unavailable. A failed local turn releases its controller claim for retry after 30 seconds. The local poller enforces the same 30-second backoff so a verified no-send failure cannot spin through repeated Codex turns.

The local mapping between Instagram threads and background Codex conversations is stored under `%LOCALAPPDATA%\Balance\CodexLiveWorker`. No Supabase secret is written there. The worker obtains the existing Netlify environment at startup.

## Local checks

```powershell
node tests/ig-codex-live-worker.test.js
node scripts/ig-codex-live-worker.mjs --test-app-server
node scripts/ig-codex-live-worker.mjs --once --dry-run
```

## Install on Windows

Run from the checked-out repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-ig-codex-live-worker.ps1
```

This copies the worker into `%LOCALAPPDATA%\Balance\CodexLiveWorker`, registers `Balance IG Paid Lead Live Codex Worker` at logon, and starts it headlessly with `--codex-turn`. Lead turns run in the background and do not open or focus a task in the Codex desktop app. The optional `--open-chat` worker flag is reserved for manual diagnostics. `--direct-draft` is diagnostic-only and must never be used by the production scheduled task.

Disable an exact thread by setting `custom_data.codex_live_chat_enabled=false`. Removing the key restores the paid-Meta default. To remove the local scheduled task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-ig-codex-live-worker.ps1 -Uninstall
```
