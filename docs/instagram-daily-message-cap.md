# Instagram daily message maximum

Shannon set a maximum of **100 outgoing Instagram messages per Australia/Brisbane calendar day** on 6 November 2026, correcting an initial suggestion of 40.

The shared `shan_n_sunny` budget counts all canonical outbound messages already sent that day, including manual messages, and reserves pending automated sends. Native DM replies, private Story replies, welcomes, support and workout messages use the same budget. A manual send cannot be prevented by the worker, but it reduces the remaining automated allowance. Stricter recipient, purpose and platform restrictions still apply.

Read `ig_daily_message_budget_status('shan_n_sunny')` before claiming a send. The existing exact `ig_browser_action_owned` check now atomically reserves one slot after its original ownership/source/eligibility checks pass. Call it immediately before pasting and again immediately before Send; both checks reuse the same exact action/version/run/source reservation. Concurrent workers cannot each take the final slot.

Do not reset today's counter when enabling the rule. Once the budget is exhausted, keep reviewing permitted inbound and checkpoint replies owed without sending. Do not use reactions, another worker, another surface or a test message to bypass the limit. Unused allowance does not carry forward. After Brisbane midnight, recheck the new budget, latest source, all holds and Account Status before sending.

Reservations do not expire merely because a claim or browser lease expires. Uncertain sends continue to reserve their slot. Only an exact terminal no-send proof, verified reaction-only receipt, or matching canonical delivery reconciles a reservation; matched deliveries count once. Keep all earlier delivery/no-repeat records. Reaction-only receipts do not add a confirmed text message, and reactions are not a workaround after exhaustion.

The ledger and RPCs are service-only with RLS. This change adds no sender, scheduler, outreach permission, client-service exemption or platform bypass. It preserves the existing authority function unchanged under `ig_browser_action_owned_before_daily_cap` and applies the additional gate through the existing public RPC name. No website deployment is needed for this database/automation change.
