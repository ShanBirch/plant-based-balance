# Shorter lesson pages and focused imagery, 16 September 2026

Shannon requested easier-to-digest lesson reading pages without changing any words, facts or quizzes, and better images for the newly included lessons. His follow-up explicitly prioritised preserving the existing good photos and anatomy diagrams.

## Changes

- The presentation layer splits each original paragraph at sentence boundaries, up to 42 words / 280 characters per page. Unusually long sentences wrap at word boundaries. An older-WebView fallback preserves every word, including complete citation URLs. No lesson object is edited.
- Every page has its position in the lesson, Previous / Next, and the existing Skip option. The required researcher introduction still cannot be skipped during guided activation.
- The reading area scrolls internally. Controls stay above the home indicator and the course header clears the status bar, including zero-inset WebViews. Exiting the course hides the reader normally.
- Existing paragraph-to-image relationships are retained when a paragraph becomes multiple pages. Existing anatomy diagrams retain a 240px uncropped portrait canvas.
- New local MRI imagery is limited to the newly included mind-3, mind-7 and mind-8 units. The approved mind-6-5 social lesson uses a group photo, a walking photo and MRI context where relevant. No identifiable stock subject is shown alongside the obesity-study finding. Other Mind lessons, researcher portraits and all non-Mind image choices are preserved.
- Images have accessible descriptions and source/credit links; the MRI also links to its CC BY-SA licence. Full provenance is in assets/learning/CREDITS.md.
- Both dashboard script loaders, stylesheet URL and service-worker asset reference are versioned. Both feature-discovery systems include the presentation update.

The current approved social lesson remains eight questions, retains its qualified 57% observational association and Feed action, and now has 15 reading pages instead of seven paragraphs. The six-week layout and all continuation paths, evidence review, IDs, completion logic and member data remain unchanged.

## Verification

- All 203 complete lesson objects, including titles, content, image definitions and quiz answer mappings, deep-equal the production baseline dc3d5466.
- Thirty focused tests pass: all-word preservation across every lesson (modern and older-WebView paths), page length, paragraph/image association, scope of new imagery, current asset loading, quiz/theme/retry/completion and Learn layout contracts.
- Two hundred reading-page checks: social lesson, free-energy lesson and an existing anatomy lesson in light/dark, 375x667 portrait and 667x375 landscape, with zero and simulated 59px top / 34px bottom safe areas. Checked opening, every page, internal scrolling, previous/next, key insight, quiz start, leaving and reopening.
- Source/diagram images were visually inspected. Existing skeletal-muscle image was confirmed loaded at natural width 330 and visually reviewed after its external request completed.
- Browser evidence is in ignored output/lesson-pages/. These are browser tests, not physical-device tests. No real member data was written.
