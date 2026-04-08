// =============================================================================
// HOME CARD QUIZ — Plays the daily quiz lesson INLINE on the daily-quiz-card.
//
// User taps the home daily-quiz card → its content card-wipes (golden wand
// sweep) and the first question appears on the same card. Each answer wipes
// the card to the next question, then on the 8th to a celebration. Wrong
// answers offer "Try again" or "Learn this" inline. The XP / streak / unit /
// module / health-iq plumbing reuses the existing learning pipeline by quietly
// triggering completeLesson at the end through a hidden host swap.
// =============================================================================

(function() {
    'use strict';

    // ----- Quiz state -----
    var HLQ = {
        active: false,
        lesson: null,
        unit: null,
        module: null,
        games: [],
        index: 0,
        correctCount: 0,
        attemptedThisQuestion: false,
        savedCardHtml: null,
        savedCardStyles: null,
        // per-question scratch state
        tapAllSelected: {},
        matchSelectedLeft: null,
        matchedPairs: []
    };

    var GAME_TYPES = {
        SWIPE_TRUE_FALSE: 'SWIPE_TRUE_FALSE',
        FILL_BLANK: 'FILL_BLANK',
        TAP_ALL: 'TAP_ALL',
        MATCH_PAIRS: 'MATCH_PAIRS',
        ORDER_SEQUENCE: 'ORDER_SEQUENCE',
        SCENARIO_STORY: 'SCENARIO_STORY'
    };

    // ----- One-time keyframe injection -----
    function injectKeyframes() {
        if (document.getElementById('hlq-keyframes')) return;
        var s = document.createElement('style');
        s.id = 'hlq-keyframes';
        s.textContent = [
            '@keyframes hlqWandSweep {',
            '  0%   { transform: translateX(-30%) skewX(-12deg); opacity: 0; }',
            '  12%  { opacity: 1; }',
            '  88%  { opacity: 1; }',
            '  100% { transform: translateX(calc(100% + 30%)) skewX(-12deg); opacity: 0; }',
            '}',
            '@keyframes hlqSparkleFloat {',
            '  0%   { transform: translate(0,0) scale(0.4); opacity: 0; }',
            '  20%  { opacity: 1; }',
            '  100% { transform: translate(var(--dx), var(--dy)) scale(1.2); opacity: 0; }',
            '}',
            '@keyframes hlqContentIn {',
            '  from { opacity: 0; transform: translateY(8px) scale(0.985); filter: blur(2px); }',
            '  to   { opacity: 1; transform: translateY(0)   scale(1);     filter: blur(0); }',
            '}',
            '@keyframes hlqContentOut {',
            '  from { opacity: 1; transform: translateY(0)   scale(1);     filter: blur(0); }',
            '  to   { opacity: 0; transform: translateY(-6px) scale(0.985); filter: blur(2px); }',
            '}',
            '@keyframes hlqPulse {',
            '  0%, 100% { transform: scale(1); }',
            '  50%      { transform: scale(1.06); }',
            '}',
            '@keyframes hlqXpPop {',
            '  0%   { transform: scale(0.5) rotate(-8deg); opacity: 0; }',
            '  60%  { transform: scale(1.15) rotate(2deg); opacity: 1; }',
            '  100% { transform: scale(1) rotate(0); opacity: 1; }',
            '}',
            '@keyframes hlqShake {',
            '  0%, 100% { transform: translateX(0); }',
            '  20%, 60% { transform: translateX(-6px); }',
            '  40%, 80% { transform: translateX(6px); }',
            '}',
            '.hlq-btn { transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }',
            '.hlq-btn:active { transform: scale(0.97); }',
            '.hlq-btn:hover { background: rgba(255,255,255,0.28); }',
            '.hlq-option-correct { background: rgba(16,185,129,0.85) !important; border-color: #fff !important; color: #fff !important; }',
            '.hlq-option-wrong   { background: rgba(239,68,68,0.85) !important;  border-color: #fff !important; color: #fff !important; }'
        ].join('\n');
        document.head.appendChild(s);
    }

    // ----- Public entry point -----
    function startInlineHomeLesson(lessonId) {
        // Wait for learning system to expose its data + state helpers
        if (typeof window._getLessonById !== 'function' || !window._learningState) {
            var attempts = 0;
            var waiter = setInterval(function() {
                attempts++;
                if (typeof window._getLessonById === 'function' && window._learningState) {
                    clearInterval(waiter);
                    startInlineHomeLesson(lessonId);
                } else if (attempts > 25) {
                    clearInterval(waiter);
                    // Fallback: open the learning tab the old way
                    if (typeof switchAppTab === 'function' && typeof window.startDailyQuiz === 'function') {
                        var nav = document.querySelectorAll('.nav-item')[3];
                        switchAppTab('learning', nav);
                        window.startDailyQuiz(lessonId);
                    }
                }
            }, 200);
            return;
        }

        var info = window._getLessonById(lessonId);
        if (!info || !info.lesson || !info.lesson.games || !info.lesson.games.length) return;

        injectKeyframes();

        HLQ.active = true;
        HLQ.lesson = info.lesson;
        HLQ.unit = info.unit;
        HLQ.module = info.module;
        HLQ.games = info.lesson.games.slice(0, 8); // align to 8 questions
        HLQ.index = 0;
        HLQ.correctCount = 0;
        HLQ.attemptedThisQuestion = false;
        HLQ.tapAllSelected = {};
        HLQ.matchSelectedLeft = null;
        HLQ.matchedPairs = [];

        enterCardQuizMode();
        // First question slides in with the wipe so the transition feels consistent
        wipeAndRender(buildQuestionHtml(0), function() {
            attachQuestionHandlers(0);
        });
    }
    window.startInlineHomeLesson = startInlineHomeLesson;

    // ----- Take over the daily quiz card -----
    function enterCardQuizMode() {
        var card = document.getElementById('daily-quiz-card');
        if (!card) return;

        HLQ.savedCardHtml = card.innerHTML;
        HLQ.savedCardStyles = {
            cursor: card.style.cursor,
            minHeight: card.style.minHeight,
            padding: card.style.padding
        };
        card.onclick = null;
        card.style.cursor = 'default';
        card.style.minHeight = '440px';
        card.style.padding = '18px 18px 20px';

        card.innerHTML = ''
            + '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.10);border-radius:50%;"></div>'
            + '<div style="position:absolute;bottom:-30px;left:-30px;width:80px;height:80px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>'
            + '<div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;">'
            + '  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">'
            + '    <div id="hlq-progress" style="flex:1;display:flex;gap:5px;"></div>'
            + '    <div id="hlq-score-pill" style="background:rgba(0,0,0,0.18);color:#fff;font-size:0.72rem;font-weight:700;padding:4px 9px;border-radius:10px;letter-spacing:0.3px;">0/8</div>'
            + '    <button id="hlq-close-btn" aria-label="Close quiz" style="background:rgba(0,0,0,0.18);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;padding:0;">&#x2715;</button>'
            + '  </div>'
            + '  <div id="hlq-stage" style="position:relative;flex:1;min-height:340px;overflow:hidden;border-radius:12px;">'
            + '    <div id="hlq-content" style="position:relative;z-index:1;"></div>'
            + '    <div id="hlq-wand" style="position:absolute;top:-10%;bottom:-10%;left:0;width:14px;background:linear-gradient(180deg, rgba(255,236,179,0) 0%, rgba(255,236,179,1) 50%, rgba(255,236,179,0) 100%);box-shadow:0 0 24px 8px rgba(255,215,128,0.85), 0 0 60px 16px rgba(255,180,80,0.45);pointer-events:none;opacity:0;border-radius:50%;"></div>'
            + '    <div id="hlq-sparkles" style="position:absolute;inset:0;pointer-events:none;z-index:2;"></div>'
            + '  </div>'
            + '</div>';

        renderProgressDots();
        document.getElementById('hlq-close-btn').onclick = function() {
            if (confirm('Exit the quiz? Your progress for this round won\'t be saved.')) {
                exitCardQuizMode(true);
            }
        };
    }

    function exitCardQuizMode(restore) {
        var card = document.getElementById('daily-quiz-card');
        if (!card) return;
        if (restore && HLQ.savedCardHtml != null) {
            card.innerHTML = HLQ.savedCardHtml;
        }
        if (HLQ.savedCardStyles) {
            card.style.cursor = HLQ.savedCardStyles.cursor || 'pointer';
            card.style.minHeight = HLQ.savedCardStyles.minHeight || '';
            card.style.padding = HLQ.savedCardStyles.padding || '';
        }
        HLQ.active = false;
        HLQ.savedCardHtml = null;
        HLQ.savedCardStyles = null;
        // Re-evaluate which version of the card to show (idle vs done)
        if (typeof window.checkAndShowDailyQuizCard === 'function') {
            try { window.checkAndShowDailyQuizCard(); } catch(e) {}
        }
    }

    // ----- Progress dots / score pill -----
    function renderProgressDots() {
        var dots = document.getElementById('hlq-progress');
        if (!dots) return;
        var html = '';
        for (var i = 0; i < HLQ.games.length; i++) {
            var bg = i < HLQ.index ? 'rgba(255,255,255,0.95)'
                   : i === HLQ.index ? 'rgba(255,255,255,0.55)'
                   : 'rgba(255,255,255,0.20)';
            html += '<div style="flex:1;height:5px;border-radius:3px;background:' + bg + ';transition:background 0.4s ease;"></div>';
        }
        dots.innerHTML = html;
        var pill = document.getElementById('hlq-score-pill');
        if (pill) pill.textContent = HLQ.correctCount + '/' + HLQ.games.length;
    }

    // ----- Magical wipe transition -----
    function wipeAndRender(newHtml, afterRender) {
        var content = document.getElementById('hlq-content');
        var wand = document.getElementById('hlq-wand');
        var sparkles = document.getElementById('hlq-sparkles');
        if (!content) return;

        // Restart wand animation
        if (wand) {
            wand.style.animation = 'none';
            // Force reflow
            void wand.offsetWidth;
            wand.style.animation = 'hlqWandSweep 720ms cubic-bezier(0.65, 0, 0.35, 1) forwards';
        }
        spawnSparkles(sparkles);

        // Old content fades + slight slide as the wand approaches
        content.style.animation = 'hlqContentOut 240ms ease forwards';

        setTimeout(function() {
            content.innerHTML = newHtml;
            content.style.animation = 'hlqContentIn 360ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards';
            renderProgressDots();
            if (typeof afterRender === 'function') afterRender();
        }, 280);
    }

    function spawnSparkles(host) {
        if (!host) return;
        host.innerHTML = '';
        var colors = ['#fff7d6', '#ffd97d', '#ffe9a8', '#ffffff'];
        for (var i = 0; i < 14; i++) {
            var s = document.createElement('div');
            var size = 4 + Math.random() * 4;
            var startX = 5 + Math.random() * 20; // start near left edge of stage
            var startY = 10 + Math.random() * 80;
            var dx = (60 + Math.random() * 220) + 'px';
            var dy = (Math.random() * 60 - 30) + 'px';
            s.style.cssText = ''
                + 'position:absolute;left:' + startX + '%;top:' + startY + '%;'
                + 'width:' + size + 'px;height:' + size + 'px;'
                + 'background:' + colors[i % colors.length] + ';border-radius:50%;'
                + 'box-shadow:0 0 8px 2px rgba(255,220,140,0.9);'
                + '--dx:' + dx + ';--dy:' + dy + ';'
                + 'animation:hlqSparkleFloat ' + (650 + Math.random() * 350) + 'ms ease-out forwards;'
                + 'animation-delay:' + (Math.random() * 120) + 'ms;';
            host.appendChild(s);
        }
        setTimeout(function() { if (host) host.innerHTML = ''; }, 1200);
    }

    // ----- Build question HTML -----
    function buildQuestionHtml(index) {
        var game = HLQ.games[index];
        var typeLabel = labelForType(game.type);
        var head = ''
            + '<div style="text-align:center;font-size:0.7rem;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px;">'
            + typeLabel
            + '</div>';
        var body = '';
        switch (game.type) {
            case GAME_TYPES.SWIPE_TRUE_FALSE: body = renderSwipeTF(game); break;
            case GAME_TYPES.FILL_BLANK:       body = renderFillBlank(game); break;
            case GAME_TYPES.TAP_ALL:          body = renderTapAll(game); break;
            case GAME_TYPES.MATCH_PAIRS:      body = renderMatchPairs(game); break;
            case GAME_TYPES.ORDER_SEQUENCE:   body = renderOrderSequence(game); break;
            case GAME_TYPES.SCENARIO_STORY:   body = renderScenario(game); break;
            default:                          body = renderFillBlank(game);
        }
        return head + body;
    }

    function labelForType(t) {
        switch (t) {
            case GAME_TYPES.SWIPE_TRUE_FALSE: return 'True or False';
            case GAME_TYPES.FILL_BLANK:       return 'Fill in the Blank';
            case GAME_TYPES.TAP_ALL:          return 'Select All That Apply';
            case GAME_TYPES.MATCH_PAIRS:      return 'Match the Pairs';
            case GAME_TYPES.ORDER_SEQUENCE:   return 'Put in Order';
            case GAME_TYPES.SCENARIO_STORY:   return 'Scenario';
            default:                          return 'Question';
        }
    }

    function questionBox(text) {
        return ''
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:18px 16px;margin-bottom:16px;backdrop-filter:blur(2px);">'
            + '  <p style="font-size:1.02rem;color:#fff;line-height:1.5;margin:0;font-weight:500;">' + text + '</p>'
            + '</div>';
    }

    // ----- Per-type renderers (compact, themed for the orange card) -----
    function renderSwipeTF(game) {
        return ''
            + questionBox(escapeHtml(game.question || ''))
            + '<div style="display:flex;gap:12px;">'
            + '  <button class="hlq-btn" data-hlq-tf="true"  style="flex:1;padding:18px 0;background:rgba(255,255,255,0.92);color:#059669;border:2px solid #fff;border-radius:14px;font-weight:800;font-size:1.05rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.12);">&#x2713; True</button>'
            + '  <button class="hlq-btn" data-hlq-tf="false" style="flex:1;padding:18px 0;background:rgba(255,255,255,0.92);color:#dc2626;border:2px solid #fff;border-radius:14px;font-weight:800;font-size:1.05rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.12);">&#x2715; False</button>'
            + '</div>';
    }

    function renderFillBlank(game) {
        var opts = shuffle((game.options || []).slice());
        var sentence = (game.sentence || '').replace(/_______/g,
            '<span style="display:inline-block;min-width:80px;border-bottom:3px solid #fff;margin:0 4px;padding:0 6px;font-weight:800;color:#fff7d6;">_____</span>');
        var btnsHtml = '';
        for (var i = 0; i < opts.length; i++) {
            btnsHtml += '<button class="hlq-btn hlq-fb-opt" data-hlq-fb="' + escapeAttr(opts[i]) + '" style="padding:13px 14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.35);border-radius:11px;color:#fff;font-size:0.93rem;cursor:pointer;text-align:left;font-weight:600;">' + escapeHtml(opts[i]) + '</button>';
        }
        return ''
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:16px 14px;margin-bottom:14px;">'
            + '  <p style="font-size:0.98rem;color:#fff;line-height:1.7;margin:0;font-weight:500;">' + sentence + '</p>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">' + btnsHtml + '</div>';
    }

    function renderTapAll(game) {
        var opts = (game.options || []);
        var btnsHtml = '';
        for (var i = 0; i < opts.length; i++) {
            var label = escapeHtml(opts[i].text || opts[i]);
            btnsHtml += '<button class="hlq-btn hlq-ta-opt" data-hlq-ta-idx="' + i + '" style="padding:12px 14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.35);border-radius:11px;color:#fff;font-size:0.92rem;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;font-weight:600;">'
                + '<span class="hlq-ta-check" style="width:20px;height:20px;border:2px solid rgba(255,255,255,0.7);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;"></span>'
                + label + '</button>';
        }
        return ''
            + questionBox(escapeHtml(game.question || ''))
            + '<div style="display:flex;flex-direction:column;gap:8px;">' + btnsHtml + '</div>'
            + '<button id="hlq-ta-check-btn" class="hlq-btn" style="margin-top:14px;width:100%;padding:13px;background:#fff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:0.98rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.12);">Check Answer</button>';
    }

    function renderMatchPairs(game) {
        var pairs = game.pairs || [];
        var rights = shuffle(pairs.slice());
        var leftHtml = '', rightHtml = '';
        for (var i = 0; i < pairs.length; i++) {
            leftHtml += '<button class="hlq-btn hlq-match-left" data-hlq-mp-left="' + i + '" style="padding:11px 8px;background:rgba(255,255,255,0.20);border:2px solid rgba(255,255,255,0.35);border-radius:10px;color:#fff;font-size:0.78rem;cursor:pointer;font-weight:700;min-height:46px;">' + escapeHtml(pairs[i].left) + '</button>';
        }
        for (var j = 0; j < rights.length; j++) {
            rightHtml += '<button class="hlq-btn hlq-match-right" data-hlq-mp-right="' + escapeAttr(rights[j].right) + '" style="padding:11px 8px;background:rgba(255,255,255,0.10);border:2px solid rgba(255,255,255,0.30);border-radius:10px;color:#fff;font-size:0.78rem;cursor:pointer;font-weight:600;min-height:46px;">' + escapeHtml(rights[j].right) + '</button>';
        }
        return ''
            + '<div style="text-align:center;font-size:0.82rem;color:rgba(255,255,255,0.85);margin-bottom:10px;">Tap a term, then its match</div>'
            + '<div style="display:flex;gap:10px;">'
            + '  <div style="flex:1;display:flex;flex-direction:column;gap:7px;">' + leftHtml + '</div>'
            + '  <div style="flex:1;display:flex;flex-direction:column;gap:7px;">' + rightHtml + '</div>'
            + '</div>';
    }

    function renderOrderSequence(game) {
        var items = (game.items || []).map(function(text, i) { return { text: text, correctIdx: i }; });
        items = shuffle(items);
        var listHtml = '';
        for (var i = 0; i < items.length; i++) {
            listHtml += '<div class="hlq-order-item" draggable="true" data-correct="' + items[i].correctIdx + '" style="padding:12px 14px;background:rgba(255,255,255,0.20);border:2px solid rgba(255,255,255,0.35);border-radius:11px;color:#fff;font-size:0.88rem;display:flex;align-items:center;gap:10px;cursor:grab;font-weight:600;user-select:none;">'
                + '<span class="hlq-order-num" style="width:24px;height:24px;background:rgba(0,0,0,0.20);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.78rem;flex-shrink:0;">' + (i + 1) + '</span>'
                + escapeHtml(items[i].text) + '</div>';
        }
        return ''
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:14px 16px;margin-bottom:12px;">'
            + '  <p style="font-size:0.95rem;color:#fff;margin:0;font-weight:500;">' + escapeHtml(game.question || 'Drag into the right order') + '</p>'
            + '</div>'
            + '<div id="hlq-order-list" style="display:flex;flex-direction:column;gap:7px;">' + listHtml + '</div>'
            + '<button id="hlq-order-check-btn" class="hlq-btn" style="margin-top:12px;width:100%;padding:13px;background:#fff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:0.98rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.12);">Check Order</button>';
    }

    function renderScenario(game) {
        var opts = (game.options || []);
        var btnsHtml = '';
        for (var i = 0; i < opts.length; i++) {
            var label = escapeHtml(opts[i].text || opts[i]);
            btnsHtml += '<button class="hlq-btn hlq-sc-opt" data-hlq-sc="' + i + '" style="padding:13px 14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.35);border-radius:11px;color:#fff;font-size:0.92rem;cursor:pointer;text-align:left;font-weight:600;">' + label + '</button>';
        }
        return ''
            + '<div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);border-radius:14px;padding:14px 16px;margin-bottom:10px;">'
            + '  <p style="font-size:0.86rem;color:rgba(255,255,255,0.92);line-height:1.55;margin:0;">' + escapeHtml(game.scenario || '') + '</p>'
            + '</div>'
            + '<div style="background:rgba(0,0,0,0.16);border-radius:11px;padding:12px 14px;margin-bottom:14px;">'
            + '  <p style="font-size:0.96rem;color:#fff;font-weight:700;margin:0;">' + escapeHtml(game.question || '') + '</p>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">' + btnsHtml + '</div>';
    }

    // ----- Per-type handler attachers -----
    function attachQuestionHandlers(index) {
        HLQ.attemptedThisQuestion = false;
        HLQ.tapAllSelected = {};
        HLQ.matchSelectedLeft = null;
        HLQ.matchedPairs = [];

        var game = HLQ.games[index];
        switch (game.type) {
            case GAME_TYPES.SWIPE_TRUE_FALSE: attachTF(game); break;
            case GAME_TYPES.FILL_BLANK:       attachFillBlank(game); break;
            case GAME_TYPES.TAP_ALL:          attachTapAll(game); break;
            case GAME_TYPES.MATCH_PAIRS:      attachMatchPairs(game); break;
            case GAME_TYPES.ORDER_SEQUENCE:   attachOrderSequence(game); break;
            case GAME_TYPES.SCENARIO_STORY:   attachScenario(game); break;
        }
    }

    function attachTF(game) {
        var btns = document.querySelectorAll('[data-hlq-tf]');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                HLQ.attemptedThisQuestion = true;
                var picked = btn.getAttribute('data-hlq-tf') === 'true';
                var correct = picked === !!game.answer;
                btn.classList.add(correct ? 'hlq-option-correct' : 'hlq-option-wrong');
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswerResult(correct, game);
            };
        });
    }

    function attachFillBlank(game) {
        var btns = document.querySelectorAll('.hlq-fb-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                HLQ.attemptedThisQuestion = true;
                var picked = btn.getAttribute('data-hlq-fb');
                var correct = picked === game.answer;
                btn.classList.add(correct ? 'hlq-option-correct' : 'hlq-option-wrong');
                if (!correct) {
                    btns.forEach(function(b) {
                        if (b.getAttribute('data-hlq-fb') === game.answer) b.classList.add('hlq-option-correct');
                    });
                }
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswerResult(correct, game);
            };
        });
    }

    function attachTapAll(game) {
        var btns = document.querySelectorAll('.hlq-ta-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                var idx = parseInt(btn.getAttribute('data-hlq-ta-idx'), 10);
                var sel = !HLQ.tapAllSelected[idx];
                HLQ.tapAllSelected[idx] = sel;
                var check = btn.querySelector('.hlq-ta-check');
                if (sel) {
                    btn.style.background = 'rgba(255,255,255,0.36)';
                    btn.style.borderColor = '#fff';
                    if (check) { check.innerHTML = '&#x2713;'; check.style.background = '#fff'; check.style.color = '#f97316'; }
                } else {
                    btn.style.background = 'rgba(255,255,255,0.18)';
                    btn.style.borderColor = 'rgba(255,255,255,0.35)';
                    if (check) { check.innerHTML = ''; check.style.background = 'transparent'; check.style.color = '#fff'; }
                }
            };
        });
        var checkBtn = document.getElementById('hlq-ta-check-btn');
        if (checkBtn) {
            checkBtn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                HLQ.attemptedThisQuestion = true;
                var ok = true;
                (game.options || []).forEach(function(opt, i) {
                    var should = !!opt.correct;
                    var picked = !!HLQ.tapAllSelected[i];
                    if (should !== picked) ok = false;
                });
                handleAnswerResult(ok, game);
            };
        }
    }

    function attachMatchPairs(game) {
        var pairs = game.pairs || [];
        var lefts = document.querySelectorAll('.hlq-match-left');
        var rights = document.querySelectorAll('.hlq-match-right');
        lefts.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                lefts.forEach(function(b) { b.style.borderColor = 'rgba(255,255,255,0.35)'; b.style.background = 'rgba(255,255,255,0.20)'; });
                btn.style.borderColor = '#fff';
                btn.style.background = 'rgba(255,255,255,0.42)';
                HLQ.matchSelectedLeft = parseInt(btn.getAttribute('data-hlq-mp-left'), 10);
            };
        });
        rights.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                if (HLQ.matchSelectedLeft == null) return;
                var leftIdx = HLQ.matchSelectedLeft;
                var correctRight = pairs[leftIdx].right;
                var picked = btn.getAttribute('data-hlq-mp-right');
                if (picked === correctRight) {
                    HLQ.matchedPairs.push(leftIdx);
                    btn.classList.add('hlq-option-correct');
                    btn.style.pointerEvents = 'none';
                    var leftBtn = document.querySelector('[data-hlq-mp-left="' + leftIdx + '"]');
                    if (leftBtn) {
                        leftBtn.classList.add('hlq-option-correct');
                        leftBtn.style.pointerEvents = 'none';
                    }
                    HLQ.matchSelectedLeft = null;
                    if (HLQ.matchedPairs.length === pairs.length) {
                        HLQ.attemptedThisQuestion = true;
                        handleAnswerResult(true, game);
                    }
                } else {
                    // Visual flash + count as wrong
                    HLQ.attemptedThisQuestion = true;
                    btn.classList.add('hlq-option-wrong');
                    var leftBtn2 = document.querySelector('[data-hlq-mp-left="' + leftIdx + '"]');
                    if (leftBtn2) leftBtn2.classList.add('hlq-option-wrong');
                    handleAnswerResult(false, game);
                }
            };
        });
    }

    function attachOrderSequence(game) {
        var list = document.getElementById('hlq-order-list');
        if (!list) return;
        var dragItem = null;
        var renumber = function() {
            list.querySelectorAll('.hlq-order-item').forEach(function(it, i) {
                var n = it.querySelector('.hlq-order-num');
                if (n) n.textContent = (i + 1);
            });
        };
        list.querySelectorAll('.hlq-order-item').forEach(function(item) {
            item.addEventListener('dragstart', function() { dragItem = item; item.style.opacity = '0.55'; });
            item.addEventListener('dragend', function() { item.style.opacity = '1'; dragItem = null; renumber(); });
            item.addEventListener('dragover', function(e) { e.preventDefault(); });
            item.addEventListener('drop', function(e) {
                e.preventDefault();
                if (!dragItem || dragItem === item) return;
                var arr = [].slice.call(list.querySelectorAll('.hlq-order-item'));
                var di = arr.indexOf(dragItem), dj = arr.indexOf(item);
                if (di < dj) list.insertBefore(dragItem, item.nextSibling);
                else         list.insertBefore(dragItem, item);
                renumber();
            });
            // Touch support
            item.addEventListener('touchstart', function() { dragItem = item; item.style.opacity = '0.7'; }, { passive: true });
            item.addEventListener('touchmove', function(e) {
                if (!dragItem) return;
                e.preventDefault();
                var t = e.touches[0];
                var arr = [].slice.call(list.querySelectorAll('.hlq-order-item'));
                for (var i = 0; i < arr.length; i++) {
                    var other = arr[i]; if (other === dragItem) continue;
                    var r = other.getBoundingClientRect();
                    if (t.clientY > r.top && t.clientY < r.bottom) {
                        var di2 = arr.indexOf(dragItem), dj2 = arr.indexOf(other);
                        if (di2 < dj2) list.insertBefore(dragItem, other.nextSibling);
                        else           list.insertBefore(dragItem, other);
                        renumber();
                        break;
                    }
                }
            }, { passive: false });
            item.addEventListener('touchend', function() { if (dragItem) { dragItem.style.opacity = '1'; dragItem = null; } });
        });
        var checkBtn = document.getElementById('hlq-order-check-btn');
        if (checkBtn) {
            checkBtn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                HLQ.attemptedThisQuestion = true;
                var arr = [].slice.call(list.querySelectorAll('.hlq-order-item'));
                var ok = true;
                arr.forEach(function(it, i) { if (parseInt(it.dataset.correct, 10) !== i) ok = false; });
                arr.forEach(function(it, i) {
                    if (parseInt(it.dataset.correct, 10) === i) it.classList.add('hlq-option-correct');
                    else it.classList.add('hlq-option-wrong');
                });
                handleAnswerResult(ok, game);
            };
        }
    }

    function attachScenario(game) {
        var btns = document.querySelectorAll('.hlq-sc-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attemptedThisQuestion) return;
                HLQ.attemptedThisQuestion = true;
                var idx = parseInt(btn.getAttribute('data-hlq-sc'), 10);
                var ok = !!(game.options[idx] && game.options[idx].correct);
                btn.classList.add(ok ? 'hlq-option-correct' : 'hlq-option-wrong');
                if (!ok) {
                    btns.forEach(function(b, i) { if (game.options[i] && game.options[i].correct) b.classList.add('hlq-option-correct'); });
                }
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswerResult(ok, game);
            };
        });
    }

    // ----- After answer: feedback flash, then advance or wrong-options -----
    function handleAnswerResult(correct, game) {
        if (correct) HLQ.correctCount++;
        // Update score pill immediately
        var pill = document.getElementById('hlq-score-pill');
        if (pill) pill.textContent = HLQ.correctCount + '/' + HLQ.games.length;

        // Brief feedback strip overlaid on the stage
        showFeedbackStrip(correct, game);

        if (correct) {
            setTimeout(function() {
                advanceToNext();
            }, 850);
        } else {
            // Shake, then show wrong-options panel after a beat
            var stage = document.getElementById('hlq-stage');
            if (stage) {
                stage.style.animation = 'hlqShake 360ms ease';
                setTimeout(function() { if (stage) stage.style.animation = ''; }, 380);
            }
            setTimeout(function() {
                showWrongOptions(game);
            }, 950);
        }
    }

    function showFeedbackStrip(correct, game) {
        var stage = document.getElementById('hlq-stage');
        if (!stage) return;
        var existing = document.getElementById('hlq-feedback-strip');
        if (existing) existing.remove();
        var bg = correct ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)';
        var icon = correct ? '&#x2713;' : '&#x2715;';
        var msg = correct ? 'Nice!' : 'Not quite';
        var strip = document.createElement('div');
        strip.id = 'hlq-feedback-strip';
        strip.style.cssText = 'position:absolute;left:8px;right:8px;top:8px;background:' + bg + ';color:#fff;border-radius:11px;padding:9px 12px;font-weight:800;font-size:0.92rem;display:flex;align-items:center;gap:9px;box-shadow:0 4px 14px rgba(0,0,0,0.22);z-index:5;animation:hlqContentIn 220ms ease forwards;';
        strip.innerHTML = '<span style="width:22px;height:22px;background:rgba(255,255,255,0.30);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;">' + icon + '</span>' + msg;
        stage.appendChild(strip);
        setTimeout(function() { if (strip && strip.parentNode) strip.remove(); }, 1200);
    }

    function showWrongOptions(game) {
        var explanation = (game && game.explanation) || (HLQ.lesson && HLQ.lesson.content && HLQ.lesson.content.keyPoint) || '';
        wipeAndRender(''
            + '<div style="text-align:center;font-size:0.7rem;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:10px;">A Hint</div>'
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:18px 16px;margin-bottom:18px;">'
            + '  <p style="font-size:0.95rem;color:#fff;line-height:1.55;margin:0;font-weight:500;">' + escapeHtml(explanation || 'Take another look — you\'ve got this.') + '</p>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:10px;">'
            + '  <button id="hlq-retry-btn"  class="hlq-btn" style="width:100%;padding:14px;background:#fff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.12);">Try this question again</button>'
            + '  <button id="hlq-learn-btn"  class="hlq-btn" style="width:100%;padding:14px;background:rgba(255,255,255,0.18);color:#fff;border:2px solid rgba(255,255,255,0.45);border-radius:12px;font-weight:700;font-size:0.95rem;cursor:pointer;">Read the full lesson</button>'
            + '</div>',
            function() {
                var retry = document.getElementById('hlq-retry-btn');
                var learn = document.getElementById('hlq-learn-btn');
                if (retry) retry.onclick = function() {
                    // Roll back the wrong answer so a perfect retry still scores 100%
                    if (HLQ.correctCount > 0 && false) { /* not needed: we never counted it */ }
                    wipeAndRender(buildQuestionHtml(HLQ.index), function() { attachQuestionHandlers(HLQ.index); });
                };
                if (learn) learn.onclick = function() {
                    // Hand off to the full learning view to read intro slides — keep it simple
                    var lessonId = HLQ.lesson && HLQ.lesson.id;
                    exitCardQuizMode(true);
                    if (typeof switchAppTab === 'function' && lessonId) {
                        var nav = document.querySelectorAll('.nav-item')[3];
                        switchAppTab('learning', nav);
                        if (typeof window.startLesson === 'function') {
                            setTimeout(function() { window.startLesson(lessonId); }, 250);
                        }
                    }
                };
            });
    }

    function advanceToNext() {
        HLQ.index++;
        if (HLQ.index >= HLQ.games.length) {
            finishQuiz();
            return;
        }
        wipeAndRender(buildQuestionHtml(HLQ.index), function() { attachQuestionHandlers(HLQ.index); });
    }

    // ----- Completion: trigger the existing completeLesson via host swap -----
    function finishQuiz() {
        var lesson = HLQ.lesson;
        var totalCorrect = HLQ.correctCount;
        var totalPlayed = HLQ.games.length;
        var perfect = (totalCorrect === totalPlayed);

        // Show celebration on the card immediately so the user sees something
        showCelebration(totalCorrect, totalPlayed);

        // Trigger the existing completeLesson plumbing in the background.
        // We do this by setting learningState to "just past the last question",
        // hosting a hidden div as `learning-content` so its render output is
        // invisible, and calling continueAfterFeedback (which advances index
        // past the end and triggers completeLesson).
        try {
            var ls = window._learningState;
            if (ls && lesson && typeof window.continueAfterFeedback === 'function') {
                ls.currentLesson = lesson;
                ls.gamesPlayed = totalPlayed;
                ls.gamesCorrect = totalCorrect;
                ls.currentGameIndex = totalPlayed - 1;
                ls.isDailyQuiz = true;

                // Create or reuse a hidden host so the lesson-complete UI is invisible
                var host = document.getElementById('__hlq-learning-host');
                if (!host) {
                    host = document.createElement('div');
                    host.id = '__hlq-learning-host';
                    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;visibility:hidden;';
                    document.body.appendChild(host);
                }
                var realContent = document.getElementById('learning-content');
                if (realContent && realContent !== host) realContent.id = '__hlq-learning-stash';
                host.id = 'learning-content';

                // Suppress the existing daily-quiz-card refresh — we own the card now.
                var origRefresh = window.refreshDailyQuizCard;
                window.refreshDailyQuizCard = function() {};

                // Kick the pipeline
                window.continueAfterFeedback();

                // Restore IDs and refresh function after the async chain settles
                setTimeout(function() {
                    var h = document.getElementById('learning-content');
                    if (h && h.id === 'learning-content' && h === host) h.id = '__hlq-learning-host';
                    var stash = document.getElementById('__hlq-learning-stash');
                    if (stash) stash.id = 'learning-content';
                    window.refreshDailyQuizCard = origRefresh;
                }, 4000);
            }
        } catch (e) {
            console.warn('[hlq] complete plumbing error:', e);
        }
    }

    function showCelebration(correct, total) {
        var perfect = (correct === total);
        var pct = Math.round((correct / total) * 100);
        var headline = perfect ? 'Perfect!' : (correct >= total - 1 ? 'So close!' : 'Lesson done');
        var subline = perfect ? 'Every question right' : correct + ' of ' + total + ' correct';
        var xpAmount = perfect ? 5 : 1; // visual hint; real XP is set by completeLesson RPC
        wipeAndRender(''
            + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 8px 0;">'
            + '  <div style="width:88px;height:88px;background:rgba(255,255,255,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:46px;margin-bottom:14px;box-shadow:0 8px 26px rgba(0,0,0,0.20);animation:hlqXpPop 600ms cubic-bezier(0.2,0.9,0.3,1.4) forwards;">'
            +      (perfect ? '&#x1F389;' : (correct >= total - 1 ? '&#x1F44D;' : '&#x1F4AA;'))
            + '  </div>'
            + '  <div style="font-size:1.55rem;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.18);margin-bottom:4px;">' + headline + '</div>'
            + '  <div style="font-size:0.92rem;color:rgba(255,255,255,0.92);font-weight:600;margin-bottom:18px;">' + subline + '</div>'
            + '  <div style="display:flex;align-items:baseline;gap:6px;background:rgba(255,255,255,0.95);color:#f97316;padding:10px 22px;border-radius:30px;box-shadow:0 6px 18px rgba(0,0,0,0.18);animation:hlqPulse 1.6s ease-in-out infinite;">'
            + '    <span style="font-size:1.6rem;font-weight:800;">+' + xpAmount + '</span>'
            + '    <span style="font-size:0.82rem;font-weight:800;letter-spacing:0.5px;">XP</span>'
            + '  </div>'
            + '  <button id="hlq-done-btn" class="hlq-btn" style="margin-top:24px;padding:13px 32px;background:rgba(255,255,255,0.20);color:#fff;border:2px solid rgba(255,255,255,0.55);border-radius:30px;font-weight:700;font-size:0.95rem;cursor:pointer;">Done</button>'
            + '</div>',
            function() {
                var btn = document.getElementById('hlq-done-btn');
                if (btn) btn.onclick = function() { exitCardQuizMode(true); };
                // Auto-close after 4s if user doesn't tap
                setTimeout(function() { if (HLQ.active) exitCardQuizMode(true); }, 4500);
            });
    }

    // ----- Helpers -----
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function escapeAttr(s) {
        return escapeHtml(s);
    }
})();
