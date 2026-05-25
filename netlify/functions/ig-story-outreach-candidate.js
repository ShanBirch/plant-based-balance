/**
 * Stores a native Instagram story outreach candidate from Shannon's browser bot.
 *
 * The Selenium bot is intentionally not trusted to write arbitrary Supabase
 * rows. It sends the exact story identity + screenshot evidence here, Balance
 * generates or validates a short opener, stores a reviewable coach_alert, and
 * creates/reuses an ig_threads row keyed by IG handle so ManyChat/Graph can
 * attach the later reply to the same person.
 */

const crypto = require('crypto');
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    truncate,
} = require('./_lib/client-context');

const SHARED_SECRET = process.env.IG_STORY_BOT_BRIDGE_SECRET || process.env.STORY_COMMENT_BRIDGE_SECRET || '';
const OWN_HANDLES = new Set(['shan_n_sunny', 'cocos_connected', 'cocos_pt_studio']);
const RESERVED_STORY_USERNAMES = new Set(['highlights', 'explore', 'reels', 'stories']);
const MAX_COMMENT_CHARS = 160;
const STORY_COMMENT_PIPELINE_VERSION = 'story-planner-generator-critic-fixer-v1';
const STORY_COMMENT_FAST_PIPELINE_VERSION = 'story-single-pass-deterministic-safety-v1';
const STORY_NO_REPLY_COMMENT_LIMIT = 3;
const STORY_NO_REPLY_COOLDOWN_DAYS = 30;
const STORY_NO_REPLY_COOLDOWN_MS = STORY_NO_REPLY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const STORY_RECENT_OUTREACH_COOLDOWN_HOURS = 20;
const STORY_RECENT_OUTREACH_COOLDOWN_MS = STORY_RECENT_OUTREACH_COOLDOWN_HOURS * 60 * 60 * 1000;
const PET_NAME_COMMENT = "Oh so cute, what's their name?";
const PET_NAMES_COMMENT = 'Oh so cute, what are their names?';
const SHARED_PET_NAME_COMMENT = 'So cute, do you know their name?';
const SHARED_PET_NAMES_COMMENT = 'So cute, do you know their names?';

function envFlag(name, fallback = false) {
    const value = process.env[name];
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value).trim().toLowerCase());
}

function envInt(name, fallback) {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) ? value : fallback;
}

const STORY_COMMENT_DEEP_PIPELINE_ENABLED = envFlag('STORY_COMMENT_DEEP_PIPELINE_ENABLED', false);
const STORY_COMMENT_MAX_EVIDENCE_IMAGES = Math.max(1, Math.min(4, envInt('STORY_COMMENT_MAX_EVIDENCE_IMAGES', 2)));
const STORY_COMMENT_MAX_EVIDENCE_VIDEO_BYTES = Math.max(
    128 * 1024,
    Math.min(8 * 1024 * 1024, envInt('STORY_COMMENT_MAX_EVIDENCE_VIDEO_BYTES', 4 * 1024 * 1024))
);

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function cleanText(value, max = 4000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanIgUsername(value) {
    const clean = String(value || '').replace(/^@+/, '').trim();
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(clean)) return '';
    if (RESERVED_STORY_USERNAMES.has(clean.toLowerCase())) return '';
    return clean;
}

