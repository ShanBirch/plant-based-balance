function cleanText(value, max = 1200) {
    return String(value || '')
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
        .replace(/\[VIDEO:https?:\/\/[^\s\]]+\]/gi, '[video]')
        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
        .replace(/https?:\/\/\S+/gi, '[link]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function stripMarkdownFence(text) {
    return String(text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function parseJsonMaybe(text) {
    const raw = stripMarkdownFence(text);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function clampWindowDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 30;
    return Math.max(7, Math.min(90, Math.round(n)));
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function uniqueStrings(values, max = 8, len = 120) {
    const out = [];
    const seen = new Set();
    for (const value of safeArray(values)) {
        const s = cleanText(value, len);
        const key = s.toLowerCase();
        if (!s || seen.has(key)) continue;
        seen.add(key);
        out.push(s);
        if (out.length >= max) break;
    }
    return out;
}

function normalizePriority(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'high' || raw === 'low') return raw;
    return 'medium';
}

function normalizeIdeaType(value) {
    const raw = String(value || '').toLowerCase();
    if (['reel', 'story', 'post', 'carousel', 'live', 'email'].includes(raw)) return raw;
    return 'other';
}

function normalizeEvidence(items) {
    return safeArray(items).slice(0, 5).map(item => {
        if (typeof item === 'string') {
            return { source: 'theme', note: cleanText(item, 220) };
        }
        return {
            source: cleanText(item?.source || item?.type || 'theme', 60),
            note: cleanText(item?.note || item?.text || item?.quote || '', 220),
        };
    }).filter(item => item.note);
}

function normalizeIdea(raw, index = 0) {
    const title = cleanText(raw?.title || raw?.idea || raw?.hook || `Content idea ${index + 1}`, 120);
    return {
        rank: Number.isFinite(Number(raw?.rank)) ? Number(raw.rank) : index + 1,
        idea_type: normalizeIdeaType(raw?.idea_type || raw?.type || raw?.format),
        title,
        hook: cleanText(raw?.hook || title, 220),
        angle: cleanText(raw?.angle || raw?.why || raw?.rationale || '', 500),
        talking_points: uniqueStrings(raw?.talking_points || raw?.talkingPoints || raw?.bullets, 6, 180),
        script: cleanText(raw?.script || raw?.what_to_say || raw?.whatToSay || '', 1600),
        caption: cleanText(raw?.caption || '', 900),
        cta: cleanText(raw?.cta || raw?.call_to_action || raw?.callToAction || '', 180),
        source_theme: cleanText(raw?.source_theme || raw?.theme || '', 140),
        source_mix: uniqueStrings(raw?.source_mix || raw?.sources || [], 5, 90),
        evidence: normalizeEvidence(raw?.evidence || raw?.proof || []),
        privacy_note: cleanText(raw?.privacy_note || raw?.privacy || 'Use theme only. Do not name the client or reveal private context.', 240),
        priority: normalizePriority(raw?.priority),
    };
}

function normalizeTheme(raw, index = 0) {
    if (typeof raw === 'string') {
        return {
            name: cleanText(raw, 90) || `Theme ${index + 1}`,
            signal: '',
            source_mix: [],
            content_angle: '',
        };
    }
    return {
        name: cleanText(raw?.name || raw?.theme || `Theme ${index + 1}`, 90),
        signal: cleanText(raw?.signal || raw?.why || raw?.summary || '', 260),
        source_mix: uniqueStrings(raw?.source_mix || raw?.sources || [], 5, 90),
        content_angle: cleanText(raw?.content_angle || raw?.angle || '', 260),
    };
}

function normalizePerformanceBrain(raw = {}) {
    const data = safeObject(raw);
    return {
        summary: cleanText(data.summary || data.takeaway || '', 520),
        winning_patterns: safeArray(data.winning_patterns || data.winningPatterns || data.patterns)
            .slice(0, 6)
            .map((item, index) => ({
                pattern: cleanText(item?.pattern || item?.name || `Pattern ${index + 1}`, 130),
                why: cleanText(item?.why || item?.signal || item?.reason || '', 280),
                evidence: uniqueStrings(item?.evidence || item?.proof || [], 4, 180),
                do_more: cleanText(item?.do_more || item?.doMore || item?.action || '', 240),
            }))
            .filter(item => item.pattern || item.why || item.do_more),
        underused_angles: safeArray(data.underused_angles || data.underusedAngles || data.gaps)
            .slice(0, 5)
            .map((item, index) => ({
                angle: cleanText(item?.angle || item?.name || `Angle ${index + 1}`, 130),
                why: cleanText(item?.why || item?.signal || '', 260),
                next_test: cleanText(item?.next_test || item?.nextTest || item?.test || '', 240),
            }))
            .filter(item => item.angle || item.why || item.next_test),
        next_tests: safeArray(data.next_tests || data.nextTests || data.tests)
            .slice(0, 5)
            .map((item, index) => ({
                format: normalizeIdeaType(item?.format || item?.idea_type || item?.type),
                hook: cleanText(item?.hook || item?.title || `Test ${index + 1}`, 180),
                why: cleanText(item?.why || item?.rationale || '', 260),
                success_signal: cleanText(item?.success_signal || item?.successSignal || item?.metric || '', 200),
            }))
            .filter(item => item.hook || item.why || item.success_signal),
    };
}

function normalizeReplyEngine(raw = {}) {
    const data = safeObject(raw);
    return {
        summary: cleanText(data.summary || data.takeaway || '', 520),
        context_rules: safeArray(data.context_rules || data.contextRules || data.rules)
            .slice(0, 7)
            .map((item, index) => ({
                trigger: cleanText(item?.trigger || item?.situation || `Reply rule ${index + 1}`, 110),
                reply_move: cleanText(item?.reply_move || item?.replyMove || item?.move || '', 300),
                example: cleanText(item?.example || item?.sample || '', 320),
                evidence: cleanText(item?.evidence || item?.why || '', 220),
            }))
            .filter(item => item.trigger || item.reply_move || item.example),
        hot_reply_opportunities: safeArray(data.hot_reply_opportunities || data.hotReplyOpportunities || data.opportunities)
            .slice(0, 6)
            .map((item, index) => ({
                content_context: cleanText(item?.content_context || item?.contentContext || item?.context || `Opportunity ${index + 1}`, 220),
                inbound_signal: cleanText(item?.inbound_signal || item?.inboundSignal || item?.signal || '', 220),
                suggested_reply_angle: cleanText(item?.suggested_reply_angle || item?.suggestedReplyAngle || item?.reply_angle || item?.replyAngle || '', 280),
            }))
            .filter(item => item.content_context || item.inbound_signal || item.suggested_reply_angle),
    };
}

function normalizeStoryStrategy(raw = {}) {
    const data = safeObject(raw);
    return {
        summary: cleanText(data.summary || data.takeaway || '', 520),
        today_sequence: safeArray(data.today_sequence || data.todaySequence || data.sequence)
            .slice(0, 8)
            .map((item, index) => ({
                slide: Number.isFinite(Number(item?.slide)) ? Number(item.slide) : index + 1,
                type: cleanText(item?.type || item?.format || 'story', 90),
                text: cleanText(item?.text || item?.prompt || item?.hook || '', 260),
                sticker: cleanText(item?.sticker || item?.interaction || '', 180),
                reply_follow_up: cleanText(item?.reply_follow_up || item?.replyFollowUp || item?.follow_up || item?.followUp || '', 260),
            }))
            .filter(item => item.text || item.sticker || item.reply_follow_up),
        daily_prompts: safeArray(data.daily_prompts || data.dailyPrompts || data.prompts)
            .slice(0, 7)
            .map((item, index) => ({
                prompt: cleanText(item?.prompt || item?.text || `Story prompt ${index + 1}`, 220),
                why: cleanText(item?.why || item?.reason || '', 240),
                reply_keyword: cleanText(item?.reply_keyword || item?.replyKeyword || item?.keyword || '', 80),
            }))
            .filter(item => item.prompt || item.why || item.reply_keyword),
    };
}

function normalizeModelResult(parsed, fallbackSources = {}) {
    const raw = safeObject(parsed);
    const themes = safeArray(raw.themes).slice(0, 10).map(normalizeTheme);
    const ideas = safeArray(raw.ideas).slice(0, 12).map(normalizeIdea);
    const performance_brain = normalizePerformanceBrain(raw.performance_brain || raw.performanceBrain);
    const reply_engine = normalizeReplyEngine(raw.reply_engine || raw.replyEngine);
    const story_strategy = normalizeStoryStrategy(raw.story_strategy || raw.storyStrategy);
    return {
        summary: cleanText(raw.summary || fallbackSources.summary || '', 700),
        themes,
        ideas,
        performance_brain,
        reply_engine,
        story_strategy,
        raw: {
            ...raw,
            summary: cleanText(raw.summary || fallbackSources.summary || '', 700),
            themes,
            ideas,
            performance_brain,
            reply_engine,
            story_strategy,
        },
    };
}

function buildFallbackResult(sourceCounts = {}) {
    const summary = 'Recent conversations are ready to mine, but the model did not return usable JSON.';
    const performance_brain = {
        summary: 'Use replies and comments as the performance signal until richer IG insights are available.',
        winning_patterns: [
            {
                pattern: 'Reply-generating practical friction',
                why: 'People are more likely to respond when the post names the exact sticking point they are already asking about.',
                evidence: [`${sourceCounts.igContentInteractions || 0} IG content reactions/comments captured`],
                do_more: 'Turn repeated DM language into short reels and story polls.',
            },
        ],
        underused_angles: [],
        next_tests: [
            {
                format: 'story',
                hook: 'What is the one part that keeps breaking your routine?',
                why: 'A simple question creates fresh reply context for follow-up DMs.',
                success_signal: 'More story replies with a concrete blocker.',
            },
        ],
    };
    const reply_engine = {
        summary: 'When someone comments or replies, anchor the response in what they reacted to before asking the next question.',
        context_rules: [
            {
                trigger: 'story_reply',
                reply_move: 'Acknowledge the story context, mirror their wording, then ask one useful next question.',
                example: 'Yeah that part catches a lot of people. Is it the food planning or the routine that tends to fall over first?',
                evidence: 'Story replies now carry the story context into the IG draft path.',
            },
        ],
        hot_reply_opportunities: [],
    };
    const story_strategy = {
        summary: 'Post one low-friction story sequence that creates replies Shannon can continue in DMs.',
        today_sequence: [
            {
                slide: 1,
                type: 'question',
                text: 'What is the bit that makes staying consistent hardest right now?',
                sticker: 'Question sticker',
                reply_follow_up: 'Ask whether food, workouts, or accountability is the main blocker.',
            },
            {
                slide: 2,
                type: 'poll',
                text: 'Most people do not need more motivation, they need a simpler setup.',
                sticker: 'Poll: food / workouts / check-ins',
                reply_follow_up: 'Send a one-step suggestion based on their poll answer.',
            },
        ],
        daily_prompts: [
            {
                prompt: 'What part of your routine is easiest to keep, even on a messy day?',
                why: 'Starts from proof of what already works.',
                reply_keyword: 'easy',
            },
        ],
    };
    const result = {
        summary,
        themes: [
            {
                name: 'DM language',
                signal: 'Use recent client and lead questions as the source of truth.',
                source_mix: ['IG/FB DMs', 'client DMs'],
                content_angle: 'Answer the repeated question in a short practical post.',
            },
        ],
        ideas: [
            normalizeIdea({
                idea_type: 'reel',
                title: 'Answer the question people keep circling',
                hook: 'If you keep restarting, it is probably not a motivation problem.',
                angle: `Built from ${sourceCounts.igMessages || 0} IG/FB DMs and ${sourceCounts.clientMessages || 0} client DMs.`,
                talking_points: [
                    'Name the real friction people are repeating.',
                    'Give one simple next step.',
                    'Invite replies with one keyword.',
                ],
                script: 'If you keep restarting, it is probably not a motivation problem. It is usually a setup problem. Pick the one meal, one workout, or one daily check-in that makes the rest easier, then build from there.',
                caption: 'Start with the setup, not the guilt.',
                cta: 'Reply "start" if you want help picking the first step.',
                source_theme: 'DM language',
                source_mix: ['recent messages'],
                priority: 'medium',
            }, 0),
        ],
        performance_brain,
        reply_engine,
        story_strategy,
    };
    return {
        ...result,
        raw: { fallback: true, ...result },
    };
}

function formatSourceLines(label, rows, maxRows = 45) {
    const lines = safeArray(rows).slice(0, maxRows).map((row, index) => {
        const text = cleanText(row.text || row.message || row.note || row.summary || '', 420);
        if (!text) return '';
        const when = row.created_at || row.received_at || row.updated_at || row.posted_at || '';
        const meta = [
            row.channel,
            row.lead_stage,
            row.content_type,
            row.event_type,
        ].filter(Boolean).join('/');
        return `${index + 1}. ${when ? `${when} ` : ''}${meta ? `[${meta}] ` : ''}${text}`;
    }).filter(Boolean);
    if (!lines.length) return `${label}: none`;
    return `${label}:\n${lines.join('\n')}`;
}

function buildContentRadarPrompt(sources, windowDays) {
    const sourceCounts = sources.sourceCounts || {};
    return `You are helping Shannon decide what to post for Balance.

Use the data below to produce a privacy-safe content radar. This is internal only.

Rules:
- Public output must sound like Shannon, not like AI.
- Do not include client names, exact private stories, medical claims, or anything that makes a person identifiable.
- Use repeated themes and real phrasing patterns, not generic fitness content.
- Prioritize content that can create IG replies, challenge interest, or useful conversation.
- Use IG post/story performance to name what is already working and what Shannon should test next.
- For replies, use the context of the post/story they reacted to before asking the next question.
- Story strategy should be a practical sequence Shannon can post today to create useful replies.
- Make each idea ready to film or post today.
- Return 3 to 5 strong ideas, not a long brainstorm.
- Use plain practical language. No hype, no corporate language.

Return JSON only:
{
  "summary": "one short operator summary",
  "themes": [
    {
      "name": "theme name",
      "signal": "why this is showing up",
      "source_mix": ["IG/FB DMs", "client DMs"],
      "content_angle": "how Shannon should talk about it"
    }
  ],
  "ideas": [
    {
      "rank": 1,
      "idea_type": "reel|story|post|carousel|live|email",
      "priority": "high|medium|low",
      "title": "short title",
      "hook": "first line on camera or first story slide",
      "angle": "why this should land",
      "talking_points": ["point 1", "point 2", "point 3"],
      "script": "short filming-ready script",
      "caption": "caption draft",
      "cta": "reply keyword or next action",
      "source_theme": "theme name",
      "source_mix": ["IG/FB DMs", "client DMs"],
      "evidence": [{"source": "IG/FB DMs", "note": "privacy-safe paraphrase"}],
      "privacy_note": "what not to reveal"
    }
  ],
  "performance_brain": {
    "summary": "what recent owned IG content is teaching us",
    "winning_patterns": [
      {
        "pattern": "format/topic pattern",
        "why": "why it seems to work",
        "evidence": ["privacy-safe signal"],
        "do_more": "what Shannon should repeat"
      }
    ],
    "underused_angles": [
      {
        "angle": "topic or format gap",
        "why": "why it is worth testing",
        "next_test": "specific next test"
      }
    ],
    "next_tests": [
      {
        "format": "reel|story|post|carousel|live|email",
        "hook": "test hook",
        "why": "why test it",
        "success_signal": "what to watch for"
      }
    ]
  },
  "reply_engine": {
    "summary": "how Shannon should answer comments/story replies using content context",
    "context_rules": [
      {
        "trigger": "story_reply|comment|dm",
        "reply_move": "what the reply should do",
        "example": "short Shannon-style example",
        "evidence": "why this rule exists"
      }
    ],
    "hot_reply_opportunities": [
      {
        "content_context": "what they reacted to",
        "inbound_signal": "what their reply/comment suggests",
        "suggested_reply_angle": "how to continue the conversation"
      }
    ]
  },
  "story_strategy": {
    "summary": "today's story plan",
    "today_sequence": [
      {
        "slide": 1,
        "type": "poll|question|talking-head|proof|soft-cta",
        "text": "what to post",
        "sticker": "poll/question/slider if useful",
        "reply_follow_up": "how Shannon should reply when someone answers"
      }
    ],
    "daily_prompts": [
      {
        "prompt": "repeatable story prompt",
        "why": "why it should create good replies",
        "reply_keyword": "optional keyword"
      }
    ]
  }
}

Window: last ${windowDays} days.
Counts: ${JSON.stringify(sourceCounts)}

${formatSourceLines('IG and Facebook inbound DMs', sources.igMessages, 34)}

${formatSourceLines('Client in-app inbound DMs', sources.clientMessages, 30)}

${formatSourceLines('Client memory themes', sources.clientMemory, 18)}

${formatSourceLines('IG content reactions and comments', sources.igContentInteractions, 18)}

${formatSourceLines('Recent Shannon IG content context', sources.igContentItems, 12)}

${formatSourceLines('IG post/story performance samples', sources.igContentPerformance, 18)}

${formatSourceLines('Contextual reply samples', sources.contextualReplySamples, 18)}`;
}

module.exports = {
    cleanText,
    parseJsonMaybe,
    clampWindowDays,
    normalizeModelResult,
    buildFallbackResult,
    buildContentRadarPrompt,
    _test: {
        normalizeIdea,
        normalizeTheme,
        normalizeEvidence,
        normalizePerformanceBrain,
        normalizeReplyEngine,
        normalizeStoryStrategy,
        formatSourceLines,
    },
};
