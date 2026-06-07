#!/usr/bin/env node

const path = require('path');
const {
  createDailyPost,
  createOneOfEach,
  formatBrisbaneDate,
  writeReviewPack,
} = require('./balance-content/core');

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg === '--one-of-each') out.oneOfEach = true;
    if (arg === '--dry-run') out.dryRun = true;
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function countsFromArgs(args) {
  const counts = {};
  const map = {
    workouts: 'workout_sessions_7d',
    users: 'workout_users_7d',
    twoPlus: 'users_with_2_plus_workouts_7d',
    pbs: 'pbs_7d',
    moodLogs: 'mood_logs_7d',
    checkins: 'client_checkins_7d',
    challenge: 'active_challenge_participants',
  };
  for (const [argKey, countKey] of Object.entries(map)) {
    if (args[argKey] != null) counts[countKey] = Number(args[argKey]);
    const dashed = argKey.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
    if (args[dashed] != null) counts[countKey] = Number(args[dashed]);
  }
  return counts;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateString = args.date || args.week || formatBrisbaneDate();
  const counts = countsFromArgs(args);
  const posts = args.oneOfEach
    ? createOneOfEach({ dateString, counts })
    : [createDailyPost({ dateString, counts })].filter(post => !post.skipped);

  if (!posts.length) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      date: dateString,
      reason: 'No main post scheduled for this date.',
    }, null, 2));
    return;
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, date: dateString, posts }, null, 2));
    return;
  }

  const outputRoot = args.out
    ? path.resolve(process.cwd(), args.out)
    : undefined;
  const result = writeReviewPack({ posts, dateString, outputRoot });
  console.log(JSON.stringify({
    ok: true,
    date: dateString,
    outputRoot: result.root,
    manifestPath: result.manifestPath,
    posts: result.manifest.posts.map(post => ({
      lane: post.lane,
      title: post.title,
      markdownPath: post.markdownPath,
    })),
  }, null, 2));
}

main();
