export const LEARN_INTRO_END = '2026-10-09T00:00:00+10:00';
export function getLearnCoursePricing(now = new Date()) {
    const time = new Date(now).getTime();
    if (!Number.isFinite(time)) throw new TypeError('Invalid pricing date');
    const introductory = time < Date.parse(LEARN_INTRO_END);
    return Object.freeze({ unitAmount: introductory ? 15000 : 45000, introductory,
        standardUnitAmount: 45000, introductoryEndsAt: LEARN_INTRO_END });
}
