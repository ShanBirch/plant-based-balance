# Weekly progress cards

Client cards use Balance cream and gold, neutral ink, a simple personal title (e.g. Shane’s weekly progress), and one comparison per exercise: This week / Next target. There is no rep ladder, session summary, coaching essay, or exercise-note clutter. Demo cards retain one small Sample data label. The message attachment contains its own explicit View progress button. The top-of-chat card editor was removed at Shannon’s request on 24 October 2026.

Reviewed snapshots are prepared through the authenticated weekly-progress API or the authorised coaching workflow, then attached to the exact existing text/voice nudge. No automatic message sending occurs. Drafts stay private, historical snapshots stay immutable, and each card retains its review week in storage.

The endpoint requires the live coach assignment for management and exact message ownership for attachment. Attached snapshots remain readable only by the two participants, including after coaching ends. The database has RLS, no direct anonymous/authenticated grants, service-only writes, and an immutability/message-binding trigger.

The view keeps Balance light/dark themes, internal scrolling, keyboard focus, navigation/swipe handling and mobile status-bar/home-indicator clearance. Late attachments preserve the chat’s pinned-bottom position without moving readers browsing history. Test deliveries use only Shannon’s confirmed accounts and clearly identified fictional statistics; never change actual training history or manufacture a coaching assignment.

The approved Editorial view reveals each exercise name, then recorded sets/load, a gold arrow, then next sets/load. Matching-unit weight increases temporarily show the previous load, Weight increased, then drop in the new load. Other comparisons never imply a load increase. Unparseable observations remain intact as wrapping text. Replay restarts the sequence; reduced-motion settings show the completed comparison immediately. Automatic internal scrolling follows each exercise and stops if the reader touches or scrolls the card. Closing cancels pending reveal/scroll work.
