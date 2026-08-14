# Paid IG/FB live Codex worker

This is an allowlisted local pilot for paid Meta lead conversations. Its conversation contract is deliberately isolated from the normal Balance AI coach, lead/client DM-manager wording, and older test episodes. Existing production transport and safety gates remain in place.

## Flow

1. `ig-instant-draft` handles the webhook normally and builds the usual draft and safety review.
2. If the exact unlinked paid-Meta `ig_threads` row has `custom_data.codex_live_chat_enabled=true`, the function leaves the alert pending and stamps `data.codex_live_chat_required=true` instead of immediately dispatching the scripted reply.
3. The Windows worker polls only those stamped alerts, claims the exact `dm_manager` controller action, and starts or resumes one named Codex chat for that IG thread.
4. Sending `What is the Founders Pass?` starts a fresh test episode and a fresh Codex chat. A retry of the same alert reuses that new chat instead of creating another one.
5. Codex reads only the current live episode for conversational state, follows the dedicated Founders Pass progression, sends through the existing production transport, and verifies readback. Every non-link reply must end with one purposeful question; link turns contain no question.
6. The scheduled ten-minute manager remains the fallback whenever the local worker is unavailable. A failed local turn releases its controller claim for retry after 30 seconds.

The local mapping between Instagram threads and Codex chats is stored under `%LOCALAPPDATA%\Balance\CodexLiveWorker`. No Supabase secret is written there. The worker obtains the existing Netlify environment at startup.

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

This copies the worker into `%LOCALAPPDATA%\Balance\CodexLiveWorker`, registers `Balance IG Paid Lead Live Codex Worker` at logon, and starts it. The first inbound for an enabled lead opens the corresponding named Codex chat using `codex://threads/<thread-id>`.

Disable a pilot thread by removing or setting `custom_data.codex_live_chat_enabled=false`. To remove the local scheduled task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-ig-codex-live-worker.ps1 -Uninstall
```
