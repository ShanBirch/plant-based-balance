import { getLearnCoursePricing } from './lib/learn-course-pricing.js';
async function updateLearnPrice() {
    let amount = getLearnCoursePricing().unitAmount;
    try {
        const response = await fetch('/.netlify/functions/get-checkout-offer?priceId=balance_vegan_founders_pass', { cache: 'no-store' });
        if (response.ok) {
            const { offer } = await response.json();
            if ([15000, 45000].includes(offer?.unitAmount)) amount = offer.unitAmount;
        }
    } catch (_) { /* The dated published pricing remains available offline. */ }
    document.querySelectorAll('[data-learn-upfront]').forEach(el => { el.textContent = '$' + amount / 100; });
    document.querySelectorAll('.learn-intro-price').forEach(el => {
        el.innerHTML = amount === 15000
            ? '<strong>Introductory package: AUD $150 for six weeks</strong><span>AUD $450 from 9 October 2026</span><span class="intro-saving">Launch price available through 8 October 2026, Brisbane time. Includes Balance Learn, weekly check-ins, plan review and six weeks of app access.</span>'
            : '<strong>Complete six-week package: AUD $450</strong><span class="intro-saving">Includes Balance Learn, weekly check-ins, plan review and six weeks of app access. One payment, no automatic renewal.</span>';
    });
}
updateLearnPrice();
window.addEventListener('pageshow', updateLearnPrice);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateLearnPrice(); });