function parseStoryUrl(url) {
    const clean = String(url || '').split('?')[0].replace(/\/+$/, '');
    const match = clean.match(/\/stories\/([^/?#]+)\/([^/?#]+)/i);
    if (!match) return { cleanUrl: clean, username: '', storyId: '' };
    return {
        cleanUrl: clean,
        username: cleanIgUsername(match[1]),
        storyId: String(match[2] || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
    };
}

function hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function parseJsonMaybe(text) {
    const raw = String(text || '').trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try { return JSON.parse(match[0]); } catch { return null; }
    }
}

function isLowContextStoryQuestion(text) {
    const value = cleanText(text, 160);
    if (!value) return false;
    return (
        /\bwhat(?:'s|s| is)\s+(?:the\s+)?(?:story|context|deal)(?:\s+(?:here|there|with\s+(?:this|that)))?\??$/i.test(value)
        || /\b(?:what(?:'s|s| is)|what\s+does)\s+['"]?[a-z0-9][a-z0-9._-]{1,24}['"]?\s+mean\??$/i.test(value)
        || /\bwhat(?:'s|s| is)\s+(?:a|an)\s+[a-z0-9][a-z0-9._-]{1,24}\??$/i.test(value)
    );
}

const ANIMAL_WELFARE_SUPPORT_COMMENT = "i can't believe this happens, so sad. you okay?";

function isAnimalWelfareSupportComment(text) {
    return /^i can'?t believe this happens,?\s+so sad\.?\s+(?:you okay|are you okay)\??$/i.test(cleanText(text, 140));
}

function isAnimalWelfareAdvocacyContext(text) {
    const value = cleanText(text, 4000);
    if (!value) return false;
    return /\b(animal cruelty|animal abuse|animal welfare|animal rights|animal liberation|factory farm(?:ing)?|animal agriculture|animal ag|animal exploitation|speciesism|farmed animals?|slaughterhouse|slaughter(?:ed|ing)?|ventilation shutdown|animal slaughter|humane slaughter|kill(?:ing)? (?:a |the |this )?(?:pig|cow|chicken|sheep|lamb|calf|animal)s?|(?:pig|cow|chicken|sheep|lamb|calf|animal)s? (?:being )?kill(?:ed|ing)|mass animal cull(?:ing)?|animal cull(?:ing)?|euthan(?:asia|ised|ized|ise|ize)|live export|battery hens?|caged hens?|gestation crates?|dairy industry|meat industry|vegan activism|vegan advocacy|plant[-\s]?based activism|save animals?|end animal suffering|stop animal cruelty)\b/i.test(value);
}

function hasGraphicAnimalWelfareContext(text) {
    return /\b(gore|graphic|mutilat(?:ed|ion)|dismember(?:ed|ment)|decapitat(?:ed|ion)|skinned alive|blood everywhere|open wound|severed)\b/i.test(cleanText(text, 4000));
}

function isTruthyValue(value) {
    if (value === true) return true;
    const text = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'y'].includes(text);
}

function normalizeDraftComment(value, { storyOwner = '', sharedFromUsername = '', sharedContent = false } = {}) {
    let text = cleanText(value, MAX_COMMENT_CHARS);
    text = text
        .replace(/["*#_`]/g, '')
        .replace(/(^|\s)@[a-zA-Z0-9._]{3,30}\b/g, ' ')
        .replace(/\bros\b/gi, 'rose')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    if (isAnimalWelfareSupportComment(text)) {
        return ANIMAL_WELFARE_SUPPORT_COMMENT;
    }
    if (/\b(?:the|this|that|these|those|some)\s+[bcdefghjklmnopqrstuvwxyz]\s+(?:sights?|views?|scenery|spots?|places?|vibes?)\b/i.test(text)) {
        return '';
    }

    const overlyLiteralClassReply =
        !sharedContent
        && /\b(?:body\s*attack|bodyattack|body\s*pump|bodypump|body\s*combat|bodycombat|pilates|yoga|spin|fitness\s+class|gym\s+class|class|workout|session)\b/i.test(text)
        && /\b(?:numero|number|no\.?|#)\s*\d+\b/i.test(text);
    if (overlyLiteralClassReply) {
        return 'how was the session?';
    }
    if (/\bnumero\b/i.test(text)) {
        return '';
    }
    if (/^(?:are|is)\s+(?:the\s+)?(?:boys|girls)\s+playing\??$/i.test(text)) {
        return "how's the game going?";
    }
    if (/^(?:who\s+)?are\s+you\s+barracking\s+for\??$/i.test(text)) {
        return 'who are you barracking for?';
    }
    if (/^are\s+they\s+serving\s+(?:there|here)\??$/i.test(text)) {
        return 'what are they serving?';
    }
    if (/^are\s+you\s+growing\??$/i.test(text)) {
        return 'what are you growing?';
    }
    if (/^(?:that'?s\s+a\s+)?boss\s+look!?\??$/i.test(text)) {
        return 'looking good today';
    }
    if (/\b(?:stinky\s+)?farts?\b/i.test(text)) {
        if (/\bname\b/i.test(text)) {
            return sharedContent ? SHARED_PET_NAME_COMMENT : PET_NAME_COMMENT;
        }
        return '';
    }
    if (/^oh\s+so\s+cute,?\s+what(?:'s|s| is)\s+their\s+name\??$/i.test(text)) {
        return sharedContent ? SHARED_PET_NAME_COMMENT : PET_NAME_COMMENT;
    }
    if (/^oh,?\s+so\s+cute!?,?\s+what\s+are\s+their\s+names\??$/i.test(text)) {
        return sharedContent ? SHARED_PET_NAMES_COMMENT : PET_NAMES_COMMENT;
    }
    if (sharedContent && /\bwhat(?:'s|s| is)\s+their\s+name\??/i.test(text)) {
        return SHARED_PET_NAME_COMMENT;
    }
    if (sharedContent && /\bwhat\s+are\s+their\s+names\??/i.test(text)) {
        return SHARED_PET_NAMES_COMMENT;
    }
    if (sharedContent && /^so\s+cute,?\s+do\s+you\s+know\s+their\s+name\??$/i.test(text)) {
        return SHARED_PET_NAME_COMMENT;
    }
    if (sharedContent && /^so\s+cute,?\s+do\s+you\s+know\s+their\s+names\??$/i.test(text)) {
        return SHARED_PET_NAMES_COMMENT;
    }
    if (/^are\s+\w+(?:,\s*)?good\s+work!?\??$/i.test(text)) {
        return 'good song choice';
    }
    if (/^(?:are|is|was|were|do|did|does|can|could|would|will|have|has|had)\s+(?:you\s+guys|you|u|ya|they|them|these|those|it|this|that|he|she|we|y'all|the\s+(?:boys|girls|crew|team|group)|[a-z][a-z0-9._-]{1,24})\??$/i.test(text)) {
        return '';
    }
    text = text.replace(/\blooks?\s+like\s+a\s+great\s+hens\.?!?$/i, 'looks like a great hens night');
    const colourOnes = text.match(/^are\s+(these|those)\s+((?:yellow|orange|red|green|blue|purple|black|white|pink|brown)\s+)?ones\??$/i);
    if (colourOnes) {
        const colour = (colourOnes[2] || '').trim().toLowerCase();
        return `what are ${colourOnes[1].toLowerCase()} ${colour ? `${colour} ` : ''}ones?`;
    }

    // The native story opener is for rapport. The challenge belongs later in
    // the lead-only DM qualifier, once they directly ask or there are 3+
    // meaningful lead replies with real context.
    if (/\b(challenge|app|sign ?up|link|program|meal plan|coaching|client)\b/i.test(text)) {
        return '';
    }
    if (mentionsHandleToken(text, storyOwner) || mentionsHandleToken(text, sharedFromUsername)) {
        return '';
    }
    if (/^[A-Z][a-z]{2,24}\s*[,!:]\s+/.test(text)) {
        text = text.replace(/^[A-Z][a-z]{2,24}\s*[,!:]\s+/, '').trim();
    }
    const possibleDirectAddress = text.match(/^([A-Z][a-z]{2,24})\s+(this|that|you|your|is|are|looks|looked|made|makes|love|loved|nailed|smashed)\b/i);
    const safeDirectAddressOpeners = new Set(['Love', 'Loved', 'This', 'That', 'Looks']);
    if (possibleDirectAddress && !safeDirectAddressOpeners.has(possibleDirectAddress[1])) {
        text = text.replace(/^([A-Z][a-z]{2,24})\s+/, '').trim();
    }
    if (/^(?:love it|love this|love the caption|lets goo|let'?s go+|get it|mad views|looks unreal|nice as|beauty|fuck yeah|yew|doggo|cutie puppy)\b/i.test(text)) {
        return '';
    }
    if (/^(?:oh\s+hey|hey|hi)\s+[a-z][a-z]{2,24}\b/i.test(text)) {
        return '';
    }
    if (/\b(?:never seen that(?: .{1,35})? thing|that's random|thats random|that's cool|thats cool|interesting|crazy|big vibe|vibes)\b/i.test(text)) {
        return '';
    }
    if (/^(?:is|was)\s+(?:this|that)\??$/i.test(text)) {
        return '';
    }
    text = text
        .replace(/(?:[.!?]\s*)?\b[Ww]hat(?:'s|s| is)\s+[A-Z0-9][A-Z0-9._-]{1,20}\??$/g, '')
        .trim();
    if (!text) return '';
    text = text.replace(
        /^is\s+(?:this|that)\s+(peaceful|calm|quiet|nice|sweet|beautiful|stunning|pretty)\s+(?:spot|place|view|beach|park)\??$/i,
        'that looks $1'
    );
    if (/^is\s+(?:this|that)\s+(?:amazing|great|good|nice|cool|fun|beautiful|stunning|pretty|peaceful|calm|quiet|sweet)\s+(?:club|clubbing|bar|venue|party)\??$/i.test(text)) {
        return '';
    }
    if (isLowContextStoryQuestion(text)) {
        return '';
    }
    if (/\b(?:is that|is this|was that|was this)\s+(?:at\s+)?home\b/i.test(text)) {
        return '';
    }
    if (/\bwhat(?:'s|s| is)\s+the\s+club\b/i.test(text)) {
        return '';
    }
    if (/\bwhat(?:'s|s| is)\s+(?:that|this)\s+(?:place|spot|venue|bar|cafe|restaurant)\b/i.test(text)) {
        return '';
    }
    if (/\bwhere(?:'s|\s+is)\s+(?:that|this)(?:\s+\w+){0,3}\s+(?:place|spot|venue|bar|cafe|restaurant)\b/i.test(text)) {
        return '';
    }
    if (/\bwhat(?:'s|s| is)\s+the\s+occasion\b/i.test(text)) {
        return '';
    }
    if (/\byou\s+look\s+(?:hot|sexy|beautiful|gorgeous|tiny|skinny|ripped|jacked)\b/i.test(text) || /\b(hot|sexy|beautiful|gorgeous)\b/i.test(text)) {
        return '';
    }
    if (/\bwild\b/i.test(text)) {
        return '';
    }
    if (/\b(can'?t tell|cannot tell|not sure|no idea|what'?s going on|whats going on|what'?s happening|whats happening|can'?t figure out|cant figure out|unclear|blurry)\b/i.test(text)) {
        return '';
    }
    if (/\b(sadness|sad|depress(?:ed|ion)|anxiety|panic|mental health|hopeless|lonely|lowest|turn feelings off|turn this sadness off)\b/i.test(text)) {
        return '';
    }
    if (/\bhow'?s\s+(?:the\s+|your\s+)?(?:back|knee|shoulder|hip|neck|ankle|wrist|elbow|hamstring|quad|calf)(?:\s+(?:feeling|going|holding\s+up))?\b/i.test(text)) {
        return '';
    }
    if (/\b(?:feel it later|feeling it later|looks?\s+cold(?:\s+out\s+there)?|cold\s+out\s+there)\b/i.test(text)) {
        return '';
    }
    if (/\b(?:lower|upper)?\s*(?:back|knee|knees|shoulder|hip|neck|ankle|wrist|elbow|hamstring|quad|calf)\b/i.test(text)) {
        return '';
    }
    if (/\byes\s+please\b/i.test(text)) {
        return '';
    }
    if (/\bare\s+(?:they|these|those|all of them)\s+all\s+empty\b/i.test(text)) {
        return '';
    }
    if (/\bwhat\s+(?:are|is)\s+.{1,40}\s+doing\s+(?:there|here)\b/i.test(text)) {
        return '';
    }
    if (/\bwhat(?:'s|s| is)\s+in\s+(?:the\s+)?(?:little|small|tiny)?\s*(?:bag|baggie|packet|sachet|ziplock)\b/i.test(text)) {
        return '';
    }
    if (/\b(?:powder|pills?|tablets?|capsules?|substance)\b/i.test(text)) {
        return '';
    }
    if (/\b(?:is that|what(?:'s|s)?|whose)\s+(?:their\s+|your\s+)?(?:product|brand|collab|sponsor)\b/i.test(text)) {
        return '';
    }
    if (/\b(needs?\s+a\s+(?:trim|haircut|groom)|too\s+(?:big|fat|skinny|fluffy))\b/i.test(text)) {
        return '';
    }
    if (/\b\d+\s*(?:kg|kgs|lb|lbs|cm|inch|inches|%)\b/i.test(text) || /\b\d+\s*(?:to|-)\s*\d+\b/i.test(text)) {
        return '';
    }
    if (sharedContent) {
        // Shared reels/posts are only safe when the opener clearly reacts to
        // what the story owner shared, not as if the reel subject is them.
        if (/\b(you|your|yours|ya|u)\b/i.test(text)) return '';
        if (/\b(nice|solid|good|big|mad)\s+(?:lift|session|set|rep|run|ride|dance|sing(?:ing)?|fit|outfit|look|hair|body|physique)\b/i.test(text)) {
            return '';
        }
        if (/\b(smashed|nailed|crushed|killed)\s+(?:it|that)|\b(?:he|she|they|this person|the guy|the girl)\s+looks?\b/i.test(text)) {
            return '';
        }
    }
    if (text.length > MAX_COMMENT_CHARS) text = `${text.slice(0, MAX_COMMENT_CHARS - 3).trim()}...`;
    return text;
}

function repairDraftCommentWithContext({ comment = '', description = '', visibleText = '', storyOwner = '', sharedFromUsername = '', sharedContent = false } = {}) {
    const raw = cleanText(comment, MAX_COMMENT_CHARS);
    if (/^(?:block|skip|no comment|no_comment)$/i.test(raw)) return '';
    if (/\b(?:you\s+look\s+)?(?:hot|sexy|beautiful|gorgeous|tiny|skinny|ripped|jacked)\b|\b(?:body|physique|weight|jawline|waist|booty|boobs?|abs)\b/i.test(raw)) {
        return '';
    }

    const normalized = normalizeDraftComment(raw, { storyOwner, sharedFromUsername, sharedContent });
    const text = cleanText([description, visibleText].filter(Boolean).join(' '), 2400).toLowerCase();
    const rawLower = raw.toLowerCase();
    const normalizedLower = normalized.toLowerCase();
    const clean = value => normalizeDraftComment(value, { storyOwner, sharedFromUsername, sharedContent });

    if (isLowContextStoryQuestion(raw) || isLowContextStoryQuestion(normalized)) {
        return '';
    }
    if (normalized && /\barchive\b/i.test(normalized) && /\bfestival\b/i.test(text) && !/\barchive\b/i.test(text)) {
        return clean('whats that festival about?');
    }
    if (/\b(?:is that|is this|was that|was this)\s+(?:at\s+)?home\b/i.test(rawLower)) {
        if (/\bwhiteout\b/i.test(text)) return clean('that whiteout looks hectic');
        if (/\bfog|foggy|mist|misty\b/i.test(text)) return clean('that fog looks hectic');
        if (/\bbeach|sunset|view|lookout|mountain|trail|waterfall|lake|river\b/i.test(text)) return clean('where was that taken?');
    }
    if (/\bwhat(?:'s|s| is)\s+the\s+club\b/i.test(rawLower)) {
        if (/\b(?:turned\s+\d+|birthday|anniversary|18)\b/i.test(text)) return clean('18 years is huge');
        return clean('thats a good line');
    }
    if (/\bwhat(?:'s|s| is)\s+the\s+occasion\b/i.test(rawLower)) {
        if (/\bsong|music|track|audio\b/i.test(text)) return clean('good song choice');
        if (/\btable|restaurant|bar|cafe|dinner|lunch|drink\b/i.test(text)) return clean('what was the spot?');
    }
    if (/\bwho\s+(?:took|shot|did)\s+(?:that|this|the)\s+(?:photo|pic|picture|shot)\b/i.test(rawLower)) {
        if (/\b(portrait|selfie|photo of|picture of|wearing|dress|shirt|jacket|necklace|looking to the side|looking off)\b/i.test(text)) {
            return clean('looking good');
        }
    }
    if (/\bcoffee\b/i.test(`${rawLower} ${text}`) && /\bwine\b/i.test(`${rawLower} ${text}`)) {
        return clean('coffee and wine? hows that combo go?');
    }

    const weakOrEmpty = !normalized || /\b(?:never seen that(?: .{1,35})? thing|that's random|thats random|that's cool|thats cool|interesting|crazy|big vibe|vibes)\b/i.test(normalizedLower || rawLower);
    if (weakOrEmpty) {
        if (/\b(friend|friends|group|drinks?|bar|club|party|night out|dinner out)\b/i.test(text)) return clean('looks like a fun night');
        if (/\b(selfie|mirror selfie|photo of .*wearing|person .*wearing)\b/i.test(text)) return clean('looking good');
        if (/\bfestival\b/i.test(text)) return clean('whats that festival about?');
        if (/\barchive\b/i.test(text)) return clean('whats that archive about?');
        if (/\b(crepe|sandwich|sanga|toastie|food|meal|lunch|dinner|cake|coffee|drink)\b/i.test(text)) return clean('how was that?');
        if (/\b(dog|puppy|cat|kitten|pet|animal|rabbit|bunny|horse)\b/i.test(text) && !/\bnamed|called\b/i.test(text)) return clean(PET_NAME_COMMENT);
        if (/\bsong|music|track|audio\b/i.test(text)) return clean('good song choice');
    }

    return normalized;
}

function mentionsHandleToken(text, handle) {
    const normalized = String(handle || '').toLowerCase().replace(/^@+/, '');
    if (!normalized) return false;
    const lower = String(text || '').toLowerCase();
    if (new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) return true;
    const compactHandle = normalized.replace(/[._\s-]+/g, '');
    const compactText = lower.replace(/[._\s-]+/g, '');
    return compactHandle.length >= 5 && compactText.includes(compactHandle);
}

function detectForeignSourceHandle({ description = '', visibleText = '', raw = {}, storyOwner = '', sharedFromUsername = '', surfaceContext = {} } = {}) {
    const owner = cleanIgUsername(storyOwner).toLowerCase();
    const shared = cleanIgUsername(sharedFromUsername || surfaceContext?.sharedFromUsername || raw?.shared_from_username || raw?.sharedFromUsername).toLowerCase();
    if (shared && shared !== owner) return shared;
    const text = cleanText([
        description,
        visibleText,
        raw?.story_description,
        raw?.story_visible_text,
        raw?.visible_text,
    ].filter(Boolean).join(' '), 4000);
    const mentionMatches = [...text.matchAll(/@([a-zA-Z0-9._]{3,30})\b/g)]
        .map(match => cleanIgUsername(match[1]).toLowerCase())
        .filter(handle => handle && handle !== owner);
    if (mentionMatches.length) return mentionMatches[0];
    const sourcePattern = /\b(?:handle|account|creator|artist|credit|source|tagged|mentioned|mentions|posted\s+by|drawing\s+by|art\s+by)\s+@?([a-zA-Z0-9._]{3,30})\b/i;
    const sourceMatch = text.match(sourcePattern);
    const sourceHandle = cleanIgUsername(sourceMatch?.[1] || '').toLowerCase();
    return sourceHandle && sourceHandle !== owner ? sourceHandle : '';
}

function isSharedStoryContext({ storyContentType = '', sharedFromUsername = '', storyOwner = '', surfaceContext = {} } = {}) {
    const type = normalizeStoryContentType(storyContentType || surfaceContext?.storyContentType || surfaceContext?.story_content_type || 'unknown');
    if (['shared_reel', 'shared_post', 'reshared_story', 'tagged_story'].includes(type)) return true;
    const owner = cleanIgUsername(storyOwner).toLowerCase();
    const shared = cleanIgUsername(sharedFromUsername || surfaceContext?.sharedFromUsername || surfaceContext?.shared_from_username).toLowerCase();
    return Boolean(shared && shared !== owner);
}

function splitVisualAudioEvidence(description = '') {
    const text = cleanText(description, 1600);
    const match = text.match(/^(.*?)(?:\s+(?:while|but|whereas|although)\s+(?:the\s+)?(?:audio|voiceover|speaker|transcript|song|lyrics)\s+(?:discusses|mentions|says|talks?\s+about|describes|includes|captures|is\s+about)\b\s*(.*))$/i);
    if (!match) return { visualText: text, audioText: '' };
    return {
        visualText: cleanText(match[1], 1000),
        audioText: cleanText(match[2], 1000),
    };
}

function assessAudioVisualCommentConsistency({ description = '', visibleText = '', comment = '', raw = {}, surfaceContext = {} } = {}) {
    const normalizedComment = cleanText(comment, 260).toLowerCase();
    if (!normalizedComment) return { safeToComment: true, reason: '' };

    const split = splitVisualAudioEvidence(description || raw?.story_description || '');
    const visualEvidence = cleanText([split.visualText, visibleText, raw?.story_visible_text, raw?.visible_text].filter(Boolean).join(' '), 2200).toLowerCase();
    const transcript = cleanText(surfaceContext?.audioTranscript || raw?.audio_transcript || raw?.audioTranscript || '', 1800).toLowerCase();
    const audioEvidence = cleanText([split.audioText, transcript].filter(Boolean).join(' '), 2200).toLowerCase();
    const hasAudioVisualSplit = Boolean(split.audioText);

    const animalCommentPattern = /\b(?:pet|dog|cat|puppy|kitten|rabbit|bunny|horse|collar|their name|what(?:'s|s| is) their name)\b/i;
    const animalVisiblePattern = /\b(?:pet|dog|cat|puppy|kitten|rabbit|bunny|horse|animal|paws?|tail|fur|fluffy|collar)\b/i;
    const animalAudioPattern = /\b(?:pet|dog|cat|puppy|kitten|rabbit|bunny|horse|animal|collar|meow|bark)\b/i;

    if (
        animalCommentPattern.test(normalizedComment)
        && hasAudioVisualSplit
        && animalAudioPattern.test(audioEvidence)
        && !animalVisiblePattern.test(visualEvidence)
    ) {
        return { safeToComment: false, reason: 'audio_visual_mismatch' };
    }

    return { safeToComment: true, reason: '' };
}

function assessStoryCommentSafety({ description = '', visibleText = '', comment = '', raw = {}, storyOwner = '', sharedFromUsername = '', surfaceContext = {} } = {}) {
    const text = cleanText([
        description,
        visibleText,
        comment,
        raw?.story_description,
        raw?.story_visible_text,
        raw?.visible_text,
    ].filter(Boolean).join(' '), 4000);
    if (!text) return { safeToComment: true, reason: '' };
    const transcript = cleanText(surfaceContext?.audioTranscript || raw?.audio_transcript || raw?.audioTranscript || '', 1600);
    const transcriptWords = transcript.toLowerCase().match(/[a-z']+/g) || [];
    const fillerWords = new Set(['wow', 'yeah', 'yep', 'yes', 'nah', 'no', 'um', 'uh', 'oh', 'okay', 'ok', 'lol', 'haha', 'hahaha']);
    const meaningfulTranscriptWords = transcriptWords.filter(word => !fillerWords.has(word));
    const transcriptAwareText = cleanText([text, transcript].filter(Boolean).join(' '), 5000);
    const animalWelfareSupport = isAnimalWelfareAdvocacyContext(transcriptAwareText);
    if (animalWelfareSupport && !hasGraphicAnimalWelfareContext(transcriptAwareText)) {
        return { safeToComment: true, reason: 'animal_welfare_support' };
    }
    const audioVisualConsistency = assessAudioVisualCommentConsistency({
        description,
        visibleText,
        comment,
        raw,
        surfaceContext,
    });
    if (!audioVisualConsistency.safeToComment) {
        return audioVisualConsistency;
    }
    const foreignSourceHandle = detectForeignSourceHandle({
        description,
        visibleText,
        raw,
        storyOwner,
        sharedFromUsername,
        surfaceContext,
    });
    if (foreignSourceHandle) {
        return { safeToComment: false, reason: 'story_credits_another_creator' };
    }
    const unsafePatterns = [
        ['war_or_conflict', /\b(war|airstrike|bomb(?:ing)?|missile|genocide|massacre|terror(?:ist|ism)?|gaza|palestine|israel|ukraine|russia|hostage|ceasefire)\b/i],
        ['violence_or_weapons', /\b(shooting|shot|gun|knife|weapon|assault|abuse|rape|murder|killed|stabbed|violence|police brutality)\b/i],
        ['death_grief_or_tragedy', /\b(died|dead|death|funeral|rip|rest in peace|grief|passed away|memorial|tragic|tragedy)\b/i],
        ['low_mood_or_mental_health', /\b(sadness|sad|depress(?:ed|ion)|anxiety|panic|panic attack|anxiety attack|mental health|hopeless|lonely|breakdown|trauma|can'?t cope|cant cope|at my lowest|my lowest|turn this sadness off|turn feelings off)\b/i],
        ['medical_or_emergency', /\b(cancer|hospital|ambulance|emergency|accident|crash|surgery|diagnos(?:ed|is)|illness|sick|injur(?:y|ed)|pain|sore|soreness)\b/i],
        ['body_part_or_injury_joke', /\b(?:lower|upper)?\s*(?:back|knee|knees|shoulder|hip|neck|ankle|wrist|elbow|hamstring|quad|calf)\b/i],
        ['self_harm_or_body_risk', /\b(suicide|self[-\s]?harm|eating disorder|body shaming|body[-\s]?shame|ed recovery)\b/i],
        ['animal_shelter_context', /\b(animal shelter|dog kennels?|nycacc|euthan(?:asia|ise|ize)|adoption plea|rescue shelter)\b/i],
        ['minor_or_toilet_context', /\b(child|children|kid|kids|toddler|toddlers|baby|babies|infant|infants|minor|young boys?|young girls?|schoolboys?|schoolgirls?|group of (?:young )?boys|group of (?:young )?girls|boys (?:are )?(?:sitting|standing|playing|posing)|girls (?:are )?(?:sitting|standing|playing|posing)|girls? in dance attire|boys? in dance attire|youth dance|kids? dance|children'?s dance|poop|toilet|bathroom|female toilets|male toilets)\b/i],
        ['body_or_weight_metric', /\b(physique|body transformation|before and after|before\/after|weight loss|weigh(?:s|ed|ing)?|body fat|scale weight|display (?:her|his|their)?\s*physique|posing to display|shapes|back looks great|glossy lips|pout|selfie.{0,80}(?:body check|physique|weight loss))\b|\b\d+\s*(?:kg|kgs|lb|lbs|cm|inch|inches|%)\b/i],
        ['politics_or_legal', /\b(election|vote|politic(?:s|al)?|campaign|trump|biden|court|lawsuit|arrest(?:ed)?|charged|prison|jail|sentenc(?:ed|ing)|convict(?:ed|ion))\b/i],
        ['ambiguous_substance_context', /\b(?:(?:bag|baggie|packet|sachet|ziplock).{0,50}(?:white\s+)?powder|(?:white\s+)?powder.{0,50}(?:bag|baggie|packet|sachet|ziplock)|powder\s+clipped|pills?|tablets?|capsules?|unknown substance)\b/i],
        ['adult_or_drug_content', /\b(nude|naked|sex|porn|onlyfans|nsfw|cocaine|meth|drugs?|overdose)\b/i],
        ['hate_or_harassment', /\b(racist|racism|racial slur|ethnic slur|hate crime|slur|xenophob(?:ia|ic)|reclaim(?:ed|ing) (?:a )?(?:slur|word|term)|bully(?:ing)?|harass(?:ment)?)\b/i],
        ['disaster_or_crisis', /\b(flood|fire|bushfire|earthquake|disaster|evacuat(?:e|ion)|missing person)\b/i],
        ['unclear_story', /\b((?:main\s+)?(?:story|image|video|content)\s+(?:is|looks|seems)\s+(?:too\s+)?(?:blurry|unclear)|(?:too\s+)?(?:blurry|unclear)\s+(?:story|image|video|content)|can't tell|cant tell|cannot tell|hard to tell|difficult to tell|not sure what|not sure what's|no idea what|what'?s happening|whats happening|can'?t figure out|cant figure out|possibly of someone moving)\b/i],
        ['promotional_or_ad', /\b(advertisement|advertising|advertises?|sponsored|promotional|promotion|paid partnership|ad\s+(?:for|by|from)|event poster|poster advertising|upcoming (?:show|event|gig|sale)|tickets?|ticket sales|win tickets|chance to win|giveaway|donations?|donate|fundraiser|promotes?|promoting|dj event|event called|comedy show|show at|spin to win|birthday sale|anniversary sale|youtube video|new youtube video|first drink on us|podcast|episode\s+\d+|guest host|company logo|settled for first home buyer|first home buyer|finance|loan|mortgage|budget form|welcome bonus|free spins|casino)\b/i],
    ];
    for (const [reason, pattern] of unsafePatterns) {
        if (pattern.test(text)) return { safeToComment: false, reason };
    }
    const sharedContext = isSharedStoryContext({
        storyContentType: raw?.story_content_type || raw?.storyContentType || surfaceContext?.storyContentType || surfaceContext?.story_content_type || '',
        sharedFromUsername,
        storyOwner,
        surfaceContext,
    }) || /\b(shared|reshared|reposted|reel|from\s+@|via\s+@)\b/i.test(text);
    const hasTranscript = Boolean(transcript);
    if (sharedContext && !hasTranscript && /\b(?:person|man|woman|creator|someone|guy|girl|he|she|they|speaker|host|podcast(?:er)?|interview(?:er|ee)?)\b.{0,90}\b(?:talk(?:ing|s)?|speak(?:ing|s)?|say(?:ing|s)?|tell(?:ing|s)?|explain(?:ing|s)?|discuss(?:ing|es)?|interview(?:ing|s)?|voice[-\s]?over|lip[-\s]?sync(?:ing)?)\b/i.test(text)) {
        return { safeToComment: false, reason: 'shared_talking_reel_uncertain' };
    }
    if (/\b(talking|speaking|talks|speaks)\s+(?:to|at)\s+(?:the\s+)?camera\b/i.test(text) && meaningfulTranscriptWords.length < 4) {
        return { safeToComment: false, reason: 'talking_video_low_context_transcript' };
    }
    return { safeToComment: true, reason: '' };
}

function isStillsOnlyVideoSalvage(surfaceContext = {}, evidenceVideo = null) {
    return !evidenceVideo?.clean && Boolean(
        surfaceContext?.videoDetected
        || surfaceContext?.videoRetryReason
        || surfaceContext?.videoEvidenceStatus === 'omitted_after_video_bridge_failure'
    );
}

function assessStillsOnlyVideoSalvageContext({
    description = '',
    visibleText = '',
    comment = '',
    storyContentType = 'unknown',
    sharedFromUsername = '',
    surfaceContext = {},
} = {}) {
    if (!isStillsOnlyVideoSalvage(surfaceContext, null)) {
        return { safeToComment: true, reason: '' };
    }

    const text = cleanText(`${description} ${visibleText} ${surfaceContext?.visibleTextHint || ''}`, 4000);
    const lower = text.toLowerCase();
    const draft = cleanText(comment, 160).toLowerCase();
    const contentType = normalizeStoryContentType(storyContentType || surfaceContext?.storyContentType || 'unknown');
    const sharedContent = isSharedStoryContext({
        storyContentType: contentType,
        sharedFromUsername,
        surfaceContext,
    });

    if (!text && !surfaceContext?.storyMusicLabel) {
        return { safeToComment: false, reason: 'analysis_failed' };
    }
    if (/\b(unclear|blurry|hard to tell|difficult to tell|can't tell|cant tell|cannot tell|not sure what|no idea what|possibly|appears to show|seems to show|looks like someone|moving|talking|speaking)\b/i.test(text)) {
        return { safeToComment: false, reason: 'analysis_failed' };
    }
    if (/^(?:nice|cool|love it|love this|great|good one|looks good|awesome|solid|big vibe|vibes|interesting|crazy)[.!?]*$/i.test(draft)) {
        return { safeToComment: false, reason: 'analysis_failed' };
    }
    if (surfaceContext?.storyMusicLabel && /\b(song|track|music|tune|audio)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'song_metadata_handle' };
    }
    if (/\b(dog|puppy|cat|kitten|pet|animal|rabbit|bunny|horse)\b/i.test(lower) && /\b(cute|name)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'pet_handle' };
    }
    if (/\b(food|meal|feed|breakfast|lunch|dinner|cake|coffee|wine|drink|ramen|pasta|pizza|burger|sandwich|sanga|toastie|eggs?|benny|chicken)\b/i.test(lower) && /\b(food|feed|coffee|wine|combo|how was|what'?s|whats|eggs?|benny|chicken)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'food_handle' };
    }
    if (/\b(view|sunset|beach|mountain|river|lake|city|cityscape|rooftop|bar|valley|travel|trip|holiday|place|spot|where)\b/i.test(lower) && /\b(view|city|place|spot|where|looks|what a|rooftop|valley)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'place_handle' };
    }
    if (/\b(book|read|novel|library)\b/i.test(lower) && /\b(book|read|reading)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'book_handle' };
    }
    if (/\b(plant|garden|growing|flower|flowers)\b/i.test(lower) && /\b(plant|garden|growing)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'plant_handle' };
    }
    if (/\b(gym|workout|training|class|session|lift|run|football|game|team|practice)\b/i.test(lower) && /\b(session|workout|track|game|practice|team|barracking|going)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'activity_handle' };
    }
    if (/\b(birthday|celebrat|congrats|anniversary)\b/i.test(lower) && /\b(birthday|great one|congrats|celebrat)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'celebration_handle' };
    }
    if (/\b(selfie|mirror selfie|photo|dress|outfit|wearing|night out|friends|bar|drinks|party|dinner out)\b/i.test(lower) && /\b(looking good|fun night|looks like a fun night)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'selfie_or_night_handle' };
    }
    if (visibleText && visibleText.length >= 12 && /\b(true|gold|funny|sign|line|back|good to have|this is)\b/i.test(draft)) {
        return { safeToComment: true, reason: 'visible_text_handle' };
    }

    if (sharedContent) {
        return { safeToComment: false, reason: 'analysis_failed' };
    }
    return { safeToComment: false, reason: 'analysis_failed' };
}

function normalizeStringList(value, max = 6, limit = 180) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/\n+/);
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        const text = cleanText(String(item || '').replace(/^\s*[-*]\s*/, ''), limit);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= max) break;
    }
    return out;
}

function normalizeStoryCommentPlanPayload(value) {
    const data = value && typeof value === 'object' ? value : {};
    return {
        version: STORY_COMMENT_PIPELINE_VERSION,
        planner_model: 'gemini-story-opener-plan-v1',
        planned_at: new Date().toISOString(),
        story_read: cleanText(data.story_read || data.storyRead || data.story || '', 280),
        opener_strategy: cleanText(data.opener_strategy || data.openerStrategy || data.strategy || '', 220),
        comment_angle: cleanText(data.comment_angle || data.commentAngle || data.angle || '', 180),
        must_reference: normalizeStringList(data.must_reference || data.mustReference || data.reference, 4, 160),
        must_avoid: normalizeStringList(data.must_avoid || data.mustAvoid || data.avoid, 8, 180),
        safety_notes: normalizeStringList(data.safety_notes || data.safetyNotes || data.risk_flags || data.riskFlags, 6, 180),
        confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
    };
}

function normalizeStoryCommentReviewPayload(value) {
    const data = value && typeof value === 'object' ? value : {};
    const verdict = ['pass', 'warn', 'block'].includes(String(data.verdict || '').toLowerCase())
        ? String(data.verdict).toLowerCase()
        : 'warn';
    return {
        version: STORY_COMMENT_PIPELINE_VERSION,
        reviewer_model: 'gemini-story-opener-critic-v1',
        reviewed_at: new Date().toISOString(),
        verdict,
        confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
        summary: cleanText(data.summary || '', 220),
        issues: normalizeStringList(data.issues, 6, 180),
        suggested_fix: cleanText(data.suggested_fix || data.suggestedFix || '', 220),
        repair_directives: normalizeStringList(data.repair_directives || data.repairDirectives, 5, 180),
        safe_to_comment: data.safe_to_comment !== false && data.safeToComment !== false && verdict !== 'block',
        safety_reason: cleanText(data.safety_reason || data.safetyReason || '', 160),
    };
}

function buildStoryCommentPipelineContext({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, initialComment, relationshipContext }) {
    return [
        `Story owner: @${username}`,
        `Story type: ${storyContentType || surfaceContext?.storyContentType || 'unknown'}`,
        sharedFromUsername || surfaceContext?.sharedFromUsername ? `Shared/original creator: @${sharedFromUsername || surfaceContext?.sharedFromUsername}` : '',
        surfaceContext?.sharedContentUrl ? `Shared content URL: ${surfaceContext.sharedContentUrl}` : '',
        surfaceContext?.storyMusicLabel ? `Attached song/audio: ${surfaceContext.storyMusicLabel}` : '',
        relationshipContext ? `Existing relationship context: ${relationshipContext}` : '',
        description ? `Story description: ${description}` : '',
        visibleText ? `Visible text: ${visibleText}` : '',
        surfaceContext?.audioTranscript ? `Audio transcript: ${surfaceContext.audioTranscript}` : '',
        initialComment ? `Initial generated opener: ${initialComment}` : '',
    ].filter(Boolean).join('\n');
}

function storyAnalysisTranscriptNote(surfaceContext = {}) {
    const transcript = cleanText(surfaceContext?.audioTranscript || surfaceContext?.audio_transcript || '', 1600);
    const songLabel = cleanText(surfaceContext?.storyMusicLabel || surfaceContext?.story_music_label || '', 180);
    if (!transcript) return '';
    const songGuard = songLabel
        ? ` Attached song/audio: ${songLabel}. If the transcript is only song lyrics or attached music, treat it as music metadata rather than spoken story context.`
        : '';
    return `Audio transcript captured from the story: ${transcript}. Treat this as supplemental evidence only when it matches the visible screenshot/video frames. If the transcript points to a different subject than the visuals, do not use transcript-only details in the comment; either comment only on a clear visible handle or set safe_to_comment=false with safety_reason="audio_visual_mismatch".${songGuard}`;
}

async function generateStoryCommentPlan({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, initialComment, relationshipContext }) {
    const context = buildStoryCommentPipelineContext({
        username,
        description,
        visibleText,
        storyContentType,
        sharedFromUsername,
        surfaceContext,
        initialComment,
        relationshipContext,
    });
    if (!context.trim()) return null;
    try {
        const prompt = `You are Shannon's private Instagram story opener planner. You do not write the final comment. Pick the safest, most natural opener strategy.

Return JSON only:
{
  "story_read": "what the story appears to be about, using only the provided evidence",
  "opener_strategy": "the best one-move comment strategy",
  "comment_angle": "the specific angle the final short comment should take",
  "must_reference": ["safe visible detail to reference"],
  "must_avoid": ["what would be awkward, insensitive, too salesy, or too personal"],
  "safety_notes": ["sensitive-topic or uncertainty notes"],
  "confidence": 0.0
}

Rules:
- The final comment must start a light conversation, not pitch Balance/coaching/challenge/app. Product/challenge talk belongs later in the lead-only DM qualifier after a direct help/start signal or 3-6 meaningful lead replies with real context.
- If the story is a shared reel/post, tagged story, reshared story, or content from another account, plan a sharer-framed reaction only. Treat @${username} as the person sharing it, not the person in the content.
- For shared content, avoid "you/your" and avoid commenting on the person in the reel/post. Good angles are the shared idea, text, place, joke, news, or mood.
- Treat audio transcript as supplemental. If audio/transcript and visible frames point to different subjects, avoid transcript-only details and plan to skip unless a visible-only opener is clearly safe.
- Prefer one tiny natural question when the story gives a clear handle: pet name, location, food/drink, class, hobby, travel, weather, event, or an interesting object.
- For animal stories with no visible pet name, prefer: Oh so cute, what's their name?
- For odd food/drink combos, keep the specific combo. Example: coffee and wine? hows that combo go?
- If the answer is already visible in the story context, do not ask it. React to the known detail instead.
- If the story shows an unfamiliar event, venue, class, food, hobby, or object, prefer the obvious small context question using the visible noun over "never seen that thing" or another dead-end observation.
- If this is an existing client or active IG thread, do not write like a cold first touch. Keep it warmer but still short.
- Do not use the person's name, profile name, username, @handle, or direct address.
- If context is vague, plan to skip unless there is a clearly grounded tiny question or specific harmless reaction.
- Do not use vague curiosity like "what's the story here?" or ask what unclear OCR/slang text means. If the only handle is unclear text, skip.
- Do not guess personal location or home. Avoid "is that at home?" unless the story explicitly says home.
- For brand birthday or anniversary celebration graphics, a simple milestone reaction is okay. For sales, spin-to-win, competitions, giveaways, or ads, avoid commenting.
- Normal selfies and nights out can be simple. "looking good" or "looks like a fun night" is fine when it fits.
- Keep appearance comments broad and harmless. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- For a clear portrait/selfie, prefer a simple broad vibe like "looking good" over asking who took the photo.
- For a clear portrait/selfie, prefer a simple broad vibe like "looking good" over asking who took the photo.
- For plain selfie/pose videos, do not invent an occasion. If the only real handle is the visible song or audio, a tiny music comment is okay.
- For animal-cruelty, factory-farming, animal-welfare, or vegan-advocacy stories, do not make a normal light joke. If it is not graphic gore and the story owner appears to be sharing concern, plan a soft supportive check-in such as "i can't believe this happens, so sad. you okay?"
- If the story is heavy, political, sexual, violent, medical, grief-related, race/slur/discrimination-related, disaster-related, or otherwise sensitive, say to avoid commenting.
- If the story is sad, low-mood, mental-health related, blurry, unclear, or hard to understand, say to avoid commenting.
- Never mention planning, AI, automation, models, or prompts.

STORY CONTEXT:
${context}`;
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], { maxOutputTokens: 700, temperature: 0.2 });
        return normalizeStoryCommentPlanPayload(parseJsonMaybe(reply) || {});
    } catch (err) {
        console.warn('[story-comment-plan] failed:', err.message);
        return null;
    }
}

async function generateStoryCommentFromPlan({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, initialComment, draftPlan, relationshipContext }) {
    if (!draftPlan) return initialComment;
    try {
        const context = buildStoryCommentPipelineContext({
            username,
            description,
            visibleText,
            storyContentType,
            sharedFromUsername,
            surfaceContext,
            initialComment,
            relationshipContext,
        });
        const prompt = `Write the final Instagram story reply comment for Shannon from this private plan.

Return JSON only:
{ "comment": "one short comment" }

Rules:
- 3-12 words.
- Casual Australian, natural, human.
- Ask one tiny specific question when it clearly keeps the conversation going.
- Do not ask a question if the story already gives the answer.
- For pets with no visible name, "what's their name?" is often better than a dead-end compliment.
- For animal stories with no visible pet name, prefer: Oh so cute, what's their name?
- Treat audio transcript as supplemental. If audio/transcript and visible frames point to different subjects, do not use transcript-only details in the comment.
- For odd food/drink combos, keep the specific combo. Example: coffee and wine? hows that combo go?
- For visible locations, food, classes, hobbies, or odd objects, ask the obvious small context question if it feels natural.
- Avoid flat dead-end comments like "never seen that thing", "thats random", "thats cool", "interesting", "crazy", "big vibe", or "vibes".
- Avoid vague curiosity like "what's the story here?" and do not ask what unclear OCR/slang text means. If the only handle is unclear text, return an empty comment.
- Do not guess personal location or home. Avoid "is that at home?" unless the story explicitly says home.
- For brand birthday or anniversary celebration graphics, a simple milestone reaction is okay. For sales, spin-to-win, competitions, giveaways, or ads, return an empty comment.
- Normal selfies and nights out can be simple. "looking good" or "looks like a fun night" is fine when it fits.
- Keep appearance comments broad and harmless. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- For a clear portrait/selfie, prefer a simple broad vibe like "looking good" over asking who took the photo.
- For plain selfie/pose videos, do not invent an occasion. If the only real handle is the visible song or audio, a tiny music comment is okay.
- No name, profile name, username, @handle, or direct address.
- No Balance/coaching/challenge/app/program/link/meal-plan pitch. Product/challenge talk belongs later in the lead-only DM qualifier after a direct help/start signal or 3-6 meaningful lead replies with real context.
- No unsupported claims. Use only the story context.
- Normal selfies and nights out can be simple. "looking good" or "looks like a fun night" is fine when it fits.
- Keep appearance comments broad and harmless. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- For a clear portrait/selfie, prefer a simple broad vibe like "looking good" over asking who took the photo.
- For gym stories, do not ask how a body part feels or imply injury/pain. Comment on the exercise setup, class, object, or effort instead.
- Do not guess that something is a product, brand deal, collab, or sponsor unless packaging/signage makes that explicit.
- Do not make teasing or critical jokes about grooming, weight, size, or appearance. Pet comments should feel warm and easy.
- Do not call ordinary details "wild". Avoid "wild" as filler, especially for times, workouts, signs, or normal activities.
- For shared reels/posts or credited content, write as if @${username} shared something interesting. Do not imply they are the subject, athlete, model, performer, or creator in the shared content.
- If the plan says the story may be sensitive or unsafe, return an empty comment.
- Never mention AI, automation, planning, review, or prompts.

PRIVATE PLAN:
${JSON.stringify(draftPlan, null, 2)}

STORY CONTEXT:
${context}`;
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], { maxOutputTokens: 220, temperature: 0.45 });
        const parsed = parseJsonMaybe(reply) || {};
        return normalizeDraftComment(parsed.comment || initialComment || '', {
            storyOwner: username,
            sharedFromUsername,
            sharedContent: isSharedStoryContext({ storyContentType, sharedFromUsername, storyOwner: username, surfaceContext }),
        });
    } catch (err) {
        console.warn('[story-comment-generator] failed:', err.message);
        return initialComment;
    }
}

async function reviewStoryComment({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, draftPlan, comment, relationshipContext }) {
    const sharedContent = isSharedStoryContext({ storyContentType, sharedFromUsername, storyOwner: username, surfaceContext });
    const normalizedComment = normalizeDraftComment(comment, { storyOwner: username, sharedFromUsername, sharedContent });
    const deterministicSafety = assessStoryCommentSafety({
        description,
        visibleText,
        comment: normalizedComment,
        storyOwner: username,
        sharedFromUsername,
        surfaceContext,
    });
    if (!normalizedComment) {
        return normalizeStoryCommentReviewPayload({
            verdict: 'block',
            confidence: 1,
            summary: 'No usable story opener was produced.',
            issues: ['empty_comment'],
            suggested_fix: 'Skip this story.',
            safe_to_comment: false,
            safety_reason: 'empty_comment',
        });
    }
    if (!deterministicSafety.safeToComment) {
        return normalizeStoryCommentReviewPayload({
            verdict: 'block',
            confidence: 1,
            summary: 'The story context is too sensitive for a casual opener.',
            issues: [deterministicSafety.reason],
            suggested_fix: 'Skip this story.',
            safe_to_comment: false,
            safety_reason: deterministicSafety.reason,
        });
    }

    try {
        const context = buildStoryCommentPipelineContext({
            username,
            description,
            visibleText,
            storyContentType,
            sharedFromUsername,
            surfaceContext,
            initialComment: comment,
            relationshipContext,
        });
        const prompt = `You are Shannon's private critic for one Instagram story reply. Decide if this short comment is safe and worth sending.

Return JSON only:
{
  "verdict": "pass|warn|block",
  "confidence": 0.0,
  "summary": "one short private summary",
  "issues": ["specific issue"],
  "suggested_fix": "how to fix or skip",
  "repair_directives": ["exact instruction for the fixer"],
  "safe_to_comment": true,
  "safety_reason": ""
}

Critique rules:
- Block if the story is heavy/sensitive: war, politics, weapons, violence, death, grief, disasters, medical emergencies, race/slur/discrimination topics, self-harm, sexual/nude content, hate/harassment, drugs, legal trouble, or vulnerable minors.
- Exception: animal-cruelty, factory-farming, animal-welfare, or vegan-advocacy stories may pass with a soft supportive check-in to the story owner, for example "i can't believe this happens, so sad. you okay?", unless the evidence is graphic gore or unclear.
- For shared reels/posts, tagged stories, reshared stories, or content from another account, allow only sharer-framed reactions. Block if the comment treats the reel/post subject as the story owner.
- Block if the comment includes the story owner's name, profile name, username, @handle, or direct address.
- Block if the comment pitches Balance/coaching/challenge/app/program/link/meal plan. Story comments are first-touch rapport, not the offer step.
- Block if the comment is flirty, sexual, body-specific, weight/physique-focused, or weirdly intense. Mild broad selfie comments like "looking good" can pass.
- Block if the comment asks how a body part feels or implies injury/pain.
- Block if the comment is based on transcript-only details that conflict with the visible frames.
- Block if the comment guesses product/brand/collab/sponsor from a selfie or unclear context.
- Block if it is vague curiosity like "what's the story here?" or if it asks what unclear OCR/slang text means.
- Block if it jokes critically about grooming, weight, size, or appearance.
- Block shared-content replies that say "you/your", praise a lift/session/run/outfit/look, or imply the story owner is the person performing/appearing in the shared content.
- Warn if an obvious, safe conversation handle exists but the comment is a dead-end generic compliment.
- Warn if it is vague, clunky, too intense, or overclaims what is visible.
- Pass only if it is light, specific enough, harmless, and grounded in the story.
- Never reveal AI, automation, planning, critique, or prompts.

PRIVATE PLAN:
${draftPlan ? JSON.stringify(draftPlan, null, 2) : '(no separate plan)'}

STORY CONTEXT:
${context}

COMMENT TO REVIEW:
${normalizedComment}`;
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], { maxOutputTokens: 500, temperature: 0.1 });
        const review = normalizeStoryCommentReviewPayload(parseJsonMaybe(reply) || {});
        if (review.verdict !== 'block' && !deterministicSafety.safeToComment) {
            return normalizeStoryCommentReviewPayload({
                ...review,
                verdict: 'block',
                safe_to_comment: false,
                safety_reason: deterministicSafety.reason,
                issues: [...(review.issues || []), deterministicSafety.reason],
            });
        }
        return review;
    } catch (err) {
        console.warn('[story-comment-review] failed:', err.message);
        return normalizeStoryCommentReviewPayload({
            verdict: 'warn',
            confidence: 0,
            summary: 'Story comment review failed, so this needs manual eyes.',
            issues: ['review_failed'],
            suggested_fix: 'Review before sending.',
            safe_to_comment: true,
            safety_reason: '',
        });
    }
}

async function repairStoryCommentFromReview({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, draftPlan, comment, review, relationshipContext }) {
    if (!review || review.verdict === 'pass') return null;
    if (review.safe_to_comment === false || review.verdict === 'block') return null;
    try {
        const context = buildStoryCommentPipelineContext({
            username,
            description,
            visibleText,
            storyContentType,
            sharedFromUsername,
            surfaceContext,
            initialComment: comment,
            relationshipContext,
        });
        const prompt = `Rewrite this Instagram story reply after a private critique.

Return JSON only:
{ "comment": "one short fixed comment" }

Rules:
- 3-12 words.
- Prefer one tiny specific question if the critique says the original is a dead end and the story has a safe handle.
- No name, profile name, username, @handle, or direct address.
- No Balance/coaching/challenge/app/program/link/meal-plan pitch. Story comments are first-touch rapport, not the offer step.
- Mild broad selfie comments like "looking good" can pass. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- Do not ask how a body part feels or imply injury/pain.
- Do not guess product/brand/collab/sponsor unless packaging/signage makes that explicit.
- Do not make teasing or critical jokes about grooming, weight, size, or appearance.
- Do not use "wild" as filler.
- Do not use vague curiosity like "what's the story here?" or ask what unclear OCR/slang text means.
- For shared reels/posts or credited content, react to the shared idea, text, place, joke, news, or mood only. Do not write as if the story owner is the person in it.
- Do not overclaim. Use only the story context.
- If the story is blurry, unclear, sad, mental-health related, race/slur/discrimination related, or injury/pain related, return an empty comment.
- If it cannot be safely fixed, return an empty comment.
- Never mention AI, automation, planning, critique, or prompts.

PRIVATE PLAN:
${draftPlan ? JSON.stringify(draftPlan, null, 2) : '(no separate plan)'}

CRITIQUE:
${JSON.stringify(review, null, 2)}

STORY CONTEXT:
${context}

ORIGINAL COMMENT:
${comment}`;
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], { maxOutputTokens: 220, temperature: 0.4 });
        const parsed = parseJsonMaybe(reply) || {};
        const repaired = normalizeDraftComment(parsed.comment || '', {
            storyOwner: username,
            sharedFromUsername,
            sharedContent: isSharedStoryContext({ storyContentType, sharedFromUsername, storyOwner: username, surfaceContext }),
        });
        if (!repaired || repaired === comment) return null;
        return {
            repaired_at: new Date().toISOString(),
            before: truncate(comment || '', 400),
            after: truncate(repaired, 400),
            prior_review: review,
        };
    } catch (err) {
        console.warn('[story-comment-repair] failed:', err.message);
        return null;
    }
}

async function runStoryCommentPlanReviewRepair({ username, description, visibleText, storyContentType, sharedFromUsername, surfaceContext, initialComment, relationshipContext }) {
    const draftPlan = await generateStoryCommentPlan({
        username,
        description,
        visibleText,
        storyContentType,
        sharedFromUsername,
        surfaceContext,
        initialComment,
        relationshipContext,
    });
    const generatedComment = await generateStoryCommentFromPlan({
        username,
        description,
        visibleText,
        storyContentType,
        sharedFromUsername,
        surfaceContext,
        initialComment,
        draftPlan,
        relationshipContext,
    });
    const firstReview = await reviewStoryComment({
        username,
        description,
        visibleText,
        storyContentType,
        sharedFromUsername,
        surfaceContext,
        draftPlan,
        comment: generatedComment,
        relationshipContext,
    });
    let finalComment = generatedComment;
    let finalReview = firstReview;
    let draftRepair = null;

    if (firstReview && firstReview.verdict !== 'pass') {
        const repair = await repairStoryCommentFromReview({
            username,
            description,
            visibleText,
            storyContentType,
            sharedFromUsername,
            surfaceContext,
            draftPlan,
            comment: generatedComment,
            review: firstReview,
            relationshipContext,
        });
        if (repair?.after) {
            finalComment = repair.after;
            draftRepair = repair;
            finalReview = await reviewStoryComment({
                username,
                description,
                visibleText,
                storyContentType,
                sharedFromUsername,
                surfaceContext,
                draftPlan,
                comment: finalComment,
                relationshipContext,
            });
        }
    }

    return {
        draftPlan,
        draftReview: finalReview,
        draftRepair,
        initialDraftComment: initialComment,
        draftCommentBeforeReview: generatedComment,
        finalComment,
    };
}

function normalizeStoryContentType(value) {
    const raw = cleanText(value, 80).toLowerCase();
    if (['own_story', 'shared_reel', 'shared_post', 'reshared_story', 'tagged_story', 'unknown'].includes(raw)) return raw;
    if (raw.includes('reel')) return 'shared_reel';
    if (raw.includes('post')) return 'shared_post';
    if (raw.includes('tag')) return 'tagged_story';
    if (raw.includes('story')) return 'reshared_story';
    return 'unknown';
}

function normalizeStorySurfaceContext(body) {
    const fromBody = body.story_surface_context || body.storySurfaceContext || {};
    return {
        storyContentType: normalizeStoryContentType(
            body.story_content_type || body.storyContentType || fromBody.story_content_type || fromBody.storyContentType
        ),
        confidence: cleanText(
            body.story_content_confidence || body.storyContentConfidence || fromBody.story_content_confidence || fromBody.storyContentConfidence || '',
            40
        ) || 'low',
        sharedContentUrl: cleanText(
            body.shared_content_url || body.sharedContentUrl || fromBody.shared_content_url || fromBody.sharedContentUrl || '',
            500
        ),
        sharedFromUsername: cleanIgUsername(
            body.shared_from_username || body.sharedFromUsername || fromBody.shared_from_username || fromBody.sharedFromUsername || ''
        ),
        visibleTextHint: cleanText(fromBody.visible_story_text_hint || fromBody.visibleStoryTextHint || '', 900),
        storyMusicDetected: Boolean(
            body.story_music_detected
            || body.storyMusicDetected
            || fromBody.story_music_detected
            || fromBody.storyMusicDetected
            || body.story_music_label
            || body.storyMusicLabel
            || fromBody.story_music_label
            || fromBody.storyMusicLabel
        ),
        storyMusicLabel: cleanText(
            body.story_music_label || body.storyMusicLabel || fromBody.story_music_label || fromBody.storyMusicLabel || '',
            180
        ),
        storyMusicArtist: cleanText(
            body.story_music_artist || body.storyMusicArtist || fromBody.story_music_artist || fromBody.storyMusicArtist || '',
            90
        ),
        storyMusicTitle: cleanText(
            body.story_music_title || body.storyMusicTitle || fromBody.story_music_title || fromBody.storyMusicTitle || '',
            120
        ),
        audioTranscript: cleanText(
            body.audio_transcript || body.audioTranscript || fromBody.audio_transcript || fromBody.audioTranscript || '',
            1600
        ),
        audioTranscriptStatus: cleanText(
            body.audio_transcript_status || body.audioTranscriptStatus || fromBody.audio_transcript_status || fromBody.audioTranscriptStatus || '',
            80
        ),
        audioStatus: cleanText(
            body.audio_status || body.audioStatus || fromBody.audio_status || fromBody.audioStatus || '',
            80
        ),
        videoDetected: isTruthyValue(
            body.video_detected || body.videoDetected || fromBody.video_detected || fromBody.videoDetected
        ),
        videoEvidenceStatus: cleanText(
            body.video_evidence_status || body.videoEvidenceStatus || fromBody.video_evidence_status || fromBody.videoEvidenceStatus || '',
            100
        ),
        videoRetryReason: cleanText(
            body.video_retry_reason || body.videoRetryReason || fromBody.video_retry_reason || fromBody.videoRetryReason || '',
            120
        ),
        raw: fromBody && typeof fromBody === 'object' ? fromBody : null,
    };
}

function isAuthorized(event) {
    if (!SHARED_SECRET) return process.env.CONTEXT === 'dev' || process.env.NODE_ENV === 'test';
    const provided = String(
        event.headers?.['x-story-bot-secret']
        || event.headers?.['X-Story-Bot-Secret']
        || event.headers?.authorization?.replace(/^Bearer\s+/i, '')
        || ''
    ).trim();
    return provided && provided === SHARED_SECRET;
}

function validateBase64Image(imageBase64, mimeType) {
    const clean = String(imageBase64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
    if (!clean) return { clean: '', mimeType: '' };
    if (!/^[A-Za-z0-9+/=]+$/.test(clean)) throw new Error('invalid_image_base64');
    const type = String(mimeType || 'image/png').toLowerCase();
    if (!/^image\/(png|jpe?g|webp)$/.test(type)) throw new Error('unsupported_image_type');
    // Keep Netlify payloads sane. A normal browser screenshot is usually
    // 300-900 KB as base64; 8 MB leaves headroom without inviting giant uploads.
    if (clean.length > 8 * 1024 * 1024) throw new Error('image_too_large');
    return { clean, mimeType: type === 'image/jpg' ? 'image/jpeg' : type };
}

function validateEvidenceImages(body) {
    const images = [];
    const primary = validateBase64Image(
        body.image_base64 || body.imageBase64 || '',
        body.mime_type || body.mimeType || 'image/png'
    );
    if (primary.clean) {
        images.push({
            ...primary,
            label: 'primary screenshot',
            screenshotPath: cleanText(body.screenshot_path || '', 500),
        });
    }

    const frames = Array.isArray(body.frame_images)
        ? body.frame_images
        : (Array.isArray(body.frameImages) ? body.frameImages : []);
    const maxFrames = Math.max(0, STORY_COMMENT_MAX_EVIDENCE_IMAGES - images.length);
    for (const [idx, frame] of frames.slice(0, maxFrames).entries()) {
        const frameImage = validateBase64Image(
            frame?.image_base64 || frame?.imageBase64 || frame?.base64 || '',
            frame?.mime_type || frame?.mimeType || 'image/png'
        );
        if (!frameImage.clean) continue;
        images.push({
            ...frameImage,
            label: `sampled video frame ${idx + 1}`,
            screenshotPath: cleanText(frame?.screenshot_path || frame?.screenshotPath || '', 500),
        });
    }

    const totalBytes = images.reduce((sum, image) => sum + image.clean.length, 0);
    if (totalBytes > 18 * 1024 * 1024) throw new Error('evidence_images_too_large');
    return images;
}

function validateBase64Video(videoBase64, mimeType, reportedBytes = 0) {
    const clean = String(videoBase64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
    if (!clean) return null;
    if (!/^[A-Za-z0-9+/=]+$/.test(clean)) throw new Error('invalid_video_base64');
    const type = String(mimeType || 'video/mp4').toLowerCase();
    const normalizedType = type === 'video/x-m4v' ? 'video/mp4' : type;
    if (!/^video\/(mp4|webm|quicktime)$/.test(normalizedType)) throw new Error('unsupported_video_type');
    const approxBytes = Math.ceil(clean.length * 0.75);
    const bytes = Number(reportedBytes) > 0 ? Number(reportedBytes) : approxBytes;
    if (bytes > STORY_COMMENT_MAX_EVIDENCE_VIDEO_BYTES || approxBytes > STORY_COMMENT_MAX_EVIDENCE_VIDEO_BYTES + 4096) {
        throw new Error('video_too_large');
    }
    return { clean, mimeType: normalizedType, bytes };
}

function validateEvidenceVideo(body) {
    const video = validateBase64Video(
        body.video_base64 || body.videoBase64 || '',
        body.video_mime_type || body.videoMimeType || body.mime_type_video || body.video_mime || 'video/mp4',
        body.video_evidence_bytes || body.videoEvidenceBytes || body.video_bytes || body.videoBytes || 0
    );
    if (!video) return null;
    return {
        ...video,
        videoPath: cleanText(body.video_path || body.videoPath || '', 500),
        evidenceStatus: cleanText(body.video_evidence_status || body.videoEvidenceStatus || 'included', 80) || 'included',
    };
}

async function findDefaultCoachId() {
    const rows = await supabaseQuery('admin_users?select=user_id&order=created_at.asc&limit=1');
    return rows[0]?.user_id || null;
}

async function findExistingThreadByHandle(username) {
    if (!username) return null;
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,last_inbound_at,last_outbound_at,last_memory_extracted_at,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier,auto_send_enabled&channel=eq.instagram&ig_username=ilike.${encodeURIComponent(username)}&order=last_inbound_at.desc.nullslast&limit=10`
    );
    return rows.find(row => String(row.ig_username || '').toLowerCase() === username.toLowerCase()) || null;
}

async function loadRecentThreadMessages(threadId, limit = 50) {
    if (!threadId) return [];
    try {
        return await supabaseQuery(
            `ig_messages?select=direction,text,created_at,source&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.desc&limit=${limit}`
        );
    } catch (err) {
        console.warn('[ig-story-outreach] recent message lookup failed:', err.message);
        return [];
    }
}

async function loadPendingThreadAlerts(threadId, limit = 5) {
    if (!threadId) return [];
    try {
        return await supabaseQuery(
            `coach_alerts?select=id,status,alert_type,created_at,suggested_message,data&data->>ig_thread_id=eq.${encodeURIComponent(threadId)}&status=in.(pending,scheduled)&order=created_at.desc&limit=${limit}`
        );
    } catch (err) {
        console.warn('[ig-story-outreach] pending alert lookup failed:', err.message);
        return [];
    }
}

async function loadLinkedClientMemory(thread) {
    if (!thread?.coach_id || !thread?.linked_user_id) return null;
    try {
        const rows = await supabaseQuery(
            `client_memory?select=goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,auto_send_enabled&coach_id=eq.${encodeURIComponent(thread.coach_id)}&client_id=eq.${encodeURIComponent(thread.linked_user_id)}&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        console.warn('[ig-story-outreach] linked client memory lookup failed:', err.message);
        return null;
    }
}

async function loadChallengeParticipation(userId) {
    if (!userId) return [];
    try {
        return await supabaseQuery(
            `challenge_participants?select=challenge_id,status,joined_at,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=3`
        );
    } catch (err) {
        return [];
    }
}

function hasRecentUnansweredInbound(thread, now = new Date()) {
    if (!thread?.last_inbound_at) return false;
    const inboundAt = new Date(thread.last_inbound_at);
    if (Number.isNaN(inboundAt.getTime())) return false;
    const outboundAt = thread.last_outbound_at ? new Date(thread.last_outbound_at) : null;
    if (outboundAt && !Number.isNaN(outboundAt.getTime()) && outboundAt >= inboundAt) return false;
    return now.getTime() - inboundAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function storyOutreachMemoryWasSent(item = {}) {
    const status = cleanText(item.send_status || item.status || '', 80).toLowerCase();
    return item.sent === true
        || status === 'sent'
        || !!item.sent_at;
}

function isDryRunQualityJudge(body = {}, dryRun = false) {
    if (!dryRun) return false;
    return body.quality_judge === true
        || body.qualityJudge === true
        || body.ignore_relationship_blocks === true
        || body.ignoreRelationshipBlocks === true;
}

function shouldRecommendLikeFallback(analysis = {}, relationshipStoryBlockReason = '') {
    const reason = cleanText(
        analysis.relationshipStoryBlockReason
        || relationshipStoryBlockReason
        || analysis.safetyReason
        || '',
        120
    ).toLowerCase();
    return reason === 'story_no_reply_cooldown' || reason === 'analysis_failed';
}

function storyOutreachMemoryTime(item = {}) {
    return validDate(item.sent_at || item.updated_at || item.captured_at || item.created_at);
}

function storyNoReplyCooldown(thread, recentMessages = [], now = new Date()) {
    if (!thread?.id) return null;
    const lastInboundAt = validDate(thread.last_inbound_at);
    const lastInboundMs = lastInboundAt ? lastInboundAt.getTime() : 0;
    const messageAttempts = (Array.isArray(recentMessages) ? recentMessages : [])
        .filter(message => {
            if (message?.direction !== 'out') return false;
            if (message?.source !== 'native_story_comment') return false;
            const createdAt = validDate(message.created_at);
            return createdAt && createdAt.getTime() > lastInboundMs;
        })
        .map(message => ({
            at: validDate(message.created_at),
            text: cleanText(message.text || '', 160),
            source: 'ig_messages',
        }))
        .filter(item => item.at);

    const history = Array.isArray(thread.custom_data?.story_outreach_history)
        ? thread.custom_data.story_outreach_history
        : [];
    const memoryAttempts = history
        .filter(storyOutreachMemoryWasSent)
        .map(item => ({
            at: storyOutreachMemoryTime(item),
            text: cleanText(item.sent_comment || item.draft_comment || '', 160),
            source: 'story_outreach_history',
        }))
        .filter(item => item.at && item.at.getTime() > lastInboundMs);

    const attempts = (messageAttempts.length >= STORY_NO_REPLY_COMMENT_LIMIT ? messageAttempts : memoryAttempts)
        .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (attempts.length < STORY_NO_REPLY_COMMENT_LIMIT) return null;

    const latest = attempts[attempts.length - 1];
    const cooldownUntil = new Date(latest.at.getTime() + STORY_NO_REPLY_COOLDOWN_MS);
    if (now.getTime() >= cooldownUntil.getTime()) return null;

    return {
        reason: 'story_no_reply_cooldown',
        count: attempts.length,
        limit: STORY_NO_REPLY_COMMENT_LIMIT,
        latest_sent_at: latest.at.toISOString(),
        cooldown_until: cooldownUntil.toISOString(),
        cooldown_days: STORY_NO_REPLY_COOLDOWN_DAYS,
        source: latest.source,
    };
}

function storyRecentOutreachCooldown(thread, recentMessages = [], now = new Date()) {
    if (!thread?.id) return null;
    const cutoffMs = now.getTime() - STORY_RECENT_OUTREACH_COOLDOWN_MS;
    const messageAttempts = (Array.isArray(recentMessages) ? recentMessages : [])
        .filter(message => {
            if (message?.direction !== 'out') return false;
            if (message?.source !== 'native_story_comment') return false;
            const createdAt = validDate(message.created_at);
            return createdAt && createdAt.getTime() >= cutoffMs;
        })
        .map(message => ({
            at: validDate(message.created_at),
            text: cleanText(message.text || '', 160),
            source: 'ig_messages',
        }))
        .filter(item => item.at);
    const history = Array.isArray(thread.custom_data?.story_outreach_history)
        ? thread.custom_data.story_outreach_history
        : [];
    const memoryAttempts = history
        .filter(storyOutreachMemoryWasSent)
        .map(item => ({
            at: storyOutreachMemoryTime(item),
            text: cleanText(item.sent_comment || item.draft_comment || '', 160),
            source: 'story_outreach_history',
        }))
        .filter(item => item.at && item.at.getTime() >= cutoffMs);
    const attempts = [...messageAttempts, ...memoryAttempts]
        .sort((a, b) => b.at.getTime() - a.at.getTime());
    const latest = attempts[0];
    if (!latest) return null;
    return {
        reason: 'recent_story_outreach',
        latest_sent_at: latest.at.toISOString(),
        cooldown_until: new Date(latest.at.getTime() + STORY_RECENT_OUTREACH_COOLDOWN_MS).toISOString(),
        cooldown_hours: STORY_RECENT_OUTREACH_COOLDOWN_HOURS,
        source: latest.source,
    };
}

function relationshipStoryBlockReason(thread, pendingAlerts = [], recentMessages = [], now = new Date()) {
    const activePending = (pendingAlerts || []).find(alert => ['pending', 'scheduled'].includes(String(alert.status || '')));
    if (activePending) return 'pending_dm_reply';
    if (hasRecentUnansweredInbound(thread)) return 'open_dm_needs_reply';
    const cooldown = storyNoReplyCooldown(thread, recentMessages, now);
    if (cooldown) return cooldown.reason;
    const recentCooldown = storyRecentOutreachCooldown(thread, recentMessages, now);
    if (recentCooldown) return recentCooldown.reason;
    return '';
}

function appendRelationshipField(lines, label, value, max = 380) {
    const text = cleanText(value || '', max);
    if (text) lines.push(`${label}: ${text}`);
}

function formatRelationshipChecklist(facts = {}) {
    const checklist = facts.relationship_checklist && typeof facts.relationship_checklist === 'object'
        ? facts.relationship_checklist
        : {};
    return Object.entries(checklist)
        .filter(([, value]) => cleanText(value || '', 120))
        .slice(0, 8)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}=${cleanText(value, 120)}`)
        .join('; ');
}

function buildExistingRelationshipContext(thread, details = {}) {
    if (!thread?.id) {
        return 'No existing IG thread found. Treat this as a light first-touch opener.';
    }
    const lines = ['Existing IG thread found.'];
    const leadStage = cleanText(thread.lead_stage || '', 80);
    const pendingAlerts = Array.isArray(details.pendingAlerts) ? details.pendingAlerts : [];
    const recentMessages = Array.isArray(details.recentMessages) ? details.recentMessages : [];
    const clientMemory = details.clientMemory && typeof details.clientMemory === 'object' ? details.clientMemory : null;
    const challengeRows = Array.isArray(details.challengeRows) ? details.challengeRows : [];
    const storyCooldown = details.storyCooldown || storyNoReplyCooldown(thread, recentMessages);
    const recentStoryCooldown = details.recentStoryCooldown || storyRecentOutreachCooldown(thread, recentMessages);
    const storyHold = details.storyBlockReason || relationshipStoryBlockReason(thread, pendingAlerts, recentMessages);

    if (thread.linked_user_id) {
        lines.push('This handle is linked to an app/challenge user, so treat it as an existing relationship/client-adjacent channel.');
    } else if (leadStage && leadStage !== 'new') {
        lines.push(`Lead stage: ${leadStage}. Do not reset to a cold intro.`);
    } else {
        lines.push('They are already in Shannon\'s IG thread table, so avoid sounding like a generic cold bot.');
    }
    if (thread.auto_send_enabled) lines.push('Auto-send is enabled for this IG thread.');
    if (storyHold) {
        lines.push(`Reply-needed warning: ${storyHold}. Do not add a new story opener while this person is waiting on a DM reply.`);
    }
    if (storyCooldown) {
        lines.push(
            `Story outreach cooldown: ${storyCooldown.count} sent story comments since their last inbound with no reply. Like only until ${storyCooldown.cooldown_until}.`
        );
    }
    if (recentStoryCooldown) {
        lines.push(`Recent story opener already sent at ${recentStoryCooldown.latest_sent_at}; do not send another until ${recentStoryCooldown.cooldown_until}.`);
    }
    if (thread.last_inbound_at) lines.push(`Last inbound exists at ${cleanText(thread.last_inbound_at, 60)}.`);
    if (thread.last_outbound_at) lines.push(`Last outbound exists at ${cleanText(thread.last_outbound_at, 60)}.`);

    const q = thread.qualifier && typeof thread.qualifier === 'object' ? thread.qualifier : null;
    if (q) {
        const facts = q.facts && typeof q.facts === 'object' ? q.facts : {};
        const qBits = [
            q.stage ? `stage=${cleanText(q.stage, 80)}` : '',
            q.warmth_label ? `warmth=${cleanText(q.warmth_label, 80)}` : '',
            Number.isFinite(Number(q.warmth_score)) ? `score=${Number(q.warmth_score)}` : '',
            q.challenge_route ? `route=${cleanText(q.challenge_route, 80)}` : '',
            q.next_question ? `next=${cleanText(q.next_question, 160)}` : '',
        ].filter(Boolean);
        if (qBits.length) lines.push(`Qualifier: ${qBits.join('; ')}.`);
        appendRelationshipField(lines, 'Relationship context', facts.relationship_context, 300);
        appendRelationshipField(lines, 'Current state', facts.current_state, 240);
        appendRelationshipField(lines, 'Motivation', facts.motivation, 240);
        appendRelationshipField(lines, 'History/blockers', facts.history_blockers, 240);
        appendRelationshipField(lines, 'Commitment', facts.commitment, 200);
        const checklist = formatRelationshipChecklist(facts);
        if (checklist) lines.push(`Known relationship anchors: ${checklist}.`);
    }

    const memory = clientMemory || thread;
    appendRelationshipField(lines, clientMemory ? 'Linked client goals' : 'Lead goals', memory.goals, 300);
    appendRelationshipField(lines, 'Personal context', memory.personal_context, 360);
    appendRelationshipField(lines, 'Communication style', memory.communication_style, 260);
    appendRelationshipField(lines, 'Injuries/limits', memory.injuries_limits, 220);
    appendRelationshipField(lines, 'Running notes', memory.running_notes, 500);
    appendRelationshipField(lines, 'Coach instructions for this person', memory.coach_instructions, 500);

    if (challengeRows.length) {
        const challengeSummary = challengeRows
            .slice(0, 3)
            .map(row => cleanText(row.status || 'joined', 60))
            .filter(Boolean)
            .join(', ');
        if (challengeSummary) lines.push(`Challenge participation rows exist: ${challengeSummary}.`);
    }

    if (pendingAlerts.length) {
        const pendingSummary = pendingAlerts
            .slice(0, 3)
            .map(alert => `${cleanText(alert.status, 40)} ${cleanText(alert.alert_type, 80)}`.trim())
            .join('; ');
        if (pendingSummary) lines.push(`Active DM/admin alerts: ${pendingSummary}.`);
    }

    if (recentMessages.length) {
        const timeline = recentMessages
            .slice()
            .reverse()
            .slice(-6)
            .map(message => {
                const speaker = message.direction === 'out' ? 'Shannon' : 'Them';
                return `${speaker}: ${cleanText(message.text || '', 180)}`;
            })
            .filter(Boolean)
            .join(' | ');
        if (timeline) lines.push(`Recent DM timeline: ${timeline}`);
    }

    const lastStory = thread.custom_data?.last_story_outreach || {};
    const lastComment = cleanText(lastStory.sent_comment || lastStory.draft_comment || '', 140);
    if (lastComment) lines.push(`Recent story opener already used: ${lastComment}`);
    return truncate(lines.join(' '), 3500);
}

async function loadRelationshipContextForHandle(username) {
    const thread = await findExistingThreadByHandle(username);
    if (!thread?.id) {
        return {
            thread: null,
            context: buildExistingRelationshipContext(null),
            storyBlockReason: '',
        };
    }
    const [recentMessages, pendingAlerts, clientMemory, challengeRows] = await Promise.all([
        loadRecentThreadMessages(thread.id),
        loadPendingThreadAlerts(thread.id),
        loadLinkedClientMemory(thread),
        loadChallengeParticipation(thread.linked_user_id),
    ]);
    const storyCooldown = storyNoReplyCooldown(thread, recentMessages);
    const recentStoryCooldown = storyRecentOutreachCooldown(thread, recentMessages);
    const storyBlockReason = relationshipStoryBlockReason(thread, pendingAlerts, recentMessages);
    return {
        thread,
        context: buildExistingRelationshipContext(thread, {
            recentMessages,
            pendingAlerts,
            clientMemory,
            challengeRows,
            storyBlockReason,
            storyCooldown,
            recentStoryCooldown,
        }),
        storyBlockReason,
        storyCooldown: storyCooldown || recentStoryCooldown,
    };
}

function buildStoryOutreachMemory({ storyUrl, storyId, draftComment, analysis, surfaceContext, nowIso, body }) {
    return {
        story_url: storyUrl,
        story_id: storyId,
        draft_comment: draftComment,
        sent_comment: draftComment,
        draft_pipeline: analysis?.draftPipeline || null,
        draft_plan: analysis?.draftPlan || null,
        draft_review: analysis?.draftReview || null,
        draft_repair: analysis?.draftRepair || null,
        initial_draft_comment: analysis?.initialDraftComment || null,
        draft_comment_before_review: analysis?.draftCommentBeforeReview || null,
        story_description: analysis?.description || null,
        story_visible_text: analysis?.visibleText || null,
        story_content_type: analysis?.storyContentType || surfaceContext?.storyContentType || 'unknown',
        shared_from_username: analysis?.sharedFromUsername || surfaceContext?.sharedFromUsername || null,
        shared_content_url: surfaceContext?.sharedContentUrl || null,
        story_music_detected: surfaceContext?.storyMusicDetected || false,
        story_music_label: surfaceContext?.storyMusicLabel || null,
        story_music_artist: surfaceContext?.storyMusicArtist || null,
        story_music_title: surfaceContext?.storyMusicTitle || null,
        relationship_context: analysis?.relationshipContext || null,
        relationship_story_block_reason: analysis?.relationshipStoryBlockReason || null,
        evidence_mode: cleanText(body?.evidence_mode || body?.evidenceMode || '', 80) || null,
        video_path: cleanText(body?.video_path || body?.videoPath || '', 500) || null,
        video_evidence_status: cleanText(body?.video_evidence_status || body?.videoEvidenceStatus || '', 80) || null,
        video_evidence_bytes: Number(body?.video_evidence_bytes || body?.videoEvidenceBytes || 0) || null,
        video_detected: body?.video_detected === true || body?.videoDetected === true,
        bot_account: cleanText(body?.bot_account || '', 80) || null,
        send_status: cleanText(body?.send_status || '', 80) || (body?.sent === true ? 'sent' : 'draft_only'),
        sent: body?.send_status === 'sent' || body?.sent === true,
        sent_at: (body?.send_status === 'sent' || body?.sent === true)
            ? cleanText(body?.sent_at || '', 80) || nowIso
            : null,
        captured_at: cleanText(body?.created_at || '', 80) || nowIso,
        updated_at: nowIso,
        source: 'selenium_story_bot',
    };
}

async function ensureOutreachThread({ username, coachId, storyUrl, storyId, draftComment, analysis, surfaceContext, body, nowIso, existingThread }) {
    const existing = existingThread || await findExistingThreadByHandle(username);
    const outreachMemory = buildStoryOutreachMemory({
        storyUrl,
        storyId,
        draftComment,
        analysis,
        surfaceContext,
        nowIso,
        body,
    });
    const customPatch = {
        ...(existing?.custom_data || {}),
        source: existing?.custom_data?.source || 'instagram',
        last_story_outreach: outreachMemory,
        story_outreach_history: [
            ...((Array.isArray(existing?.custom_data?.story_outreach_history)
                ? existing.custom_data.story_outreach_history
                : []).filter(item => item?.story_id !== storyId)),
            outreachMemory,
        ].slice(-12),
    };
    if (existing?.id) {
        await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            body: {
                coach_id: existing.coach_id || coachId || null,
                ig_username: username,
                profile_name: username,
                custom_data: customPatch,
            },
            prefer: 'return=minimal',
        });
        return { ...existing, custom_data: customPatch };
    }
    const inserted = await supabaseQuery('ig_threads', {
        method: 'POST',
        body: [{
            subscriber_id: `native_story:${username.toLowerCase()}`,
            coach_id: coachId || null,
            channel: 'instagram',
            ig_username: username,
            profile_name: username,
            lead_stage: 'new',
            custom_data: customPatch,
            last_outbound_at: null,
        }],
    });
    return inserted[0] || null;
}

async function analyzeStoryEvidence({ username, evidenceImages, evidenceVideo = null, suppliedComment, surfaceContext, relationshipContext = '', relationshipStoryBlockReason = '', forceSuppliedComment = false }) {
    const normalizedSupplied = normalizeDraftComment(suppliedComment, {
        storyOwner: username,
        sharedFromUsername: surfaceContext?.sharedFromUsername,
        sharedContent: isSharedStoryContext({
            storyContentType: surfaceContext?.storyContentType,
            sharedFromUsername: surfaceContext?.sharedFromUsername,
            storyOwner: username,
            surfaceContext,
        }),
    });
    if (relationshipStoryBlockReason) {
        return {
            description: '',
            visibleText: '',
            storyContentType: normalizeStoryContentType(surfaceContext?.storyContentType || 'unknown'),
            sharedFromUsername: surfaceContext?.sharedFromUsername || '',
            draftComment: '',
            draftPipeline: null,
            draftPlan: null,
            draftReview: null,
            draftRepair: null,
            initialDraftComment: '',
            draftCommentBeforeReview: '',
            safeToComment: false,
            safetyReason: relationshipStoryBlockReason,
            model: 'relationship-context',
            error: null,
            relationshipContext,
            relationshipStoryBlockReason,
        };
    }
    if (!evidenceImages?.length && !evidenceVideo?.clean) {
        return {
            description: '',
            visibleText: '',
            storyContentType: normalizeStoryContentType(surfaceContext?.storyContentType || 'unknown'),
            sharedFromUsername: surfaceContext?.sharedFromUsername || '',
            draftComment: normalizedSupplied,
            draftPipeline: null,
            draftPlan: null,
            draftReview: null,
            draftRepair: null,
            initialDraftComment: normalizedSupplied,
            draftCommentBeforeReview: normalizedSupplied,
            safeToComment: Boolean(normalizedSupplied),
            safetyReason: normalizedSupplied ? '' : 'no_story_evidence_supplied',
            model: 'none',
            error: 'no_story_evidence_supplied',
            relationshipContext,
            relationshipStoryBlockReason,
        };
    }

    const stillsOnlyVideoSalvage = isStillsOnlyVideoSalvage(surfaceContext, evidenceVideo);
    const frameNote = evidenceVideo?.clean
        ? 'The evidence includes the short story video plus screenshot/frame stills when available. Use the video for action and sequence context.'
        : (stillsOnlyVideoSalvage
            ? 'The full video could not be analyzed, so the evidence is screenshot/sample-frame stills only. Do not guess action or sequence. Only comment if a concrete harmless handle is visible in the stills, text, or song label.'
            : (evidenceImages.length > 1
            ? 'The images are ordered evidence from the same Instagram story: the first is the main screenshot, then sampled frames from the video over time.'
            : 'The image is the main Instagram story screenshot.'));
    const contextNote = surfaceContext?.storyContentType && surfaceContext.storyContentType !== 'unknown'
        ? `Browser context hint: this appears to be ${surfaceContext.storyContentType}${surfaceContext.sharedFromUsername ? ` from @${surfaceContext.sharedFromUsername}` : ''}${surfaceContext.sharedContentUrl ? ` (${surfaceContext.sharedContentUrl})` : ''}. Treat this as a hint, not certainty.`
        : 'Browser context hint: no reliable shared reel/post signal was found.';
    const transcriptNote = storyAnalysisTranscriptNote(surfaceContext);
    const songNote = surfaceContext?.storyMusicLabel
        ? `Attached song/audio label: ${surfaceContext.storyMusicLabel}. This is music metadata, not proof that the story owner said those words. Use it only as a light music handle when the visuals do not provide a stronger one.`
        : 'No attached Instagram song/audio label was detected.';

    const prompt = `Analyze this Instagram story evidence and draft one story reply for Shannon.

Return JSON only:
{
  "description": "one sentence describing the main story using only the evidence",
  "visible_text": "readable text across the story evidence, or empty",
  "story_content_type": "own_story, shared_reel, shared_post, reshared_story, tagged_story, or unknown",
  "shared_from_username": "original creator username if clear, otherwise empty",
  "safe_to_comment": true,
  "safety_reason": "",
  "comment": "one short casual opener Shannon could send"
}

Rules:
- Story owner: @${username}
- ${frameNote}
- ${contextNote}
- ${songNote}
- ${transcriptNote || 'No audio transcript was captured.'}
- If this is stills-only recovery after a video failure, safe_to_comment must be false with safety_reason="analysis_failed" unless the stills/text/song clearly support a specific harmless comment. A vague guess is worse than a heart reaction.
- Existing relationship context: ${relationshipContext || 'No existing context supplied.'}
- If existing relationship context says this person has a reply-needed warning, active DM/admin alert, or unanswered inbound DM, set safe_to_comment=false with safety_reason="pending_dm_reply". Answering their DM is the next move, not adding a fresh story opener.
- If it is a shared reel/post, tagged story, reshared story, or credited content from another account, you may comment only as a reaction to what @${username} shared. Do not write as if the person in the reel/post is @${username}.
- Good shared-content comments react to the idea, text, place, joke, news, or mood, for example "this is so true", "good to have them back", "that line is gold", "that sign is funny".
- If the main story clearly shows another creator's @handle, credit, watermark, repost source, or tag, avoid commenting even if the content is funny or relevant.
- Comment must be 3-12 words, natural, casual Australian, and specific to the visible story when possible.
- Prefer one tiny natural question when the story has an obvious harmless handle: pet name, location, food/drink, training class, hobby, event, weather, travel, or a clear object.
- Do not ask a question if the story already answers it. If a pet name is visible, react to that pet/name; if no pet name is visible, asking "what's their name?" is good.
- For animal stories with no visible pet name, prefer: Oh so cute, what's their name?
- Audio transcript is supplemental. If transcript/audio and the visible frames point to different subjects, never base the comment on transcript-only details; set safe_to_comment=false with safety_reason="audio_visual_mismatch" unless a clear visible-only comment exists.
- For odd food/drink combos, keep the specific combo. Example: coffee and wine? hows that combo go?
- If the story shows an unfamiliar event, venue, class, food, hobby, or object, ask the obvious small context question using the visible noun rather than making a flat observation.
- Do not ask about unlabeled bags, powder, pills, tablets, capsules, medication, or unknown substances. If the story includes those, set safe_to_comment=false.
- Do not use vague curiosity like "what's the story here?" and do not ask what unclear OCR/slang text means. If the only handle is unclear text, set safe_to_comment=false.
- Avoid dead-end filler like "never seen that thing", "thats random", "thats cool", "interesting", "crazy", "big vibe", or "vibes".
- Do not guess personal location or home. Avoid "is that at home?" unless the story explicitly says home.
- For brand birthday or anniversary celebration graphics, a simple milestone reaction is okay. For sales, spin-to-win, competitions, giveaways, or ads, set safe_to_comment=false.
- Normal selfies and nights out can be simple. "looking good" or "looks like a fun night" is fine when it fits.
- Keep appearance comments broad and harmless. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- For plain selfie/pose videos, do not invent an occasion. If the only real handle is the visible song or audio, a tiny music comment is okay.
- If existing relationship context says this is a client, lead, or active thread, write warmer and more familiar, but still short and grounded.
- Comment must not include the story owner's name, profile name, username, @handle, or a direct address like "Alice,".
- Normal selfies and nights out can be simple. "looking good" or "looks like a fun night" is fine when it fits.
- Keep appearance comments broad and harmless. Do not be flirty, sexual, body-specific, weight/physique-focused, or weirdly intense.
- For gym stories, do not ask how a body part feels or imply injury/pain. Comment on the exercise setup, class, object, or effort instead.
- Do not guess that something is a product, brand deal, collab, or sponsor unless packaging/signage makes that explicit.
- Do not make teasing or critical jokes about grooming, weight, size, or appearance. Pet comments should feel warm and easy.
- Do not pitch Balance, the app, coaching, a program, a meal plan, a link, or the challenge. The challenge bridge belongs later in DMs, only for unlinked leads after direct start/help intent or roughly 3-6 meaningful lead replies with real relationship and goal/blocker context.
- For animal-cruelty, factory-farming, animal-welfare, or vegan-advocacy stories, a supportive check-in to the story owner is allowed when it is not graphic gore and the concern is clear. Prefer exactly: "i can't believe this happens, so sad. you okay?"
- Do not mention anything you cannot see.
- Set safe_to_comment=false and comment="" for shared content if the only possible reply would treat the reel/post subject as the story owner, or for anything heavy, sensitive, or inappropriate: war, politics, weapons, violence, death, grief, sadness, low mood, mental health, race/slur/discrimination topics, unclear/blurry content, disasters, medical emergencies, self-harm, sexual/nude content, hate/harassment, vulnerable minors, drugs, legal trouble, or anything where a casual opener could look insensitive. The animal-welfare support exception above is the only exception.
- Ignore Instagram UI, other side stories, usernames in the tray, and browser chrome.
- No markdown.`;

    const parts = [{ text: prompt }];
    if (transcriptNote) {
        parts.push({ text: transcriptNote });
    }
    if (surfaceContext?.storyMusicLabel) {
        parts.push({ text: songNote });
    }
    if (evidenceVideo?.clean) {
        parts.push({ text: `Evidence video: full visible story video (${evidenceVideo.bytes || 'unknown'} bytes).` });
        parts.push({ inlineData: { mimeType: evidenceVideo.mimeType, data: evidenceVideo.clean } });
    }
    evidenceImages.forEach((image, index) => {
        parts.push({ text: `Evidence ${index + 1}: ${image.label}.` });
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.clean } });
    });

    const contents = [{
        role: 'user',
        parts,
    }];
    const generationConfig = { maxOutputTokens: 500, temperature: 0.35 };

    let raw = '';
    let model = 'vertex-gemini';
    try {
        raw = await callVertexGeminiMultimodal(contents, generationConfig);
    } catch (err) {
        try {
            raw = await callGeminiFallback(contents, generationConfig);
            model = 'gemini';
        } catch (err2) {
            return {
                description: '',
                visibleText: '',
                storyContentType: normalizeStoryContentType(surfaceContext?.storyContentType || 'unknown'),
                sharedFromUsername: surfaceContext?.sharedFromUsername || '',
                draftComment: normalizedSupplied,
                draftPipeline: null,
                draftPlan: null,
                draftReview: null,
                draftRepair: null,
                initialDraftComment: normalizedSupplied,
                draftCommentBeforeReview: normalizedSupplied,
                safeToComment: Boolean(normalizedSupplied),
                safetyReason: normalizedSupplied ? '' : 'analysis_failed',
                model: 'none',
                error: `${err.message || err} | ${err2.message || err2}`.slice(0, 500),
                relationshipContext,
                relationshipStoryBlockReason,
            };
        }
    }

    const parsed = parseJsonMaybe(raw) || {};
    const description = cleanText(parsed.description || '', 900);
    const visibleText = cleanText(parsed.visible_text || '', 900);
    const inferredSourceHandle = detectForeignSourceHandle({
        description,
        visibleText,
        raw: parsed,
        storyOwner: username,
        sharedFromUsername: surfaceContext?.sharedFromUsername || '',
        surfaceContext,
    });
    const sharedFromUsername = cleanIgUsername(parsed.shared_from_username || surfaceContext?.sharedFromUsername || inferredSourceHandle || '');
    if (forceSuppliedComment && normalizedSupplied) {
        return {
            description,
            visibleText,
            storyContentType: normalizeStoryContentType(parsed.story_content_type || surfaceContext?.storyContentType || 'unknown'),
            sharedFromUsername,
            draftComment: normalizedSupplied,
            draftPipeline: null,
            draftPlan: null,
            draftReview: null,
            draftRepair: null,
            initialDraftComment: normalizedSupplied,
            draftCommentBeforeReview: normalizedSupplied,
            safeToComment: true,
            safetyReason: '',
            model: `${model}+supplied-comment`,
            error: null,
            relationshipContext,
            relationshipStoryBlockReason,
        };
    }
    const modelSafety = parsed.safe_to_comment === false
        ? { safeToComment: false, reason: cleanText(parsed.safety_reason || 'model_marked_unsafe', 120) || 'model_marked_unsafe' }
        : { safeToComment: true, reason: '' };
    const deterministicSafety = assessStoryCommentSafety({
        description,
        visibleText,
        comment: parsed.comment,
        raw: parsed,
        storyOwner: username,
        sharedFromUsername,
        surfaceContext,
    });
    let safeToComment = modelSafety.safeToComment && deterministicSafety.safeToComment;
    let safetyReason = modelSafety.safeToComment ? deterministicSafety.reason : modelSafety.reason;
    const storyContentType = normalizeStoryContentType(parsed.story_content_type || surfaceContext?.storyContentType || 'unknown');
    const sharedContent = isSharedStoryContext({ storyContentType, sharedFromUsername, storyOwner: username, surfaceContext });
    const storyTextForRewrite = `${description} ${visibleText}`;
    let parsedComment = parsed.comment || normalizedSupplied || '';
    const animalWelfareText = `${description} ${visibleText} ${surfaceContext?.audioTranscript || ''} ${parsed.safety_reason || ''} ${parsed.comment || ''}`;
    const animalWelfareSupport = isAnimalWelfareAdvocacyContext(animalWelfareText) && !hasGraphicAnimalWelfareContext(animalWelfareText);
    if (animalWelfareSupport) {
        safeToComment = true;
        safetyReason = '';
        parsedComment = ANIMAL_WELFARE_SUPPORT_COMMENT;
    }
    const videoSalvageSafety = assessStillsOnlyVideoSalvageContext({
        description,
        visibleText,
        comment: parsedComment,
        storyContentType,
        sharedFromUsername,
        surfaceContext,
    });
    if (safeToComment && !videoSalvageSafety.safeToComment) {
        safeToComment = false;
        safetyReason = videoSalvageSafety.reason || 'analysis_failed';
        parsedComment = '';
    }
    if (/^love this!?$/i.test(cleanText(parsedComment, 40))) {
        if (/\bporto\b/i.test(storyTextForRewrite)) {
            parsedComment = 'Porto looks beautiful';
        } else if (/\b(scenic|cityscape|skyline|city|river|view|sunset|beach|mountain|lookout)\b/i.test(storyTextForRewrite)) {
            parsedComment = 'what a view';
        }
    }
    const novelGuess = cleanText(parsedComment, 120).match(/\bis that a new ([A-Z][a-zA-Z]{3,}) novel\??/);
    if (novelGuess && !new RegExp(`\\b${novelGuess[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(storyTextForRewrite)) {
        parsedComment = 'Enjoying the read?';
    }
    if (/\bdoggo\b/i.test(parsedComment) && /\b(dog|puppy)\b/i.test(storyTextForRewrite) && !/\b(named|called)\b/i.test(storyTextForRewrite)) {
        parsedComment = PET_NAME_COMMENT;
    }
    const initialDraftComment = safeToComment
        ? normalizeDraftComment(parsedComment, {
            storyOwner: username,
            sharedFromUsername,
            sharedContent,
        })
        : '';
    let finalDraftComment = initialDraftComment;
    let draftPlan = null;
    let draftReview = null;
    let draftRepair = null;
    let draftCommentBeforeReview = finalDraftComment;

    if (safeToComment && !finalDraftComment) {
        safeToComment = false;
        safetyReason = 'empty_or_unsafe_comment';
    }

    if (safeToComment && STORY_COMMENT_DEEP_PIPELINE_ENABLED) {
        const pipeline = await runStoryCommentPlanReviewRepair({
            username,
            description,
            visibleText,
            storyContentType,
            sharedFromUsername,
            surfaceContext,
            initialComment: finalDraftComment,
            relationshipContext,
        });
        draftPlan = pipeline.draftPlan || null;
        draftReview = pipeline.draftReview || null;
        draftRepair = pipeline.draftRepair || null;
        draftCommentBeforeReview = pipeline.draftCommentBeforeReview || finalDraftComment;
        const normalizedPipelineComment = normalizeDraftComment(pipeline.finalComment || finalDraftComment, {
            storyOwner: username,
            sharedFromUsername,
            sharedContent,
        });
        if (normalizedPipelineComment) {
            finalDraftComment = normalizedPipelineComment;
        } else {
            finalDraftComment = '';
            safeToComment = false;
            safetyReason = 'empty_or_unsafe_comment';
        }
        if (draftReview?.safe_to_comment === false || draftReview?.verdict === 'block') {
            safeToComment = false;
            safetyReason = draftReview.safety_reason || draftReview.summary || 'story_comment_review_blocked';
            finalDraftComment = '';
        }
    }

    if (safeToComment && !finalDraftComment) {
        safeToComment = false;
        safetyReason = 'empty_or_unsafe_comment';
    }

    return {
        description,
        visibleText,
        storyContentType,
        sharedFromUsername,
        draftComment: safeToComment ? finalDraftComment : '',
        draftPipeline: safeToComment || draftReview
            ? (STORY_COMMENT_DEEP_PIPELINE_ENABLED ? STORY_COMMENT_PIPELINE_VERSION : STORY_COMMENT_FAST_PIPELINE_VERSION)
            : null,
        draftPlan,
        draftReview,
        draftRepair,
        initialDraftComment,
        draftCommentBeforeReview,
        safeToComment,
        safetyReason,
        model,
        error: null,
        relationshipContext,
        relationshipStoryBlockReason,
    };
}

async function loadAlertByKey(idempotencyKey) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,status,data,suggested_message&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    );
    return rows[0] || null;
}

async function loadLatestOpenOutreachByUsername(username) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,status,suggested_message,data,created_at&alert_type=eq.general_idea&status=eq.pending&data->>subtype=eq.ig_story_outreach_candidate&data->>ig_username=eq.${encodeURIComponent(username)}&order=created_at.desc&limit=1`
    );
    return rows[0] || null;
}

async function upsertCandidateAlert({ existingAlert, coachId, thread, username, storyUrl, storyId, analysis, body, imageHash, evidenceHash, evidenceImages, evidenceVideo, surfaceContext, nowIso, idempotencyKey }) {
    const sent = body.send_status === 'sent' || body.sent === true;
    const existingData = existingAlert?.data || {};
    const storyDescription = analysis.description || existingData.story_description || null;
    const storyVisibleText = analysis.visibleText || existingData.story_visible_text || null;
    const storyContentType = analysis.storyContentType || existingData.story_content_type || surfaceContext.storyContentType;
    const sharedFromUsername = analysis.sharedFromUsername || existingData.shared_from_username || surfaceContext.sharedFromUsername || null;
    const evidenceMode = cleanText(body.evidence_mode || body.evidenceMode || '', 80)
        || (evidenceVideo?.clean
            ? (evidenceImages.length ? 'video_plus_sampled_frames' : 'video')
            : (evidenceImages.length > 1 ? 'sampled_video_frames' : 'screenshot'));
    const data = {
        ...existingData,
        subtype: 'ig_story_outreach_candidate',
        channel: 'instagram',
        ig_thread_id: thread?.id || null,
        ig_username: username,
        story_url: storyUrl,
        story_id: storyId,
        story_description: storyDescription,
        story_visible_text: storyVisibleText,
        draft_comment: analysis.draftComment,
        draft_pipeline: analysis.draftPipeline || null,
        draft_plan: analysis.draftPlan || null,
        draft_review: analysis.draftReview || null,
        draft_repair: analysis.draftRepair || null,
        initial_draft_comment: analysis.initialDraftComment || null,
        draft_comment_before_review: analysis.draftCommentBeforeReview || null,
        analysis_model: analysis.model || existingData.analysis_model || null,
        analysis_error: analysis.error || existingData.analysis_error || null,
        story_safe_to_comment: analysis.safeToComment !== false,
        story_safety_reason: analysis.safetyReason || null,
        screenshot_hash: imageHash || null,
        evidence_hash: evidenceHash || imageHash || null,
        screenshot_path: cleanText(body.screenshot_path || '', 500) || null,
        frame_screenshot_paths: evidenceImages
            .filter(image => image.label !== 'primary screenshot' && image.screenshotPath)
            .map(image => image.screenshotPath)
            .slice(0, 4),
        video_detected: body.video_detected === true || body.videoDetected === true,
        video_info: body.video_info || body.videoInfo || null,
        video_path: cleanText(body.video_path || body.videoPath || '', 500) || null,
        video_evidence_status: cleanText(body.video_evidence_status || body.videoEvidenceStatus || '', 80) || (evidenceVideo?.clean ? 'included' : null),
        video_retry_reason: cleanText(body.video_retry_reason || body.videoRetryReason || '', 120) || null,
        video_evidence_bytes: evidenceVideo?.bytes || Number(body.video_evidence_bytes || body.videoEvidenceBytes || 0) || null,
        evidence_video_included: Boolean(evidenceVideo?.clean),
        evidence_mode: evidenceMode,
        evidence_image_count: evidenceImages.length,
        story_content_type: storyContentType,
        story_content_confidence: surfaceContext.confidence,
        shared_content_url: surfaceContext.sharedContentUrl || null,
        shared_from_username: sharedFromUsername,
        story_music_detected: surfaceContext.storyMusicDetected || false,
        story_music_label: surfaceContext.storyMusicLabel || null,
        story_music_artist: surfaceContext.storyMusicArtist || null,
        story_music_title: surfaceContext.storyMusicTitle || null,
        story_surface_context: surfaceContext.raw || null,
        relationship_context: analysis.relationshipContext || existingData.relationship_context || null,
        relationship_story_block_reason: analysis.relationshipStoryBlockReason || null,
        source: cleanText(body.source || 'selenium_story_bot', 120),
        bot_account: cleanText(body.bot_account || '', 80) || null,
        identity_verified: body.identity_verified !== false,
        reply_box_ready: body.reply_box_ready !== false,
        send_status: sent ? 'sent' : 'draft_only',
        captured_at: cleanText(body.created_at || '', 80) || nowIso,
        updated_at: nowIso,
    };

    const rowPatch = {
        coach_id: coachId || null,
        client_id: null,
        client_name: username,
        alert_type: 'general_idea',
        priority: sent ? 'low' : 'medium',
        title: `IG story outreach draft: @${username}`,
        description: storyDescription || `Native story outreach candidate for @${username}.`,
        suggested_message: analysis.draftComment,
        status: sent ? 'sent' : 'pending',
        actioned_at: sent ? nowIso : null,
        data,
    };

    if (existingAlert?.id) {
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(existingAlert.id)}`, {
            method: 'PATCH',
            body: rowPatch,
            prefer: 'return=minimal',
        });
        return existingAlert.id;
    }

    const inserted = await supabaseQuery('coach_alerts', {
        method: 'POST',
        body: [{ ...rowPatch, idempotency_key: idempotencyKey }],
    });
    return inserted[0]?.id || null;
}

async function ensureSentHistory({ alertId, threadId, draftComment, nowIso }) {
    if (!alertId || !threadId || !draftComment) return null;
    const existing = await supabaseQuery(
        `ig_messages?select=id&alert_id=eq.${encodeURIComponent(alertId)}&direction=eq.out&source=eq.native_story_comment&limit=1`
    );
    if (existing[0]?.id) return existing[0].id;
    const inserted = await supabaseQuery('ig_messages', {
        method: 'POST',
        body: [{
            thread_id: threadId,
            direction: 'out',
            text: draftComment,
            source: 'native_story_comment',
            alert_id: alertId,
        }],
    });
    await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(threadId)}`, {
        method: 'PATCH',
        body: { last_outbound_at: nowIso },
        prefer: 'return=minimal',
    });
    return inserted[0]?.id || null;
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!isAuthorized(event)) return json(SHARED_SECRET ? 403 : 500, { error: SHARED_SECRET ? 'Unauthorized' : 'Bridge secret not configured' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const parsedUrl = parseStoryUrl(body.story_url || body.storyUrl);
    const username = cleanIgUsername(body.ig_username || body.username || parsedUrl.username);
    const urlUsername = parsedUrl.username;
    const storyId = cleanText(body.story_id || body.storyId || parsedUrl.storyId, 80).replace(/[^a-zA-Z0-9_-]/g, '');

    if (!username) return json(400, { error: 'Missing or invalid ig_username' });
    if (OWN_HANDLES.has(username.toLowerCase())) return json(400, { error: 'Refusing to create outreach for own account' });
    if (!parsedUrl.cleanUrl || !urlUsername || !storyId) return json(400, { error: 'Missing or invalid story_url/story_id' });
    if (urlUsername.toLowerCase() !== username.toLowerCase()) {
        return json(400, { error: 'story_url username does not match ig_username', url_username: urlUsername, ig_username: username });
    }
    if (body.identity_verified === false) return json(400, { error: 'identity_not_verified' });

    let evidenceImages = [];
    let evidenceVideo = null;
    try {
        evidenceImages = validateEvidenceImages(body);
        evidenceVideo = validateEvidenceVideo(body);
    } catch (err) {
        return json(400, { error: err.message || 'invalid_evidence' });
    }

    const nowIso = new Date().toISOString();
    const idempotencyKey = `ig_story_outreach:${username.toLowerCase()}:${storyId}`;
    const dryRun = body.dry_run === true || body.dryRun === true;
    const dryRunQualityJudge = isDryRunQualityJudge(body, dryRun);
    const imageHash = evidenceImages[0]?.clean ? hash(evidenceImages[0].clean) : null;
    const evidenceHash = evidenceImages.length
        ? hash([
            ...evidenceImages.map(image => hash(image.clean)),
            evidenceVideo?.clean ? hash(evidenceVideo.clean) : '',
        ].filter(Boolean).join('|'))
        : (evidenceVideo?.clean ? hash(evidenceVideo.clean) : null);
    const surfaceContext = normalizeStorySurfaceContext(body);
    const relationship = await loadRelationshipContextForHandle(username);
    const existingThread = relationship.thread;
    const relationshipContext = relationship.context;
    const relationshipStoryBlockReason = relationship.storyBlockReason || '';
    const relationshipStoryCooldown = relationship.storyCooldown || null;
    const analysisRelationshipContext = dryRunQualityJudge ? '' : relationshipContext;
    const analysisRelationshipStoryBlockReason = dryRunQualityJudge ? '' : relationshipStoryBlockReason;

    const analysis = await analyzeStoryEvidence({
        username,
        evidenceImages,
        evidenceVideo,
        suppliedComment: body.draft_comment || body.comment,
        surfaceContext,
        relationshipContext: analysisRelationshipContext,
        relationshipStoryBlockReason: analysisRelationshipStoryBlockReason,
        forceSuppliedComment: body.lock_supplied_comment === true || body.lockSuppliedComment === true || body.send_status === 'sent' || body.sent === true,
    });
    const sentRequest = body.send_status === 'sent' || body.sent === true;
    if (!sentRequest && relationshipStoryBlockReason && !dryRunQualityJudge) {
        analysis.safeToComment = false;
        analysis.safetyReason = relationshipStoryBlockReason;
        analysis.relationshipStoryBlockReason = relationshipStoryBlockReason;
    }

    if (!sentRequest && analysis.safeToComment === false) {
        return json(409, {
            error: 'unsafe_story_context',
            safety_reason: analysis.safetyReason || 'unsafe_story_context',
            idempotency_key: idempotencyKey,
            ig_username: username,
            story_id: storyId,
            story_url: parsedUrl.cleanUrl,
            story_description: analysis.description,
            story_visible_text: analysis.visibleText,
            story_content_type: analysis.storyContentType || surfaceContext.storyContentType,
            shared_from_username: analysis.sharedFromUsername || surfaceContext.sharedFromUsername || null,
            story_music_detected: surfaceContext.storyMusicDetected || false,
            story_music_label: surfaceContext.storyMusicLabel || null,
            relationship_context: relationshipContext,
            relationship_story_block_reason: analysis.relationshipStoryBlockReason || relationshipStoryBlockReason || null,
            story_outreach_cooldown: relationshipStoryCooldown,
            like_fallback_recommended: shouldRecommendLikeFallback(analysis, relationshipStoryBlockReason),
            analysis_model: analysis.model,
            draft_pipeline: analysis.draftPipeline || null,
            draft_plan: analysis.draftPlan || null,
            draft_review: analysis.draftReview || null,
            draft_repair: analysis.draftRepair || null,
        });
    }

    if (dryRun) {
        return json(200, {
            ok: true,
            dry_run: true,
            idempotency_key: idempotencyKey,
            ig_username: username,
            story_id: storyId,
            story_url: parsedUrl.cleanUrl,
            draft_comment: analysis.draftComment,
            story_description: analysis.description,
            story_visible_text: analysis.visibleText,
            story_content_type: analysis.storyContentType || surfaceContext.storyContentType,
            story_content_confidence: surfaceContext.confidence,
            shared_content_url: surfaceContext.sharedContentUrl || null,
            shared_from_username: analysis.sharedFromUsername || surfaceContext.sharedFromUsername || null,
            story_music_detected: surfaceContext.storyMusicDetected || false,
            story_music_label: surfaceContext.storyMusicLabel || null,
            story_music_artist: surfaceContext.storyMusicArtist || null,
            story_music_title: surfaceContext.storyMusicTitle || null,
            story_safe_to_comment: analysis.safeToComment !== false,
            story_safety_reason: analysis.safetyReason || null,
            analysis_model: analysis.model,
            analysis_error: analysis.error,
            relationship_context: relationshipContext,
            relationship_story_block_reason: analysis.relationshipStoryBlockReason || relationshipStoryBlockReason || null,
            quality_judge_relationship_block_ignored: dryRunQualityJudge && !!relationshipStoryBlockReason,
            story_outreach_cooldown: relationshipStoryCooldown,
            like_fallback_recommended: shouldRecommendLikeFallback(analysis, relationshipStoryBlockReason),
            draft_pipeline: analysis.draftPipeline || null,
            draft_plan: analysis.draftPlan || null,
            draft_review: analysis.draftReview || null,
            draft_repair: analysis.draftRepair || null,
            initial_draft_comment: analysis.initialDraftComment || null,
            draft_comment_before_review: analysis.draftCommentBeforeReview || null,
            screenshot_hash: imageHash,
            evidence_hash: evidenceHash,
            evidence_image_count: evidenceImages.length,
            evidence_video_included: Boolean(evidenceVideo?.clean),
            evidence_video_bytes: evidenceVideo?.bytes || null,
        });
    }

    const suppliedComment = normalizeDraftComment(body.draft_comment || body.comment, {
        storyOwner: username,
        sharedFromUsername: analysis.sharedFromUsername || surfaceContext.sharedFromUsername || '',
        sharedContent: isSharedStoryContext({
            storyContentType: analysis.storyContentType || surfaceContext.storyContentType,
            sharedFromUsername: analysis.sharedFromUsername || surfaceContext.sharedFromUsername || '',
            storyOwner: username,
            surfaceContext,
        }),
    });
    if (analysis.error && !suppliedComment) {
        return json(502, {
            error: 'story_analysis_unavailable',
            detail: analysis.error,
            idempotency_key: idempotencyKey,
            ig_username: username,
            story_id: storyId,
            story_url: parsedUrl.cleanUrl,
            evidence_hash: evidenceHash,
            evidence_image_count: evidenceImages.length,
            evidence_video_included: Boolean(evidenceVideo?.clean),
            evidence_video_bytes: evidenceVideo?.bytes || null,
        });
    }

    const coachId = await findDefaultCoachId();
    const existingAlert = await loadAlertByKey(idempotencyKey);
    if (existingAlert?.status === 'sent' && !sentRequest) {
        return json(409, {
            error: 'already_sent',
            alert_id: existingAlert.id,
            idempotency_key: idempotencyKey,
            ig_username: username,
            story_id: storyId,
            story_url: parsedUrl.cleanUrl,
            draft_comment: existingAlert.suggested_message || analysis.draftComment,
            status: 'sent',
        });
    }
    if (!sentRequest) {
        const existingOpenForUser = await loadLatestOpenOutreachByUsername(username);
        if (existingOpenForUser?.id && existingOpenForUser.id !== existingAlert?.id) {
            return json(409, {
                error: 'already_has_outreach_for_user',
                alert_id: existingOpenForUser.id,
                ig_username: username,
                existing_story_id: existingOpenForUser.data?.story_id || null,
                existing_story_url: existingOpenForUser.data?.story_url || null,
                existing_comment: existingOpenForUser.suggested_message || existingOpenForUser.data?.draft_comment || '',
                status: existingOpenForUser.status || null,
            });
        }
    }
    const thread = await ensureOutreachThread({
        username,
        coachId,
        storyUrl: parsedUrl.cleanUrl,
        storyId,
        draftComment: analysis.draftComment,
        analysis,
        surfaceContext,
        body,
        nowIso,
        existingThread,
    });
    const alertId = await upsertCandidateAlert({
        existingAlert,
        coachId,
        thread,
        username,
        storyUrl: parsedUrl.cleanUrl,
        storyId,
        analysis,
        body,
        imageHash,
        evidenceHash,
        evidenceImages,
        evidenceVideo,
        surfaceContext,
        nowIso,
        idempotencyKey,
    });
    let igMessageId = null;
    if (sentRequest) {
        igMessageId = await ensureSentHistory({
            alertId,
            threadId: thread?.id,
            draftComment: analysis.draftComment,
            nowIso,
        });
    }

    return json(200, {
        ok: true,
        alert_id: alertId,
        ig_thread_id: thread?.id || null,
        ig_message_id: igMessageId,
        idempotency_key: idempotencyKey,
        ig_username: username,
        story_id: storyId,
        story_url: parsedUrl.cleanUrl,
        draft_comment: analysis.draftComment,
        story_description: analysis.description,
        story_visible_text: analysis.visibleText,
        story_content_type: analysis.storyContentType || surfaceContext.storyContentType,
        story_content_confidence: surfaceContext.confidence,
        shared_content_url: surfaceContext.sharedContentUrl || null,
        shared_from_username: analysis.sharedFromUsername || surfaceContext.sharedFromUsername || null,
        story_music_detected: surfaceContext.storyMusicDetected || false,
        story_music_label: surfaceContext.storyMusicLabel || null,
        story_music_artist: surfaceContext.storyMusicArtist || null,
        story_music_title: surfaceContext.storyMusicTitle || null,
        story_safe_to_comment: analysis.safeToComment !== false,
        story_safety_reason: analysis.safetyReason || null,
        analysis_model: analysis.model,
        analysis_error: analysis.error,
        relationship_context: relationshipContext,
        relationship_story_block_reason: analysis.relationshipStoryBlockReason || relationshipStoryBlockReason || null,
        story_outreach_cooldown: relationshipStoryCooldown,
        like_fallback_recommended: shouldRecommendLikeFallback(analysis, relationshipStoryBlockReason),
        draft_pipeline: analysis.draftPipeline || null,
        draft_plan: analysis.draftPlan || null,
        draft_review: analysis.draftReview || null,
        draft_repair: analysis.draftRepair || null,
        initial_draft_comment: analysis.initialDraftComment || null,
        draft_comment_before_review: analysis.draftCommentBeforeReview || null,
        evidence_hash: evidenceHash,
        evidence_image_count: evidenceImages.length,
        evidence_video_included: Boolean(evidenceVideo?.clean),
        evidence_video_bytes: evidenceVideo?.bytes || null,
        status: sentRequest ? 'sent' : 'pending',
    });
};

exports._test = {
    cleanIgUsername,
    parseStoryUrl,
    normalizeDraftComment,
    mentionsHandleToken,
    assessStoryCommentSafety,
    assessAudioVisualCommentConsistency,
    assessStillsOnlyVideoSalvageContext,
    parseJsonMaybe,
    validateEvidenceImages,
    validateEvidenceVideo,
    normalizeStorySurfaceContext,
    buildExistingRelationshipContext,
    relationshipStoryBlockReason,
    hasRecentUnansweredInbound,
    storyNoReplyCooldown,
    storyRecentOutreachCooldown,
    storyOutreachMemoryWasSent,
    isDryRunQualityJudge,
    shouldRecommendLikeFallback,
    storyAnalysisTranscriptNote,
    normalizeStoryCommentPlanPayload,
    normalizeStoryCommentReviewPayload,
};
