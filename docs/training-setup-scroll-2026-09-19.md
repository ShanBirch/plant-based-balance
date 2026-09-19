# Training setup first-opening scroll — 19 September 2026

Fixed interrupted wizard entrance cleanup. A same-step UI update cleared the pending animation timer but left `wizard-slide-transitioning` on the content panel, so `overflow:hidden` could persist indefinitely. Each update now releases that temporary lock before deciding whether to start another transition. Same-step updates preserve scroll position; back/forward transitions still reset it.

Verification:
- Reproduced the stuck first-opening swipe with the original code by refreshing during the chat-to-training entrance.
- Patched browser fixture uses the actual wizard markup, styles, update/transition functions and training summary renderer. Swipes down/up and back/reopen pass at 320x568, 390x844 and 844x390, light/dark, with 0/44px top and 0/34px bottom safe areas. Headers/buttons remain clear and lower options remain reachable. Recovery checkbox selection survives reopening.
- 30 focused onboarding/signup/coach/payment tests pass, including new interruption and return-navigation regression tests.
- Browser fixture supplies completed chat/profile state; it does not create a production account or exercise the entire intake conversation.
