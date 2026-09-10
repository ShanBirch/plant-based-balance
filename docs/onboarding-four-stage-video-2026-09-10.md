# Onboarding coach video correction

## Final revision: supplied voice and spoken-word reveals

Shannon supplied `ElevenLabs_2026-09-10T05_31_46_shanbot profesh_pvc_sp100_s35_sb75_se19_b_m2.mp3` and requested the original cumulative reveal style. The final asset uses that audio, without regenerating or speeding it up. The download label is `shanbot profesh`; its precise ElevenLabs voice ID is not established by the filename and is not assumed to be either saved clone.

The opaque black insert is now 11.1 seconds, replacing source 78.6–88.3. Everything after it shifts 1.4 seconds; final duration 129.3 seconds. Original League Gothic typography, cream words, gold arrows, upward fade and 0.94-to-1 scale are restored. Learn, Master, Become and Lead reveal at final times 83.079, 84.760, 86.519 and 88.800, respectively, using forced alignment of the supplied recording. Prior names remain visible. Source voice starts at 78.8 seconds with its pauses preserved.

Final video: 13,869,004 bytes; SHA-256 `b0b563375f7675f27e5de1aec00bd2d617fecd0e220ebf7a219040dfae03a2b9`. Supplied MP3 SHA-256 `b402171ccddeb47fcc01ba53bf26ea0406dfc6b1615ad4f0c57098e135f22e63`. Video references and script/service-worker versions were refreshed again.

Verification: HyperFrames runtime/layout/motion/contrast checks passed; rendered cumulative reveal and both joins visually inspected. Audio comparison confirms zero timing offset for the supplied voice; unchanged original audio has correlation above 0.9994, zero offset after allowing the intended 1.4-second shift, and volume differences below 0.04 dB. No clipping (replacement peak -2.5 dB). Six course-path tests pass. The final editable insert is retained in the Codex task at `work/reveal`, with the downloaded audio and alignment under `work`. A 15.5-second review excerpt is in `outputs/onboarding-reveal-preview.mp4`.

## Initial revision (superseded by the supplied-voice revision above)

Shannon authorized this correction and publication on 10 September 2026.

Replaced the three-stage passage at 78.6–88.3 seconds with one continuous approved ElevenLabs Shannon voice performance: “This is Learn, part one of a four-part journey. Learn. Master. Become. And Lead.” An opaque black screen displays the four stages with no presenter or old graphics beneath it. The rest of the recorded performance and existing music remain in place. Duration: 127.9 seconds; 540×960 H.264, 30 fps, AAC 48 kHz; 16,602,858 bytes.

Voice: UHnJrglEof8vTMenwnVm, verified account voice name Shannon Balance PVC 26min 20260606; eleven_multilingual_v2, stability 0.5, similarity 0.75, style 0, speaker boost enabled. Replacement voice gain 0.57, matched to the original. Source composition: HyperFrames 0.8.33, followed by app-size encoding and audio conform to preserve original AAC timing outside the correction.

Video SHA-256: `352a014968ae80c3b2afbc3fece078a21dde850c902c3dce947ed8e7875dfb4d`.

Updated preview and member video references with a cache version; updated script/service-worker versions. Corrected course-card display order and tour headings to Learn, Master, Become, Lead. Existing course IDs, saved progress and unlock rules are preserved.

Verification: HyperFrames check passed (no lint/runtime/layout/motion errors); inspected decoded frames around both edits and throughout the black card; independent transcription confirms four-part journey and Learn, Master, Become, Lead without repeated original speech; original audio comparisons at 1, 70 and 89 seconds have zero timing offset, correlation above 0.9994 and volume differences below 0.04 dB. Six course-path tests and three coach-video completion/poster tests pass. Four unrelated onboarding tests already fail on the unchanged base (calendar preview wording, reset ordering, first-lesson expectation, stale cache-version assertions); these were not altered.

Editable composition and QA artifacts are retained in the originating Codex task's work/video and outputs directories.
