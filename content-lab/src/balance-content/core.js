const fs = require('fs');
const path = require('path');

const BRISBANE_TZ = 'Australia/Brisbane';
const DAY_LANES = {
  Monday: 'exercise',
  Tuesday: 'science',
  Wednesday: 'proof',
  Thursday: 'exercise',
  Friday: 'science',
  Saturday: 'proof',
};

const DEFAULT_EXERCISES = [
  {
    title: 'Push Up',
    videoUrl: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/pushups.mp4',
    hook: 'A better push up starts before you bend your elbows.',
    cue: 'Set your ribs and pelvis first, then move as one piece.',
    reason: 'Cleaner reps make the set harder where it should be, not in your lower back or shoulders.',
    save: 'Save it for your next upper body day.',
  },
  {
    title: 'Barbell Squat',
    videoUrl: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/barbell-squat.mp4',
    hook: 'Your squat should feel stacked, not folded.',
    cue: 'Brace first, keep pressure through the mid-foot, and let the knees track with the toes.',
    reason: 'That gives you a stronger line to drive out of the bottom.',
    save: 'Save it before your next leg session.',
  },
  {
    title: 'Lat Pulldown',
    videoUrl: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/lat-pulldown.mp4',
    hook: "Don't turn your pulldown into a shrug.",
    cue: 'Pull the shoulder blades down first, then drive the elbows toward your ribs.',
    reason: 'You will feel more lats and less neck.',
    save: 'Save it for pull day.',
  },
  {
    title: 'Dumbbell Shoulder Press',
    videoUrl: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/dumbbell-shoulder-press.mp4',
    hook: 'Press from a stable base, not a loose rib cage.',
    cue: 'Keep the ribs down, glutes on, and press slightly back over the shoulders.',
    reason: 'That keeps the work in your shoulders instead of dumping it into your lower back.',
    save: 'Save it for your next push session.',
  },
  {
    title: 'Barbell Hip Thruster',
    videoUrl: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/barbell-hip-thruster.mp4',
    hook: 'The top of the hip thrust is where most people lose it.',
    cue: 'Tuck slightly, pause at the top, and finish with glutes instead of your lower back.',
    reason: 'That makes the rep cleaner and gives you a better glute contraction.',
    save: 'Save it for glute day.',
  },
];

const DEFAULT_PROOF_COUNTS = {
  workout_sessions_7d: 23,
  workout_users_7d: 12,
  users_with_2_plus_workouts_7d: 7,
  pbs_7d: 115,
  pb_users_7d: 9,
  mood_logs_7d: 43,
  mood_users_7d: 11,
  client_checkins_7d: 37,
  active_challenge_participants: 18,
};

const SCIENCE_CATEGORY_ROTATION = [
  { id: 'plant_based_nutrition', label: 'Plant-based nutrition' },
  { id: 'nutrition_metabolism', label: 'Nutrition / metabolism' },
  { id: 'state_change_mindset', label: 'Food, exercise & mindset' },
  { id: 'mindset_motivation', label: 'Mindset / motivation' },
  { id: 'neuroscience', label: 'Neuroscience' },
  { id: 'resistance_training', label: 'Resistance training' },
  { id: 'cardio_conditioning', label: 'Cardio / conditioning' },
  { id: 'sleep_recovery', label: 'Sleep / recovery' },
  { id: 'glp1_appetite_hormones', label: 'GLP-1s / appetite hormones' },
  { id: 'mental_health_training', label: 'Mental health / training' },
];

function cleanText(value, max = 2000) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').trim().slice(0, max);
}

function cleanHook(value, fallback = '') {
  return cleanText(value || fallback, 180)
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,])/g, '$1');
}

