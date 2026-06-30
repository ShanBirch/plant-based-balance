/**
 * Deprecated Wednesday wrapper for challenge-checkin-scan.
 *
 * The Wednesday cadence is intentionally unscheduled and disabled in the
 * shared handler. Keep this file only so old function references fail closed
 * with the handler's skipped summary instead of recreating midweek drafts.
 */

const { handler } = require('./challenge-checkin-scan');

exports.handler = handler;
