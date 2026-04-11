// =============================================================================
// HOME CARD QUIZ — Plays the daily quiz lesson INLINE on the daily-quiz-card.
//
// User taps the home daily-quiz card. The card itself wipes (golden wand
// sweep + sparkles) and the first question appears on the same card. Each
// answer wipes the card to the next question, then on the last question to
// a celebration. Wrong answers offer "Try again" or "Read the full lesson"
// inline. The XP / streak / unit / module / health-iq plumbing reuses the
// existing learning pipeline by triggering completeLesson at the end with
// learning-content swapped to a hidden offscreen host.
// =============================================================================

(function() {
    'use strict';

    // NOTE: these strings MUST match the lowercase values in
    // learning-inline.js's GAME_TYPES constant. If they drift out of sync,
    // every game falls through to the default branch of buildQuestionHtml
    // (which calls renderFillBlank on data that has no `sentence`, producing
    // an empty question box on the home card).
    var GT = {
        SWIPE_TRUE_FALSE: 'swipe_true_false',
        FILL_BLANK: 'fill_blank',
        TAP_ALL: 'tap_all',
        MATCH_PAIRS: 'match_pairs',
        ORDER_SEQUENCE: 'order_sequence',
        SCENARIO_STORY: 'scenario_story'
    };

    var HLQ = {
        active: false,
        lesson: null,
        unit: null,
        module: null,
        games: [],
        index: 0,
        correctCount: 0,
        attempted: false,
        savedHtml: null,
        savedStyles: null,
        // per-question scratch
        tapAllSelected: {},
        matchSelectedLeft: null,
        matchedPairs: []
    };

    // ----- One-time CSS injection -----
    function injectStyles() {
        if (document.getElementById('hlq-styles')) return;
        var s = document.createElement('style');
        s.id = 'hlq-styles';
        s.textContent = [
            '#hlq-card-root { position:relative; z-index:1; }',
            '#hlq-stage { position:relative; }',
            '#hlq-fxtrack { position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:14px; z-index:0; }',
            '#hlq-wand {',
            '  position:absolute; top:-15%; bottom:-15%; left:0; width:18px;',
            '  background:linear-gradient(180deg, rgba(255,236,179,0) 0%, rgba(255,245,210,1) 50%, rgba(255,236,179,0) 100%);',
            '  box-shadow:',
            '    0 0 22px 8px rgba(255,220,140,0.95),',
            '    0 0 60px 18px rgba(255,180,80,0.55),',
            '    0 0 110px 30px rgba(255,140,40,0.30);',
            '  border-radius:50%; opacity:0; transform:translateX(-30%) skewX(-14deg);',
            '}',
            '#hlq-content { position:relative; z-index:2; }',
            '@keyframes hlqWand {',
            '  0%   { transform: translateX(-30%) skewX(-14deg); opacity: 0; }',
            '  10%  { opacity: 1; }',
            '  90%  { opacity: 1; }',
            '  100% { transform: translateX(calc(100% + 30%)) skewX(-14deg); opacity: 0; }',
            '}',
            '@keyframes hlqSparkle {',
            '  0%   { transform: translate(0,0) scale(0.4); opacity: 0; }',
            '  20%  { opacity: 1; }',
            '  100% { transform: translate(var(--dx), var(--dy)) scale(1.15); opacity: 0; }',
            '}',
            '@keyframes hlqIn {',
            '  from { opacity: 0; transform: translateY(10px) scale(0.985); filter: blur(2px); }',
            '  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }',
            '}',
            '@keyframes hlqOut {',
            '  from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }',
            '  to   { opacity: 0; transform: translateY(-6px) scale(0.985); filter: blur(2.5px); }',
            '}',
            '@keyframes hlqShake {',
            '  0%, 100% { transform: translateX(0); }',
            '  20%, 60% { transform: translateX(-5px); }',
            '  40%, 80% { transform: translateX(5px); }',
            '}',
            '@keyframes hlqXpPop {',
            '  0%   { transform: scale(0.5) rotate(-8deg); opacity: 0; }',
            '  60%  { transform: scale(1.18) rotate(3deg); opacity: 1; }',
            '  100% { transform: scale(1) rotate(0); opacity: 1; }',
            '}',
            '@keyframes hlqPulse {',
            '  0%, 100% { transform: scale(1); }',
            '  50%      { transform: scale(1.05); }',
            '}',
            '.hlq-btn {',
            '  -webkit-tap-highlight-color: transparent;',
            '  transition: transform 140ms ease, background 200ms ease, border-color 200ms ease, box-shadow 200ms ease;',
            '}',
            '.hlq-btn:active { transform: scale(0.97); }',
            '.hlq-correct { background: rgba(16,185,129,0.92) !important; border-color: #ffffff !important; color: #ffffff !important; box-shadow: 0 0 0 2px rgba(255,255,255,0.4) !important; }',
            '.hlq-wrong   { background: rgba(239,68,68,0.92)  !important; border-color: #ffffff !important; color: #ffffff !important; box-shadow: 0 0 0 2px rgba(255,255,255,0.4) !important; }'
        ].join('\n');
        document.head.appendChild(s);
    }

    // ----- Public entry point -----
    function startInlineHomeLesson(lessonId) {
        if (typeof window._getLessonById !== 'function' || !window._learningState) {
            // Wait briefly for learning system to load
            var n = 0;
            var t = setInterval(function() {
                n++;
                if (typeof window._getLessonById === 'function' && window._learningState) {
                    clearInterval(t);
                    startInlineHomeLesson(lessonId);
                } else if (n > 25) {
                    clearInterval(t);
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
        if (!info || !info.lesson || !info.lesson.games || !info.lesson.games.length) {
            console.warn('[hlq] no lesson/games for', lessonId);
            return;
        }

        injectStyles();

        HLQ.active = true;
        HLQ.lesson = info.lesson;
        HLQ.unit = info.unit;
        HLQ.module = info.module;
        HLQ.games = info.lesson.games.slice(0, 8);
        HLQ.index = 0;
        HLQ.correctCount = 0;
        HLQ.attempted = false;
        HLQ.tapAllSelected = {};
        HLQ.matchSelectedLeft = null;
        HLQ.matchedPairs = [];

        // Summon Shanbot into the bottom-right corner so he can cheer on
        // the user through the daily quiz (same mascot used in the
        // Learning tab). He's hidden again in exitCardQuizMode.
        if (window.LearningMascot) {
            try { window.LearningMascot.show(); } catch (e) {}
        }

        // First the OLD card content gets a wand sweep & wipe-out, then we
        // swap to the quiz layout and wipe Q1 in. Two wipes = one continuous
        // magical reveal.
        firstWipeIntoQuiz();
    }
    window.startInlineHomeLesson = startInlineHomeLesson;

    function firstWipeIntoQuiz() {
        var card = document.getElementById('daily-quiz-card');
        if (!card) return;
        // Create a temporary fx track over the existing card content
        var fx = document.createElement('div');
        fx.id = 'hlq-firstwipe-fx';
        fx.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:16px;z-index:5;';
        fx.innerHTML = ''
            + '<div class="hlq-firstwand" style="position:absolute;top:-15%;bottom:-15%;left:0;width:18px;background:linear-gradient(180deg,rgba(255,236,179,0),rgba(255,245,210,1) 50%,rgba(255,236,179,0));box-shadow:0 0 22px 8px rgba(255,220,140,0.95),0 0 60px 18px rgba(255,180,80,0.55),0 0 110px 30px rgba(255,140,40,0.30);border-radius:50%;opacity:0;transform:translateX(-30%) skewX(-14deg);animation:hlqWand 720ms cubic-bezier(0.65,0,0.35,1) forwards;"></div>'
            + '<div class="hlq-firstsparkles" style="position:absolute;inset:0;"></div>';
        card.style.position = 'relative';
        card.appendChild(fx);

        // Sparkles
        spawnSparklesIn(fx.querySelector('.hlq-firstsparkles'));

        // Fade old content out
        var inner = card.firstElementChild ? card : card; // children include decorative bg + content wrapper
        // Apply fade to all children except the fx track
        Array.prototype.forEach.call(card.children, function(child) {
            if (child === fx) return;
            child.style.transition = 'opacity 260ms ease, transform 260ms ease, filter 260ms ease';
            child.style.opacity = '0';
            child.style.transform = 'scale(0.985)';
            child.style.filter = 'blur(2px)';
        });

        // At wipe midpoint, replace the card with quiz mode and animate Q1 in
        setTimeout(function() {
            enterCardQuizMode();
            renderQuestion(0, /*animate*/ true);
            // Remove temporary fx track once new layout is in place
            setTimeout(function() { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 500);
        }, 320);
    }

    // ----- Take over the card -----
    function enterCardQuizMode() {
        var card = document.getElementById('daily-quiz-card');
        if (!card) return;

        HLQ.savedHtml = card.innerHTML;
        HLQ.savedStyles = {
            cursor: card.style.cursor,
            minHeight: card.style.minHeight,
            padding: card.style.padding,
            display: card.style.display
        };
        card.onclick = null;
        card.style.cursor = 'default';
        card.style.padding = '18px 18px 22px';
        card.style.minHeight = '';   // grow naturally with content
        card.style.display = 'block';

        var lessonTitle = (HLQ.lesson && HLQ.lesson.title) || '';
        var moduleEmoji = ({ body: '💪', fuel: '🥗', mind: '🧠', longevity: '⏳', workouts: '🏋️', hormones: '🧪' })[(HLQ.module && HLQ.module.id) || ''] || '📚';

        card.innerHTML = ''
            + '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.10);border-radius:50%;"></div>'
            + '<div style="position:absolute;bottom:-30px;left:-30px;width:80px;height:80px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>'
            + '<div id="hlq-card-root">'
            + '  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
            + '    <div style="width:30px;height:30px;background:rgba(255,255,255,0.20);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">' + moduleEmoji + '</div>'
            + '    <div style="flex:1;min-width:0;">'
            + '      <div style="font-size:0.7rem;color:rgba(255,255,255,0.75);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Daily Quiz</div>'
            + '      <div style="font-size:0.86rem;color:#ffffff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(lessonTitle) + '</div>'
            + '    </div>'
            + '    <div id="hlq-score-pill" style="background:rgba(0,0,0,0.20);color:#fff;font-size:0.72rem;font-weight:800;padding:5px 10px;border-radius:11px;letter-spacing:0.4px;flex-shrink:0;">0/' + HLQ.games.length + '</div>'
            + '    <button id="hlq-close-btn" aria-label="Close quiz" style="background:rgba(0,0,0,0.20);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;padding:0;flex-shrink:0;">&#x2715;</button>'
            + '  </div>'
            + '  <div id="hlq-progress" style="display:flex;gap:5px;margin-bottom:14px;"></div>'
            + '  <div id="hlq-stage">'
            + '    <div id="hlq-fxtrack">'
            + '      <div id="hlq-wand"></div>'
            + '      <div id="hlq-sparkles"></div>'
            + '    </div>'
            + '    <div id="hlq-content"></div>'
            + '  </div>'
            + '</div>';

        renderProgressDots();
        var closeBtn = document.getElementById('hlq-close-btn');
        if (closeBtn) closeBtn.onclick = function(e) {
            // Stop propagation so the click can't bubble back up to the
            // card element and re-trigger startInlineHomeLesson — which
            // would otherwise happen because checkAndShowDailyQuizCard
            // (called from exitCardQuizMode) re-attaches card.onclick
            // synchronously while the click event is still bubbling.
            if (e) {
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                if (typeof e.preventDefault === 'function') e.preventDefault();
            }
            if (confirm('Exit the quiz? Your progress for this round won\'t be saved.')) {
                exitCardQuizMode(true);
            }
        };
    }

    function exitCardQuizMode(restore) {
        var card = document.getElementById('daily-quiz-card');
        if (!card) return;
        if (restore && HLQ.savedHtml != null) {
            card.innerHTML = HLQ.savedHtml;
        }
        if (HLQ.savedStyles) {
            card.style.cursor = HLQ.savedStyles.cursor || 'pointer';
            card.style.minHeight = HLQ.savedStyles.minHeight || '';
            card.style.padding = HLQ.savedStyles.padding || '';
            card.style.display = HLQ.savedStyles.display || '';
        }
        HLQ.active = false;
        HLQ.savedHtml = null;
        HLQ.savedStyles = null;
        // Shanbot leaves with the quiz.
        if (window.LearningMascot) {
            try { window.LearningMascot.hide(); } catch (e) {}
        }
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
            var bg = i < HLQ.index ? '#ffffff'
                   : i === HLQ.index ? 'rgba(255,255,255,0.65)'
                   : 'rgba(255,255,255,0.22)';
            html += '<div style="flex:1;height:5px;border-radius:3px;background:' + bg + ';transition:background 400ms ease;"></div>';
        }
        dots.innerHTML = html;
        var pill = document.getElementById('hlq-score-pill');
        if (pill) pill.textContent = HLQ.correctCount + '/' + HLQ.games.length;
    }

    // ----- Render a question (with optional wipe) -----
    function renderQuestion(index, animate) {
        HLQ.index = index;
        HLQ.attempted = false;
        HLQ.tapAllSelected = {};
        HLQ.matchSelectedLeft = null;
        HLQ.matchedPairs = [];

        var content = document.getElementById('hlq-content');
        if (!content) return;

        var html = buildQuestionHtml(index);

        if (animate) {
            // Trigger wand sweep + sparkles, fade old content out, fade new in
            var wand = document.getElementById('hlq-wand');
            var sparkles = document.getElementById('hlq-sparkles');
            if (wand) {
                wand.style.animation = 'none';
                requestAnimationFrame(function() {
                    wand.style.animation = 'hlqWand 720ms cubic-bezier(0.65, 0, 0.35, 1) forwards';
                });
            }
            spawnSparklesIn(sparkles);

            content.style.animation = 'hlqOut 240ms ease forwards';
            setTimeout(function() {
                content.innerHTML = html;
                content.style.animation = 'hlqIn 360ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards';
                renderProgressDots();
                attachQuestionHandlers(index);
            }, 260);
        } else {
            content.innerHTML = html;
            renderProgressDots();
            attachQuestionHandlers(index);
        }
    }

    function spawnSparklesIn(host) {
        if (!host) return;
        host.innerHTML = '';
        var colors = ['#fff7d6', '#ffd97d', '#ffe9a8', '#ffffff'];
        for (var i = 0; i < 16; i++) {
            var s = document.createElement('div');
            var size = 3 + Math.random() * 4;
            var startX = 2 + Math.random() * 22;
            var startY = 8 + Math.random() * 84;
            var dx = (60 + Math.random() * 240) + 'px';
            var dy = (Math.random() * 60 - 30) + 'px';
            s.style.cssText = ''
                + 'position:absolute;left:' + startX + '%;top:' + startY + '%;'
                + 'width:' + size + 'px;height:' + size + 'px;'
                + 'background:' + colors[i % colors.length] + ';border-radius:50%;'
                + 'box-shadow:0 0 8px 2px rgba(255,220,140,0.9);'
                + '--dx:' + dx + ';--dy:' + dy + ';'
                + 'animation:hlqSparkle ' + (650 + Math.random() * 400) + 'ms ease-out forwards;'
                + 'animation-delay:' + (Math.random() * 140) + 'ms;';
            host.appendChild(s);
        }
        setTimeout(function() { if (host) host.innerHTML = ''; }, 1300);
    }

    // ----- Per-type renderers -----
    function buildQuestionHtml(index) {
        var game = HLQ.games[index];
        if (!game) return '<div style="color:#fff;text-align:center;padding:30px;">No question found.</div>';
        var labelHtml = ''
            + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">'
            + '  <span style="font-size:0.65rem;color:rgba(255,255,255,0.78);text-transform:uppercase;letter-spacing:1.6px;font-weight:800;">' + labelForType(game.type) + '</span>'
            + '  <span style="font-size:0.65rem;color:rgba(255,255,255,0.55);font-weight:700;">·</span>'
            + '  <span style="font-size:0.65rem;color:rgba(255,255,255,0.78);font-weight:800;">' + (index + 1) + ' of ' + HLQ.games.length + '</span>'
            + '</div>';
        var body;
        switch (game.type) {
            case GT.SWIPE_TRUE_FALSE: body = renderSwipeTF(game); break;
            case GT.FILL_BLANK:       body = renderFillBlank(game); break;
            case GT.TAP_ALL:          body = renderTapAll(game); break;
            case GT.MATCH_PAIRS:      body = renderMatchPairs(game); break;
            case GT.ORDER_SEQUENCE:   body = renderOrderSequence(game); break;
            case GT.SCENARIO_STORY:   body = renderScenario(game); break;
            default:                  body = renderFillBlank(game);
        }
        return labelHtml + body;
    }

    function labelForType(t) {
        return ({
            swipe_true_false: 'True or False',
            fill_blank: 'Fill the Blank',
            tap_all: 'Tap All Correct',
            match_pairs: 'Match the Pairs',
            order_sequence: 'Put in Order',
            scenario_story: 'Scenario'
        })[t] || 'Question';
    }

    function questionBox(text) {
        return ''
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.30);border-radius:14px;padding:16px 16px;margin-bottom:14px;">'
            + '  <p style="font-size:0.98rem;color:#ffffff;line-height:1.5;margin:0;font-weight:600;">' + escapeHtml(text || '') + '</p>'
            + '</div>';
    }

    function renderSwipeTF(game) {
        return ''
            + questionBox(game.question || '')
            + '<div style="display:flex;gap:12px;">'
            + '  <button class="hlq-btn" data-hlq-tf="true"  style="flex:1;padding:18px 0;background:#ffffff;color:#059669;border:2px solid #ffffff;border-radius:14px;font-weight:800;font-size:1.05rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.18);">&#x2713; True</button>'
            + '  <button class="hlq-btn" data-hlq-tf="false" style="flex:1;padding:18px 0;background:#ffffff;color:#dc2626;border:2px solid #ffffff;border-radius:14px;font-weight:800;font-size:1.05rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.18);">&#x2715; False</button>'
            + '</div>';
    }

    function renderFillBlank(game) {
        var opts = shuffle((game.options || []).slice());
        var sentence = escapeHtml(game.sentence || '').replace(/_______/g,
            '<span style="display:inline-block;min-width:70px;border-bottom:3px solid #fff;margin:0 4px;padding:0 6px;font-weight:800;color:#fff7d6;">_____</span>');
        var btns = '';
        for (var i = 0; i < opts.length; i++) {
            btns += '<button class="hlq-btn hlq-fb-opt" data-hlq-fb="' + escapeAttr(opts[i]) + '" style="padding:13px 14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.40);border-radius:11px;color:#fff;font-size:0.94rem;cursor:pointer;text-align:left;font-weight:700;">' + escapeHtml(opts[i]) + '</button>';
        }
        return ''
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.30);border-radius:14px;padding:14px 14px;margin-bottom:14px;">'
            + '  <p style="font-size:0.98rem;color:#fff;line-height:1.7;margin:0;font-weight:600;">' + sentence + '</p>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">' + btns + '</div>';
    }

    function renderTapAll(game) {
        var opts = game.options || [];
        var btns = '';
        for (var i = 0; i < opts.length; i++) {
            var label = escapeHtml(opts[i].text || '');
            btns += '<button class="hlq-btn hlq-ta-opt" data-hlq-ta-idx="' + i + '" style="padding:11px 12px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.40);border-radius:11px;color:#fff;font-size:0.9rem;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;font-weight:600;">'
                + '<span class="hlq-ta-check" style="width:20px;height:20px;border:2px solid rgba(255,255,255,0.85);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:#f97316;background:transparent;"></span>'
                + label + '</button>';
        }
        return ''
            + questionBox(game.question || '')
            + '<div style="display:flex;flex-direction:column;gap:7px;">' + btns + '</div>'
            + '<button id="hlq-ta-check-btn" class="hlq-btn" style="margin-top:12px;width:100%;padding:13px;background:#ffffff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:0.98rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.18);">Check Answer</button>';
    }

    function renderMatchPairs(game) {
        var pairs = game.pairs || [];
        var rights = shuffle(pairs.slice());
        var leftHtml = '', rightHtml = '';
        for (var i = 0; i < pairs.length; i++) {
            leftHtml += '<button class="hlq-btn hlq-match-left" data-hlq-mp-left="' + i + '" style="padding:10px 8px;background:rgba(255,255,255,0.20);border:2px solid rgba(255,255,255,0.40);border-radius:10px;color:#fff;font-size:0.78rem;cursor:pointer;font-weight:700;min-height:46px;line-height:1.25;">' + escapeHtml(pairs[i].left) + '</button>';
        }
        for (var j = 0; j < rights.length; j++) {
            rightHtml += '<button class="hlq-btn hlq-match-right" data-hlq-mp-right="' + escapeAttr(rights[j].right) + '" style="padding:10px 8px;background:rgba(255,255,255,0.10);border:2px solid rgba(255,255,255,0.35);border-radius:10px;color:#fff;font-size:0.78rem;cursor:pointer;font-weight:600;min-height:46px;line-height:1.25;">' + escapeHtml(rights[j].right) + '</button>';
        }
        return ''
            + '<div style="text-align:center;font-size:0.82rem;color:rgba(255,255,255,0.92);margin-bottom:10px;font-weight:600;">Tap a term, then its match</div>'
            + '<div style="display:flex;gap:9px;">'
            + '  <div style="flex:1;display:flex;flex-direction:column;gap:7px;">' + leftHtml + '</div>'
            + '  <div style="flex:1;display:flex;flex-direction:column;gap:7px;">' + rightHtml + '</div>'
            + '</div>';
    }

    function renderOrderSequence(game) {
        var items = (game.items || []).map(function(text, i) { return { text: text, correctIdx: i }; });
        items = shuffle(items);
        var listHtml = '';
        for (var i = 0; i < items.length; i++) {
            listHtml += '<div class="hlq-order-item" draggable="true" data-correct="' + items[i].correctIdx + '" style="padding:11px 12px;background:rgba(255,255,255,0.20);border:2px solid rgba(255,255,255,0.40);border-radius:11px;color:#fff;font-size:0.85rem;display:flex;align-items:center;gap:10px;cursor:grab;font-weight:600;user-select:none;line-height:1.3;">'
                + '<span class="hlq-order-num" style="width:24px;height:24px;background:rgba(0,0,0,0.22);border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.78rem;flex-shrink:0;">' + (i + 1) + '</span>'
                + '<span style="flex:1;">' + escapeHtml(items[i].text) + '</span>'
                + '<span style="opacity:0.6;font-size:0.85rem;flex-shrink:0;">&#x2630;</span>'
                + '</div>';
        }
        return ''
            + questionBox(game.question || 'Drag into the right order')
            + '<div id="hlq-order-list" style="display:flex;flex-direction:column;gap:7px;">' + listHtml + '</div>'
            + '<button id="hlq-order-check-btn" class="hlq-btn" style="margin-top:12px;width:100%;padding:13px;background:#ffffff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:0.98rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.18);">Check Order</button>';
    }

    function renderScenario(game) {
        var opts = game.options || [];
        var btns = '';
        for (var i = 0; i < opts.length; i++) {
            var label = escapeHtml(opts[i].text || '');
            btns += '<button class="hlq-btn hlq-sc-opt" data-hlq-sc="' + i + '" style="padding:13px 14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.40);border-radius:11px;color:#fff;font-size:0.92rem;cursor:pointer;text-align:left;font-weight:600;line-height:1.4;">' + label + '</button>';
        }
        return ''
            + '<div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:13px 14px;margin-bottom:9px;">'
            + '  <p style="font-size:0.85rem;color:rgba(255,255,255,0.94);line-height:1.55;margin:0;">' + escapeHtml(game.scenario || '') + '</p>'
            + '</div>'
            + '<div style="background:rgba(0,0,0,0.18);border-radius:11px;padding:11px 14px;margin-bottom:12px;">'
            + '  <p style="font-size:0.95rem;color:#fff;font-weight:700;margin:0;">' + escapeHtml(game.question || '') + '</p>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">' + btns + '</div>';
    }

    // ----- Handlers -----
    function attachQuestionHandlers(index) {
        var game = HLQ.games[index];
        if (!game) return;
        switch (game.type) {
            case GT.SWIPE_TRUE_FALSE: attachTF(game); break;
            case GT.FILL_BLANK:       attachFillBlank(game); break;
            case GT.TAP_ALL:          attachTapAll(game); break;
            case GT.MATCH_PAIRS:      attachMatchPairs(game); break;
            case GT.ORDER_SEQUENCE:   attachOrder(game); break;
            case GT.SCENARIO_STORY:   attachScenario(game); break;
        }
    }

    function attachTF(game) {
        var btns = document.querySelectorAll('[data-hlq-tf]');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                HLQ.attempted = true;
                var picked = btn.getAttribute('data-hlq-tf') === 'true';
                var correct = picked === !!game.answer;
                btn.classList.add(correct ? 'hlq-correct' : 'hlq-wrong');
                if (!correct) {
                    btns.forEach(function(b) {
                        if ((b.getAttribute('data-hlq-tf') === 'true') === !!game.answer) {
                            b.classList.add('hlq-correct');
                        }
                    });
                }
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswer(correct, game);
            };
        });
    }

    function attachFillBlank(game) {
        var btns = document.querySelectorAll('.hlq-fb-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                HLQ.attempted = true;
                var picked = btn.getAttribute('data-hlq-fb');
                var correct = picked === game.answer;
                btn.classList.add(correct ? 'hlq-correct' : 'hlq-wrong');
                if (!correct) {
                    btns.forEach(function(b) {
                        if (b.getAttribute('data-hlq-fb') === game.answer) b.classList.add('hlq-correct');
                    });
                }
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswer(correct, game);
            };
        });
    }

    function attachTapAll(game) {
        var btns = document.querySelectorAll('.hlq-ta-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                var idx = parseInt(btn.getAttribute('data-hlq-ta-idx'), 10);
                var sel = !HLQ.tapAllSelected[idx];
                HLQ.tapAllSelected[idx] = sel;
                var check = btn.querySelector('.hlq-ta-check');
                if (sel) {
                    btn.style.background = 'rgba(255,255,255,0.40)';
                    btn.style.borderColor = '#ffffff';
                    if (check) { check.innerHTML = '&#x2713;'; check.style.background = '#ffffff'; }
                } else {
                    btn.style.background = 'rgba(255,255,255,0.18)';
                    btn.style.borderColor = 'rgba(255,255,255,0.40)';
                    if (check) { check.innerHTML = ''; check.style.background = 'transparent'; }
                }
            };
        });
        var checkBtn = document.getElementById('hlq-ta-check-btn');
        if (checkBtn) checkBtn.onclick = function() {
            if (HLQ.attempted) return;
            HLQ.attempted = true;
            var ok = true;
            (game.options || []).forEach(function(opt, i) {
                var should = !!opt.correct;
                var picked = !!HLQ.tapAllSelected[i];
                if (should !== picked) ok = false;
            });
            // Highlight what was correct
            btns.forEach(function(b, i) {
                if ((game.options[i] || {}).correct) b.classList.add('hlq-correct');
                else if (HLQ.tapAllSelected[i]) b.classList.add('hlq-wrong');
            });
            handleAnswer(ok, game);
        };
    }

    function attachMatchPairs(game) {
        var pairs = game.pairs || [];
        var lefts = document.querySelectorAll('.hlq-match-left');
        var rights = document.querySelectorAll('.hlq-match-right');
        lefts.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                lefts.forEach(function(b) {
                    if (!b.classList.contains('hlq-correct')) {
                        b.style.borderColor = 'rgba(255,255,255,0.40)';
                        b.style.background = 'rgba(255,255,255,0.20)';
                    }
                });
                btn.style.borderColor = '#ffffff';
                btn.style.background = 'rgba(255,255,255,0.42)';
                HLQ.matchSelectedLeft = parseInt(btn.getAttribute('data-hlq-mp-left'), 10);
            };
        });
        rights.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                if (HLQ.matchSelectedLeft == null) return;
                var leftIdx = HLQ.matchSelectedLeft;
                var correctRight = pairs[leftIdx].right;
                var picked = btn.getAttribute('data-hlq-mp-right');
                if (picked === correctRight) {
                    HLQ.matchedPairs.push(leftIdx);
                    btn.classList.add('hlq-correct');
                    btn.style.pointerEvents = 'none';
                    var leftBtn = document.querySelector('[data-hlq-mp-left="' + leftIdx + '"]');
                    if (leftBtn) {
                        leftBtn.classList.add('hlq-correct');
                        leftBtn.style.pointerEvents = 'none';
                    }
                    HLQ.matchSelectedLeft = null;
                    if (HLQ.matchedPairs.length === pairs.length) {
                        HLQ.attempted = true;
                        handleAnswer(true, game);
                    }
                } else {
                    HLQ.attempted = true;
                    btn.classList.add('hlq-wrong');
                    var leftBtn2 = document.querySelector('[data-hlq-mp-left="' + leftIdx + '"]');
                    if (leftBtn2) leftBtn2.classList.add('hlq-wrong');
                    handleAnswer(false, game);
                }
            };
        });
    }

    function attachOrder(game) {
        var list = document.getElementById('hlq-order-list');
        if (!list) return;
        var dragItem = null;
        function renumber() {
            list.querySelectorAll('.hlq-order-item').forEach(function(it, i) {
                var n = it.querySelector('.hlq-order-num');
                if (n) n.textContent = (i + 1);
            });
        }
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
            // Touch
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
        if (checkBtn) checkBtn.onclick = function() {
            if (HLQ.attempted) return;
            HLQ.attempted = true;
            var arr = [].slice.call(list.querySelectorAll('.hlq-order-item'));
            var ok = true;
            arr.forEach(function(it, i) {
                if (parseInt(it.dataset.correct, 10) !== i) ok = false;
            });
            arr.forEach(function(it, i) {
                if (parseInt(it.dataset.correct, 10) === i) it.classList.add('hlq-correct');
                else it.classList.add('hlq-wrong');
            });
            handleAnswer(ok, game);
        };
    }

    function attachScenario(game) {
        var btns = document.querySelectorAll('.hlq-sc-opt');
        btns.forEach(function(btn) {
            btn.onclick = function() {
                if (HLQ.attempted) return;
                HLQ.attempted = true;
                var idx = parseInt(btn.getAttribute('data-hlq-sc'), 10);
                var ok = !!((game.options[idx] || {}).correct);
                btn.classList.add(ok ? 'hlq-correct' : 'hlq-wrong');
                if (!ok) {
                    btns.forEach(function(b, i) {
                        if ((game.options[i] || {}).correct) b.classList.add('hlq-correct');
                    });
                }
                btns.forEach(function(b) { b.disabled = true; });
                handleAnswer(ok, game);
            };
        });
    }

    // ----- Answer flow -----
    function handleAnswer(correct, game) {
        if (correct) HLQ.correctCount++;
        var pill = document.getElementById('hlq-score-pill');
        if (pill) pill.textContent = HLQ.correctCount + '/' + HLQ.games.length;

        // Shanbot mascot reacts in the bottom-right bubble instead of an
        // in-card "Nice!" toast. Correct answers get a cheer; wrong answers
        // get a quick sad reaction (the in-card hint screen still explains).
        if (correct) {
            if (window.LearningMascot) {
                try { window.LearningMascot.onCorrect(HLQ.correctCount); } catch (e) {}
            }
            setTimeout(function() { advance(); }, 850);
        } else {
            if (window.LearningMascot) {
                try { window.LearningMascot.onIncorrect(); } catch (e) {}
            }
            showFeedbackStrip(false);
            var stage = document.getElementById('hlq-stage');
            if (stage) {
                stage.style.animation = 'hlqShake 360ms ease';
                setTimeout(function() { if (stage) stage.style.animation = ''; }, 380);
            }
            setTimeout(function() { showWrongOptions(game); }, 950);
        }
    }

    function showFeedbackStrip(correct) {
        // Only used for wrong answers now — correct answers are celebrated
        // by the Shanbot mascot bubble, not an in-card toast.
        var stage = document.getElementById('hlq-stage');
        if (!stage) return;
        var existing = document.getElementById('hlq-feedback-strip');
        if (existing) existing.remove();
        var bg = correct ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)';
        var icon = correct ? '&#x2713;' : '&#x2715;';
        var msg = correct ? 'Nice!' : 'Not quite';
        var strip = document.createElement('div');
        strip.id = 'hlq-feedback-strip';
        strip.style.cssText = 'position:absolute;left:6px;right:6px;top:6px;background:' + bg + ';color:#fff;border-radius:11px;padding:9px 12px;font-weight:800;font-size:0.92rem;display:flex;align-items:center;gap:9px;box-shadow:0 4px 14px rgba(0,0,0,0.22);z-index:10;animation:hlqIn 220ms ease forwards;';
        strip.innerHTML = '<span style="width:22px;height:22px;background:rgba(255,255,255,0.30);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;">' + icon + '</span>' + msg;
        stage.appendChild(strip);
        setTimeout(function() { if (strip && strip.parentNode) strip.remove(); }, 1300);
    }

    function showWrongOptions(game) {
        var explanation = (game && game.explanation) || (HLQ.lesson && HLQ.lesson.content && HLQ.lesson.content.keyPoint) || 'Take another look — you\'ve got this.';
        var html = ''
            + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">'
            + '  <span style="font-size:0.65rem;color:rgba(255,255,255,0.78);text-transform:uppercase;letter-spacing:1.6px;font-weight:800;">A Hint</span>'
            + '</div>'
            + '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.30);border-radius:14px;padding:16px 16px;margin-bottom:14px;">'
            + '  <p style="font-size:0.94rem;color:#fff;line-height:1.55;margin:0;font-weight:500;">' + escapeHtml(explanation) + '</p>'
            + '</div>'
            + '<button id="hlq-retry-btn" class="hlq-btn" style="width:100%;padding:14px;background:#ffffff;color:#f97316;border:none;border-radius:12px;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.18);margin-bottom:9px;">Try this question again</button>'
            + '<button id="hlq-learn-btn" class="hlq-btn" style="width:100%;padding:13px;background:rgba(255,255,255,0.18);color:#fff;border:2px solid rgba(255,255,255,0.50);border-radius:12px;font-weight:700;font-size:0.92rem;cursor:pointer;">Read the full lesson</button>';

        wipeContent(html, function() {
            var retry = document.getElementById('hlq-retry-btn');
            var learn = document.getElementById('hlq-learn-btn');
            if (retry) retry.onclick = function() {
                renderQuestion(HLQ.index, true);
            };
            if (learn) learn.onclick = function() {
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

    function wipeContent(html, after) {
        var content = document.getElementById('hlq-content');
        if (!content) return;
        var wand = document.getElementById('hlq-wand');
        var sparkles = document.getElementById('hlq-sparkles');
        if (wand) {
            wand.style.animation = 'none';
            requestAnimationFrame(function() {
                wand.style.animation = 'hlqWand 720ms cubic-bezier(0.65, 0, 0.35, 1) forwards';
            });
        }
        spawnSparklesIn(sparkles);
        content.style.animation = 'hlqOut 240ms ease forwards';
        setTimeout(function() {
            content.innerHTML = html;
            content.style.animation = 'hlqIn 360ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards';
            if (typeof after === 'function') after();
        }, 260);
    }

    function advance() {
        if (HLQ.index + 1 >= HLQ.games.length) {
            finishQuiz();
            return;
        }
        renderQuestion(HLQ.index + 1, true);
    }

    // ----- Completion: trigger existing completeLesson via host swap -----
    function finishQuiz() {
        showCelebration(HLQ.correctCount, HLQ.games.length);

        try {
            var ls = window._learningState;
            var lesson = HLQ.lesson;
            if (!ls || !lesson || typeof window.continueAfterFeedback !== 'function') return;

            ls.currentLesson = lesson;
            ls.gamesPlayed = HLQ.games.length;
            ls.gamesCorrect = HLQ.correctCount;
            ls.currentGameIndex = HLQ.games.length - 1;
            ls.isDailyQuiz = true;

            // Hidden offscreen host so existing render output is invisible
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

            // Suppress existing card refresh while we own the card
            var origRefresh = window.refreshDailyQuizCard;
            window.refreshDailyQuizCard = function() {};

            window.continueAfterFeedback();

            setTimeout(function() {
                var h = document.getElementById('learning-content');
                if (h && h === host) h.id = '__hlq-learning-host';
                var stash = document.getElementById('__hlq-learning-stash');
                if (stash) stash.id = 'learning-content';
                window.refreshDailyQuizCard = origRefresh;
            }, 4000);
        } catch (e) {
            console.warn('[hlq] complete plumbing error:', e);
        }
    }

    function showCelebration(correct, total) {
        var perfect = (correct === total);
        var headline = perfect ? 'Perfect!' : (correct >= total - 1 ? 'So close!' : 'Lesson done');
        var subline = perfect ? 'Every question right' : correct + ' of ' + total + ' correct';
        var xpAmount = perfect ? 5 : 1;
        var emoji = perfect ? '&#x1F389;' : (correct >= total - 1 ? '&#x1F44D;' : '&#x1F4AA;');
        var html = ''
            + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px 8px 4px;">'
            + '  <div style="width:84px;height:84px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;margin-bottom:14px;box-shadow:0 8px 26px rgba(0,0,0,0.22);animation:hlqXpPop 600ms cubic-bezier(0.2,0.9,0.3,1.4) forwards;">' + emoji + '</div>'
            + '  <div style="font-size:1.5rem;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.20);margin-bottom:4px;">' + headline + '</div>'
            + '  <div style="font-size:0.92rem;color:rgba(255,255,255,0.92);font-weight:600;margin-bottom:18px;">' + subline + '</div>'
            + '  <div style="display:flex;align-items:baseline;gap:6px;background:#ffffff;color:#f97316;padding:10px 22px;border-radius:30px;box-shadow:0 6px 18px rgba(0,0,0,0.18);animation:hlqPulse 1.6s ease-in-out infinite;">'
            + '    <span style="font-size:1.6rem;font-weight:800;">+' + xpAmount + '</span>'
            + '    <span style="font-size:0.82rem;font-weight:800;letter-spacing:0.5px;">XP</span>'
            + '  </div>'
            + '  <button id="hlq-done-btn" class="hlq-btn" style="margin-top:22px;padding:12px 30px;background:rgba(255,255,255,0.20);color:#fff;border:2px solid rgba(255,255,255,0.55);border-radius:30px;font-weight:700;font-size:0.93rem;cursor:pointer;">Done</button>'
            + '</div>';
        wipeContent(html, function() {
            var btn = document.getElementById('hlq-done-btn');
            if (btn) btn.onclick = function() { exitCardQuizMode(true); };
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
    function escapeAttr(s) { return escapeHtml(s); }
})();