function safeSlug(value) {
  return String(value || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

function normalizeScienceCategory(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function scienceCategoryLabel(categoryId) {
  const normalized = normalizeScienceCategory(categoryId);
  return SCIENCE_CATEGORY_ROTATION.find(category => category.id === normalized)?.label
    || normalized.split('_').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function possessiveName(value) {
  const name = cleanText(value, 120);
  if (!name) return '';
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatBrisbaneDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRISBANE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseDateOnly(dateString) {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date: ${dateString || ''}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
}

function dayNameForDate(dateString) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(parseDateOnly(dateString));
}

function displayDate(dateString) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseDateOnly(dateString));
}

function laneForDate(dateString) {
  const day = dayNameForDate(dateString);
  return DAY_LANES[day] || null;
}

function loadJsonIfExists(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function loadSciencePapers() {
  try {
    const rows = require('../../config/science-papers.json');
    if (Array.isArray(rows)) return rows;
  } catch {
    // Fall through to filesystem lookup for local scripts or unbundled runs.
  }
  const filePath = path.join(repoRoot(), 'content-lab', 'config', 'science-papers.json');
  const rows = loadJsonIfExists(filePath, []);
  return Array.isArray(rows) ? rows : [];
}

function loadScienceRenderInput(paperId) {
  const filePath = path.join(repoRoot(), 'content-lab', 'science-reels', 'papers', paperId, 'render-input.json');
  return loadJsonIfExists(filePath, null);
}

function scienceCategoryIdsForPaper(paper) {
  const values = [
    paper?.category,
    ...(Array.isArray(paper?.secondaryCategories) ? paper.secondaryCategories : []),
  ];
  return new Set(values.map(normalizeScienceCategory).filter(Boolean));
}

function paperMatchesScienceCategory(paper, categoryId) {
  const normalized = normalizeScienceCategory(categoryId);
  if (!normalized) return true;
  return scienceCategoryIdsForPaper(paper).has(normalized);
}

function scienceHookFromRenderInput(renderInput, fallbackTitle = 'Science review') {
  const hookBeat = Array.isArray(renderInput?.beats)
    ? renderInput.beats.find(beat => beat?.type === 'hook') || renderInput.beats[0]
    : null;
  const candidate = hookBeat?.headline || hookBeat?.body || renderInput?.title || fallbackTitle;
  return cleanHook(String(candidate || '').replace(/\n+/g, ' '), fallbackTitle);
}

function selectItem(items, seed, offset = 0) {
  if (!items.length) return null;
  return items[(hashString(seed) + offset) % items.length];
}

function selectScienceCategory(dateString, offset = 0, requestedCategory = '') {
  const normalized = normalizeScienceCategory(requestedCategory);
  if (normalized) {
    return {
      id: normalized,
      label: scienceCategoryLabel(normalized),
      requested: true,
    };
  }
  const selected = selectItem(SCIENCE_CATEGORY_ROTATION, `${dateString}:science-category`, offset)
    || SCIENCE_CATEGORY_ROTATION[0];
  return {
    ...selected,
    requested: false,
  };
}

function selectSciencePaper({ dateString, offset = 0, scienceCategory = '' } = {}) {
  const papers = loadSciencePapers();
  const category = selectScienceCategory(dateString, offset, scienceCategory);
  const categoryPapers = papers.filter(paper => paperMatchesScienceCategory(paper, category.id));
  const candidates = categoryPapers.length ? categoryPapers : papers;
  const paper = selectItem(candidates, `${dateString}:science:${category.id}`, offset) || candidates[0] || null;
  return {
    paper,
    category: {
      ...category,
      fallbackUsed: Boolean(category.id && !categoryPapers.length),
      candidateCount: candidates.length,
    },
  };
}

function buildPrefix({ dateString, lane, day }) {
  const laneLabel = lane === 'proof' ? 'Proof Pulse' : lane === 'science' ? 'Science review' : 'Exercise';
  return `Balance Daily, ${displayDate(dateString)}: ${laneLabel}`;
}

function buildExercisePost({ dateString, offset = 0 }) {
  const day = dayNameForDate(dateString);
  const exercise = selectItem(DEFAULT_EXERCISES, `${dateString}:exercise`, offset) || DEFAULT_EXERCISES[0];
  const prefix = buildPrefix({ dateString, lane: 'exercise', day });
  const hook = cleanHook(exercise.hook, `${exercise.title} form cue.`);
  const cta = exercise.save;
  const caption = [
    hook,
    '',
    `Set up: ${exercise.cue}`,
    '',
    `Why it matters: ${exercise.reason}`,
    '',
    'Common mistake: rushing the rep before the setup is locked in.',
    '',
    'Fix: set the position first, then move with control.',
    '',
    cta,
  ].join('\n');

  return {
    id: `${dateString}-exercise-${safeSlug(exercise.title)}`,
    date: dateString,
    day,
    lane: 'exercise',
    title: `${exercise.title} form cue`,
    hook,
    source: 'exercise_videos.js',
    mediaType: 'text',
    mediaUrl: '',
    thumbnailUrl: null,
    assetUrl: exercise.videoUrl,
    caption,
    cta,
    prefix,
    status: 'created',
  };
}

function buildSciencePost({ dateString, offset = 0, scienceCategory = '' }) {
  const day = dayNameForDate(dateString);
  const selected = selectSciencePaper({ dateString, offset, scienceCategory });
  const paper = selected.paper || {
    id: 'plant-protein-muscle',
    slideTitle: 'Plant protein held up',
    spokenAuthors: 'Hevia-Larrain and colleagues',
    journal: 'Sports Medicine',
    year: 2021,
    category: 'plant_based_nutrition',
    categoryLabel: 'Plant-based nutrition',
    topic: 'plant protein and muscle gain',
    finding: 'Plant-based diets can support muscle and strength gains when protein and training are set up properly.',
    doesNotProve: 'It does not prove every protein food is identical.',
    humanTakeaway: 'Plant-based muscle gain is about enough protein, good training, and consistency.',
    url: 'https://link.springer.com/article/10.1007/s40279-021-01434-9',
  };
  const category = selected.paper ? selected.category : {
    id: 'plant_based_nutrition',
    label: 'Plant-based nutrition',
    requested: false,
    fallbackUsed: true,
    candidateCount: 1,
  };
  const renderInput = loadScienceRenderInput(paper.id);
  const prefix = buildPrefix({ dateString, lane: 'science', day });
  const title = paper.slideTitle || renderInput?.title || paper.title || paper.topic || 'Science review';
  const hook = scienceHookFromRenderInput(renderInput, paper.hook || title);
  const paperIntro = paper.spokenAuthors
    ? `This review uses ${possessiveName(paper.spokenAuthors)} paper to look at ${paper.topic || 'one useful health idea'}.`
    : `This review looks at ${paper.topic || 'one useful health idea'}.`;
  const cta = 'Follow for more health science.';
  const caption = [
    hook,
    '',
    paperIntro,
    '',
    `The useful bit: ${cleanText(paper.finding || renderInput?.narration || '', 320)}`,
    '',
    `What it does not prove: ${cleanText(paper.doesNotProve || 'It does not prove one study explains every person or every situation.', 280)}`,
    '',
    `Bottom line: ${cleanText(paper.humanTakeaway || 'Use the idea practically, without turning it into a rule that does not fit real life.', 260)}`,
    '',
    paper.url ? `Source: ${paper.url}` : '',
    '',
    cta,
  ].filter(line => line !== null && line !== undefined).join('\n');

  return {
    id: `${dateString}-science-${safeSlug(paper.id || title)}`,
    date: dateString,
    day,
    lane: 'science',
    title,
    hook,
    source: `content-lab/config/science-papers.json:${paper.id || 'fallback'}:${category.id || 'all'}`,
    mediaType: 'text',
    mediaUrl: '',
    thumbnailUrl: null,
    assetUrl: null,
    caption,
    cta,
    prefix,
    status: 'created',
    paperId: paper.id || null,
    scienceCategory: category.id || paper.category || null,
    scienceCategoryLabel: category.label || paper.categoryLabel || null,
    scienceCategoryFallbackUsed: Boolean(category.fallbackUsed),
  };
}

function normalizeCounts(counts = {}) {
  return {
    workout_sessions_7d: Number(counts.workout_sessions_7d ?? counts.workouts ?? DEFAULT_PROOF_COUNTS.workout_sessions_7d) || 0,
    workout_users_7d: Number(counts.workout_users_7d ?? DEFAULT_PROOF_COUNTS.workout_users_7d) || 0,
    users_with_2_plus_workouts_7d: Number(counts.users_with_2_plus_workouts_7d ?? counts.twoPlus ?? DEFAULT_PROOF_COUNTS.users_with_2_plus_workouts_7d) || 0,
    pbs_7d: Number(counts.pbs_7d ?? counts.pbs ?? DEFAULT_PROOF_COUNTS.pbs_7d) || 0,
    pb_users_7d: Number(counts.pb_users_7d ?? DEFAULT_PROOF_COUNTS.pb_users_7d) || 0,
    mood_logs_7d: Number(counts.mood_logs_7d ?? counts.moodLogs ?? DEFAULT_PROOF_COUNTS.mood_logs_7d) || 0,
    mood_users_7d: Number(counts.mood_users_7d ?? DEFAULT_PROOF_COUNTS.mood_users_7d) || 0,
    client_checkins_7d: Number(counts.client_checkins_7d ?? counts.checkins ?? DEFAULT_PROOF_COUNTS.client_checkins_7d) || 0,
    active_challenge_participants: Number(counts.active_challenge_participants ?? counts.challenge ?? DEFAULT_PROOF_COUNTS.active_challenge_participants) || 0,
  };
}

function buildProofPost({ dateString, counts = DEFAULT_PROOF_COUNTS }) {
  const day = dayNameForDate(dateString);
  const c = normalizeCounts(counts);
  const prefix = buildPrefix({ dateString, lane: 'proof', day });
  const isSaturday = day === 'Saturday';
  const title = isSaturday ? 'This week inside Balance' : 'Small wins from inside Balance this week';
  const hook = isSaturday
    ? 'This week inside Balance was not about perfect weeks.'
    : 'The people getting results in Balance are not having perfect weeks.';
  const cta = isSaturday
    ? 'Want in for the next 30-day vegan fitness challenge? Message me BALANCE.'
    : 'If you want to try the 30-day vegan fitness challenge, message me BALANCE.';
  const caption = [
    hook,
    '',
    `${c.workout_sessions_7d} workouts logged across ${c.workout_users_7d} people in the last 7 days.`,
    `${c.users_with_2_plus_workouts_7d} people got at least two sessions done.`,
    `${c.pbs_7d} PB markers showed up, plus ${c.client_checkins_7d} check-ins and ${c.mood_logs_7d} mood logs.`,
    '',
    'The bit that matters is not perfect weeks. It is people checking in, adjusting quickly, and not disappearing when life gets messy.',
    '',
    cta,
  ].join('\n');

  return {
    id: `${dateString}-proof-pulse`,
    date: dateString,
    day,
    lane: 'proof',
    title,
    hook,
    source: 'Supabase aggregate proof signals',
    mediaType: 'text',
    mediaUrl: '',
    thumbnailUrl: null,
    assetUrl: null,
    caption,
    cta,
    prefix,
    status: 'created',
    counts: c,
  };
}

function createPostForLane({ lane, dateString, counts, offset = 0, scienceCategory = '' }) {
  if (lane === 'exercise') return buildExercisePost({ dateString, offset });
  if (lane === 'science') return buildSciencePost({ dateString, offset, scienceCategory });
  if (lane === 'proof') return buildProofPost({ dateString, counts });
  throw new Error(`Unsupported lane: ${lane}`);
}

function createDailyPost({ dateString = formatBrisbaneDate(), counts, offset = 0, scienceCategory = '' } = {}) {
  const lane = laneForDate(dateString);
  if (!lane) {
    return {
      skipped: true,
      reason: 'sunday_off',
      date: dateString,
      day: dayNameForDate(dateString),
      lane: null,
    };
  }
  return createPostForLane({ lane, dateString, counts, offset, scienceCategory });
}

function createOneOfEach({ dateString = formatBrisbaneDate(), counts, scienceCategory = '' } = {}) {
  return ['exercise', 'science', 'proof'].map((lane, index) =>
    createPostForLane({ lane, dateString, counts, offset: index, scienceCategory })
  );
}

function markdownForPost(post) {
  const lines = [
    `# ${post.title}`,
    '',
    `- Date: ${post.date}`,
    `- Day: ${post.day}`,
    `- Lane: ${post.lane}`,
    `- Source: ${post.source}`,
  ];
  if (post.assetUrl) lines.push(`- Asset: ${post.assetUrl}`);
  if (post.hook) lines.push(`- Hook: ${post.hook}`);
  if (post.cta) lines.push(`- CTA: ${post.cta}`);
  if (post.paperId) lines.push(`- Paper ID: ${post.paperId}`);
  if (post.scienceCategoryLabel) lines.push(`- Science Category: ${post.scienceCategoryLabel}`);
  lines.push('', '## Feed Caption', '', '```text', post.caption, '```', '');
  return lines.join('\n');
}

function writeReviewPack({ posts, dateString = formatBrisbaneDate(), outputRoot } = {}) {
  const root = outputRoot || path.join(repoRoot(), 'content-lab', 'output', 'balance-daily', dateString);
  fs.mkdirSync(root, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(),
    date: dateString,
    status: 'created_for_review',
    posts: [],
  };
  for (const post of posts) {
    const dir = path.join(root, `${post.lane}-${safeSlug(post.title)}`);
    fs.mkdirSync(dir, { recursive: true });
    const mdPath = path.join(dir, 'post.md');
    fs.writeFileSync(mdPath, markdownForPost(post));
    manifest.posts.push({ ...post, markdownPath: mdPath });
  }
  const manifestPath = path.join(root, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { root, manifestPath, manifest };
}

module.exports = {
  BRISBANE_TZ,
  DAY_LANES,
  DEFAULT_PROOF_COUNTS,
  SCIENCE_CATEGORY_ROTATION,
  cleanText,
  createDailyPost,
  createOneOfEach,
  createPostForLane,
  dayNameForDate,
  displayDate,
  formatBrisbaneDate,
  laneForDate,
  markdownForPost,
  normalizeCounts,
  parseDateOnly,
  safeSlug,
  selectSciencePaper,
  writeReviewPack,
};
