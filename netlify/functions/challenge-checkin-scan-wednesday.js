/**
 * Wednesday-night schedule wrapper for challenge-checkin-scan.
 * Netlify supports one cron per function entry, so this file reuses the same
 * handler at a second wall-clock time.
 */

const { handler } = require('./challenge-checkin-scan');

exports.handler = handler;
