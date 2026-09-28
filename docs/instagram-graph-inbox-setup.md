# Balance Instagram connection recovery

The shan_n_sunny Graph owner is 17841415641641750. Its account-scoped credential lives in app_private_secrets under meta_ig_access_token_17841415641641750. Renew through the existing Balance-IG app connection in Meta Developers, verify /v25.0/me user_id and username, then save the token privately with updated_at. Never put tokens in logs, screenshots, test fixtures or this repository.

The balance-ig-refresh scheduled function checks daily at 19:15 UTC and refreshes tokens after seven days. It verifies the same owner and username before a conditional update, so a concurrent reconnect is preserved. Failed refreshes fail the function visibly. Warm Graph workers reread secret credentials after one minute.

The September 28 failure combined an expired credential and an old alternative Learn assistant selected for the internal test thread. The current challenge test uses the canonical writer with offer_flow_variant=plant_based_challenge. An explicit challenge marker survives the Balance keyword; existing legacy keyword campaigns retain their route. Preserve conversation history and Graph cursors and use the existing internal-test episode boundary. Do not restart the paused legacy test automation or customer browser dispatcher as part of reconnection.

Live testing uses only the user-owned Little Companion Portraits to shan_n_sunny conversation. Preserve the counterpart portrait assistant's manual hold to prevent two bots replying to one another. Keep private journey receipts and screenshots outside the public repository.
