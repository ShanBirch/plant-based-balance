#!/usr/bin/env node

const path = require('path');
const {
  createDailyPost,
  createOneOfEach,
  formatBrisbaneDate,
  writeReviewPack,
} = require('./balance-content/core');

let runSciencePaperPipeline = null;
try {
  ({ runSciencePaperPipeline } = require('./science-paper-pipeline'));
} catch {
  runSciencePaperPipeline = null;
}

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

async function prepareScience(posts, args) {
  if (args['skip-science-pipeline']) return null;
  const sciencePost = posts.find(post => post.lane === 'science' && post.paperId);
  if (!sciencePost?.paperId) return null;
  if (!runSciencePaperPipeline) {
    return {
      paperId: sciencePost.paperId,
      status: 'science_pipeline_unavailable',
      warning: 'content-lab/src/science-paper-pipeline.js is not available in this worktree. Codex must review the science post before publishing.',
    };
  }
  if (process.env.GEMINI_API_KEY && !process.env.CONTENT_LAB_TEXT_PROVIDER) {
    process.env.CONTENT_LAB_TEXT_PROVIDER = 'gemini';
  }
  return await runSciencePaperPipeline({
    paperId: sciencePost.paperId,
    force: Boolean(args['force-science']),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateString = args.date || args.week || formatBrisbaneDate();
  const counts = countsFromArgs(args);
  let posts = args.oneOfEach
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

  const sciencePipeline = await prepareScience(posts, args);
  if (sciencePipeline) {
    posts = args.oneOfEach
      ? createOneOfEach({ dateString, counts })
      : [createDailyPost({ dateString, counts })].filter(post => !post.skipped);
    posts = posts.map(post => (
      post.lane === 'science'
        ? {
            ...post,
            source: sciencePipeline.dir
              ? `${post.source}; science pipeline: ${sciencePipeline.dir}`
              : `${post.source}; science pipeline: ${sciencePipeline.status || 'unavailable'}`,
            sciencePipeline: sciencePipeline.dir
              ? {
                  paperId: sciencePipeline.paperId,
                  dir: sciencePipeline.dir,
                  validation: sciencePipeline.validation,
                  files: sciencePipeline.files,
                }
              : sciencePipeline,
          }
        : post
    ));
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, date: dateString, sciencePipeline, posts }, null, 2));
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
    sciencePipeline,
    posts: result.manifest.posts.map(post => ({
      lane: post.lane,
      title: post.title,
      sciencePipeline: post.sciencePipeline || undefined,
      markdownPath: post.markdownPath,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
