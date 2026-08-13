const ALLY_WEIGHT_LOSS_PROOF_URL = 'https://plantbased-balance.org/photos/client-success/ally-cocos.png';

const ALLY_INTRO_RE = /\b(?:this is ally|here(?:'s| is) ally|ally(?:,|\s+(?:is|was|lost|has))|one of my clients)\b/i;

function isAllyWeightLossProofUrl(value = '') {
    return String(value || '').trim().toLowerCase() === ALLY_WEIGHT_LOSS_PROOF_URL;
}

function hasAllyProofIntroduction(text = '') {
    return ALLY_INTRO_RE.test(String(text || ''));
}

function maySendDraftImageAttachment({ imageUrl = '', replyText = '' } = {}) {
    if (!isAllyWeightLossProofUrl(imageUrl)) return true;
    return hasAllyProofIntroduction(replyText);
}

module.exports = {
    ALLY_WEIGHT_LOSS_PROOF_URL,
    hasAllyProofIntroduction,
    isAllyWeightLossProofUrl,
    maySendDraftImageAttachment,
};
