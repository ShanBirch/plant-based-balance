const COACH_DM_MANAGER_TIME_ZONE = 'Australia/Brisbane';
const COACH_DM_MANAGER_START_MINUTES = 5 * 60;
const COACH_DM_MANAGER_END_MINUTES = 2 * 60;

function getBrisbaneMinuteOfDay(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: COACH_DM_MANAGER_TIME_ZONE,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(date);
    const hour = Number(parts.find(part => part.type === 'hour')?.value);
    const minute = Number(parts.find(part => part.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
}

function isMinuteInWindow(minuteOfDay, startMinutes, endMinutes) {
    if (!Number.isFinite(minuteOfDay)) return false;
    if (startMinutes === endMinutes) return true;
    if (startMinutes < endMinutes) {
        return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
    }
    return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}

function isCoachDmManagerWorkingTime(date = new Date()) {
    return isMinuteInWindow(
        getBrisbaneMinuteOfDay(date),
        COACH_DM_MANAGER_START_MINUTES,
        COACH_DM_MANAGER_END_MINUTES
    );
}

function resolveCoachDmManagerScheduledFor(now = new Date(), delayMs = 0) {
    const nowDate = now instanceof Date ? now : new Date(now);
    const normalizedDelayMs = Number.isFinite(Number(delayMs)) && Number(delayMs) > 0
        ? Math.round(Number(delayMs))
        : 0;
    const requestedFor = new Date(nowDate.getTime() + normalizedDelayMs);
    if (isCoachDmManagerWorkingTime(requestedFor)) {
        return {
            scheduledFor: requestedFor,
            requestedFor,
            deferredForWorkingHours: false,
        };
    }

    const minuteOfDay = getBrisbaneMinuteOfDay(requestedFor);
    const minutesUntilStart = minuteOfDay === null
        ? 0
        : (COACH_DM_MANAGER_START_MINUTES - minuteOfDay + (24 * 60)) % (24 * 60);
    const scheduledFor = new Date(requestedFor.getTime() + (minutesUntilStart * 60 * 1000));
    scheduledFor.setUTCSeconds(0, 0);

    return {
        scheduledFor,
        requestedFor,
        deferredForWorkingHours: true,
    };
}

function coachDmManagerWindowLabel() {
    return '05:00-02:00 Australia/Brisbane';
}

module.exports = {
    COACH_DM_MANAGER_TIME_ZONE,
    COACH_DM_MANAGER_START_MINUTES,
    COACH_DM_MANAGER_END_MINUTES,
    getBrisbaneMinuteOfDay,
    isMinuteInWindow,
    isCoachDmManagerWorkingTime,
    resolveCoachDmManagerScheduledFor,
    coachDmManagerWindowLabel,
};
