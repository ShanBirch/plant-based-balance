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

function normalizeModelResult(parsed, fallbackSources = {}) {
    const themes = safeArray(parsed?.themes).slice(0, 10).map(normalizeTheme);
    const ideas = safeArray(parsed?.ideas).slice(0, 12).map(normalizeIdea);
    return {
        summary: cleanText(parsed?.summary || fallbackSources.summary || '', 700),
        themes,
        ideas,
        raw: parsed || {},
    };
}

function buildFallbackResult(sourceCounts = {}) {
    const summary = 'Recent conversations are ready to mine, but the model did not return usable JSON.';
    return {
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
        raw: { fallback: true },
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
  ]
}

Window: last ${windowDays} days.
Counts: ${JSON.stringify(sourceCounts)}

${formatSourceLines('IG and Facebook inbound DMs', sources.igMessages, 34)}

${formatSourceLines('Client in-app inbound DMs', sources.clientMessages, 30)}

${formatSourceLines('Client memory themes', sources.clientMemory, 18)}

${formatSourceLines('IG content reactions and comments', sources.igContentInteractions, 18)}

${formatSourceLines('Recent Shannon IG content context', sources.igContentItems, 12)}`;
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
        formatSourceLines,
    },
};
