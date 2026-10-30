const IOS_STORE_URL = 'https://apps.apple.com/app/balance-fitness-gamified/id6761238161';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fitgotchi.app';
const PHONE_PLATFORM_QUESTION = 'Are you on iPhone or Android?';

function buildCoachingAppHandoff({ invitationUrl, phonePlatform = 'unknown' } = {}) {
    const invitation = new URL(invitationUrl);
    if (invitation.protocol !== 'https:' || !['plantbased-balance.org', 'balanceneurosciencefitness.com', 'www.balanceneurosciencefitness.com', 'future-balance.netlify.app'].includes(invitation.hostname)) {
        throw new Error('Use the exact verified Balance invitation');
    }
    if (!['ios', 'android'].includes(phonePlatform)) {
        throw new Error(`Confirm phone type first: ${PHONE_PLATFORM_QUESTION}`);
    }
    const links = phonePlatform === 'ios' ? `iPhone: ${IOS_STORE_URL}`
        : `Android: ${ANDROID_STORE_URL}`;
    const text = `Your program's ready. Download Balance here:\n${links}\n\nActivate your coaching with this private link, then log in to the app with the same account:\n${invitationUrl}`;
    if (text.length > 500) throw new Error('Handoff exceeds the guarded ready-message limit');
    return text;
}

module.exports = { IOS_STORE_URL, ANDROID_STORE_URL, PHONE_PLATFORM_QUESTION, buildCoachingAppHandoff };
