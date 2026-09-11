# Balance quiz palette QA, 12 September 2026

Scope: cream and antique gold in light mode; charcoal, warm ivory and gold in dark mode. Applies to reading/intro, all six shared question renderers, selection, correct/retry feedback, completion/replay rewards and Health IQ level-up. Module IDs, lesson content, scoring and persistence are unchanged. This is a visual correction, not a new feature or tour step.

The separately requested payment-welcome design remains a local preview, now light-only. It is not connected to the payment flow by this change.

## Verification

- Ran the actual learning renderer and application styles in an isolated local browser harness. No signed-in user, purchase, production XP award or course-progress update was used.
- Rendered true/false, match pairs, order sequence, fill blank, scenario and select-all in both themes at 320px wide; no horizontal overflow. Each used the expected background (`#fbf7ee` / `#191b18`).
- Clicked selected answers; verified gold selected state, then incorrect feedback and working Retry. Clicked a correct answer and Continue; the next question appeared (2/7).
- Inspected reading and its Next button in dark mode; retained dark-on-light diagram captions.
- Inspected completion score, XP, progress bars, streak and Back to Course action after scrolling. Reopened completion and tested the replay variant separately.
- Visually captured light rewards, dark selected answers, light correct feedback, dark incorrect feedback, dark reading and both level-up themes.
- 375x667 reward: action bottom 489px after scrolling.
- 667x375 dark level-up, zero inset fallback: card top 44px, bottom 351px; scrolled Continue bottom 323px and clicked successfully.
- 320x568 light level-up with simulated 59px/34px safe insets: card top 77px, bottom 516px; Continue bottom 487px.
- Automated palette contrast checks cover both themes, selected answers, correct/incorrect surfaces and gold actions (4.5:1 minimum text contrast). Regression tests cover quiz XP, retries, matching, mascot, onboarding resume and tour placement.

Browser viewport simulation is not a physical iPhone check. The local harness is ignored output, not shipped application code.
