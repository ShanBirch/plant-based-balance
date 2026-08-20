const ALLY_WEIGHT_LOSS_PROOF_URL = 'https://plantbased-balance.org/photos/client-success/ally-cocos.png';
const GEN_STRENGTH_CONFIDENCE_PROOF_URL = 'https://plantbased-balance.org/photos/client-success/gen-cocos.jpg';
const BEC_KIRSTY_SHARED_MOMENTUM_PROOF_URL = 'https://plantbased-balance.org/photos/client-success/bec-kirsty-cocos.png';
const DANI_RECOMPOSITION_PROOF_URL = 'https://plantbased-balance.org/photos/client-success/dani-front-mirror-8-weeks.png';
const BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL = 'https://plantbased-balance.org/assets/balance-foundations-app-proof-v5.mp4';
const BALANCE_APP_VIDEO_INTRO_RE = /\b(?:quick\s+(?:look|video)|app\s+(?:video|walkthrough)|video\s+(?:of|showing|through)\s+(?:the\s+)?app|look\s+(?:at|inside)\s+(?:the\s+)?app|show(?:ing)?\s+you\s+(?:around|how)\s+(?:the\s+)?app|(?:sent|sending)\s+(?:the\s+)?(?:video|vid)(?:\s+again)?|here\s+it\s+is(?:\s+again)?|here(?:'s|\s+is)\s+(?:the\s+)?(?:video|vid|it)\s+again)\b/i;

const ALLY_INTRO_RE = /\b(?:this is ally|here(?:'s| is) ally|ally(?:,|\s+(?:is|was|lost|has))|one of my clients)\b/i;
const GEN_INTRO_RE = /\b(?:this is gen|here(?:'s| is) gen|gen(?:,|\s+(?:is|was|got|built|became))|one of my clients)\b/i;
const BEC_KIRSTY_INTRO_RE = /\b(?:this is bec and kirsty|these are bec and kirsty|here(?:'s| are) bec and kirsty|bec and kirsty|two of my clients)\b/i;
const DANI_INTRO_RE = /\b(?:this is dani|here(?:'s| is) dani|dani(?:,|\s+(?:is|was|worked|changed))|one of my clients)\b/i;

const PAID_META_TRANSFORMATION_PROOFS = Object.freeze([
    {
        id: 'dani_recomposition',
        imageUrl: DANI_RECOMPOSITION_PROOF_URL,
        introductionRe: DANI_INTRO_RE,
        matches: text => /\b(?:recomp\w*|body composition|tone|toned|definition|shape)\b/i.test(text)
            && !/\b(?:injur\w*|pain|rehab|recover\w*)\b/i.test(text),
        buildIntroduction: () => `This is Dani. Her goal was body recomposition rather than just chasing the scale, and the visible change came from repeatable training and nutrition structure over eight weeks.`,
    },
    {
        id: 'gen_strength_confidence',
        imageUrl: GEN_STRENGTH_CONFIDENCE_PROOF_URL,
        introductionRe: GEN_INTRO_RE,
        matches: text => /\b(?:strong\w*|strength|muscle|fitter|fitness|confidence|confident)\b/i.test(text)
            && !/\b(?:lose|weight|fat|kg|kgs|kilogram|lb|lbs|pound|recomp|tone)\b/i.test(text)
            && !/\b(?:together|partner|friend|community|shared|buddy)\b/i.test(text),
        buildIntroduction: () => `This is Gen. She wanted to feel stronger, fitter and more confident, and built that through progressive training and a plan simple enough to keep repeating.`,
    },
    {
        id: 'bec_kirsty_shared_momentum',
        imageUrl: BEC_KIRSTY_SHARED_MOMENTUM_PROOF_URL,
        introductionRe: BEC_KIRSTY_INTRO_RE,
        matches: text => /\b(?:together|partner|friend|community|support each other|shared|buddy)\b/i.test(text)
            && /\b(?:lose|weight|strong\w*|fit\w*|train\w*|accountab\w*|consisten\w*)\b/i.test(text),
        buildIntroduction: () => `These are Bec and Kirsty. They both lost over 10kg and got stronger, with shared support making the plan easier to stick to.`,
    },
    {
        id: 'ally_busy_weight_loss',
        imageUrl: ALLY_WEIGHT_LOSS_PROOF_URL,
        introductionRe: ALLY_INTRO_RE,
        matches: text => /\b(?:lose|losing|weight|fat|lean|kg|kgs|kilogram|lb|lbs|pound)\b/i.test(text),
        buildIntroduction: text => {
            const kgGoal = String(text || '').match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b/i)?.[1] || '';
            const goalLead = kgGoal ? `${kgGoal}kg is a solid goal. ` : '';
            return `${goalLead}This is Ally. She lost 12kg in 16 weeks while working full time and raising a family, by building the plan around her real week.`;
        },
    },
]);

function resolvePaidMetaTransformationProof({ goalText = '', blockerText = '' } = {}) {
    const text = `${String(goalText || '')} ${String(blockerText || '')}`.replace(/\s+/g, ' ').trim();
    if (!text || /\b(?:pregnan\w*|postpartum|after (?:having )?(?:a )?baby|eating disorder|anorex\w*|bulimi\w*|self[- ]harm|suicid\w*|injur\w*|pain|rehab|recover\w*)\b/i.test(text)) {
        return null;
    }
    const proof = PAID_META_TRANSFORMATION_PROOFS.find(candidate => candidate.matches(text));
    if (!proof) return null;
    return {
        id: proof.id,
        imageUrl: proof.imageUrl,
        introduction: proof.buildIntroduction(text),
    };
}

function isAllyWeightLossProofUrl(value = '') {
    return String(value || '').trim().toLowerCase() === ALLY_WEIGHT_LOSS_PROOF_URL;
}

function hasAllyProofIntroduction(text = '') {
    return ALLY_INTRO_RE.test(String(text || ''));
}

function maySendDraftImageAttachment({ imageUrl = '', replyText = '' } = {}) {
    const normalizedUrl = String(imageUrl || '').trim().toLowerCase();
    const knownProof = PAID_META_TRANSFORMATION_PROOFS.find(proof => proof.imageUrl.toLowerCase() === normalizedUrl);
    if (!knownProof) return true;
    return knownProof.introductionRe.test(String(replyText || ''));
}

function maySendDraftVideoAttachment({ videoUrl = '', replyText = '' } = {}) {
    const normalizedUrl = String(videoUrl || '').trim().toLowerCase();
    if (normalizedUrl !== BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL.toLowerCase()) return true;
    return BALANCE_APP_VIDEO_INTRO_RE.test(String(replyText || ''));
}

function stripPaidMetaProofMediaUrls(text = '') {
    const raw = String(text || '');
    const escapedUrl = BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(escapedUrl, 'i').test(raw)) return raw;
    return raw
        .replace(new RegExp(`\\s*${escapedUrl}(?=\\s|$)`, 'gi'), '')
        .replace(/:\s*(?=(?:would|do|want|keen|are|can|should|what|how|where|when|why|who)\b)/gi, '. ')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

module.exports = {
    ALLY_WEIGHT_LOSS_PROOF_URL,
    GEN_STRENGTH_CONFIDENCE_PROOF_URL,
    BEC_KIRSTY_SHARED_MOMENTUM_PROOF_URL,
    DANI_RECOMPOSITION_PROOF_URL,
    BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
    hasAllyProofIntroduction,
    isAllyWeightLossProofUrl,
    maySendDraftImageAttachment,
    maySendDraftVideoAttachment,
    resolvePaidMetaTransformationProof,
    stripPaidMetaProofMediaUrls,
};
