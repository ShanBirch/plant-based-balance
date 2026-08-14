# Workout and PB text layout selection

- Launch date: 2026-08-14
- Variant name: `workout_pb_text_layouts_v1`
- Hypothesis: Letting members choose a large text layout independently from the colour treatment will make workout and PB shares easier to read and more likely to be posted.
- Primary KPI: completed workout or PB photo shares to Balance Feed or Instagram.
- Diagnostic metrics: selected `textStyle`, selected `overlayStyle`, share destination, share kind, and preview-to-share completion.
- Guardrail: no important text may enter the Instagram control zones or cover the person's head; sharing and XP award behaviour must remain unchanged.
- Decision date: 2026-09-11
- Decision rule: keep the selector if share completion is stable or higher and no mobile readability or share-delivery regression appears. Rework any layout that is rarely selected or repeatedly abandoned after preview.

The share payload stores `share_text_style` and `share_overlay_style`. Completed social-share XP metadata records the same two choices for workout and PB shares.
