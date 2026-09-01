const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const premiumOverlays = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib/stories.js'), 'utf8');

function featureTourSource() {
  const start = dashboard.indexOf('<!-- ========== GUIDED FEATURE TOUR ========== -->');
  const end = dashboard.indexOf('<!-- ========== END NEW FEATURE REVEAL ========== -->');
  assert.ok(start >= 0, 'guided feature tour marker should exist');
  assert.ok(end > start, 'feature reveal end marker should follow the guided tour');
  return dashboard.slice(start, end);
}

test('walkthrough keeps surrounding page context readable', () => {
  const source = featureTourSource();

  assert.match(source, /rgba\(26,24,20,\.34\)/);
  assert.match(source, /#guided-tour-overlay\.tour-page-view #guided-tour-spotlight[\s\S]*?rgba\(26,24,20,\.08\)/);
  assert.doesNotMatch(source, /rgba\(26,24,20,\.76\)/);
  assert.match(premiumOverlays, /rgba\(26, 24, 20, 0\.34\)/);
  assert.match(premiumOverlays, /#guided-tour-overlay\.tour-page-view #guided-tour-spotlight[\s\S]*?rgba\(26, 24, 20, 0\.08\)/);
  assert.doesNotMatch(premiumOverlays, /#guided-tour-spotlight[\s\S]*?rgba\(29, 15, 50, 0\.78\)/);
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=107-direct-course-lesson/);
  assert.match(serviceWorker, /pbb-app-v446-exact-quiz-label/);
  assert.match(source, /#guided-tour-overlay \{[^}]*pointer-events: auto/);
  assert.match(source, /#guided-tour-overlay\.tour-tap-target,[\s\S]*?#guided-tour-overlay\.tour-action-required:not\(\.tour-gate-complete\) \{ pointer-events: none; \}/);
  assert.match(source, /#guided-tour-overlay\.tour-coach-note \{ pointer-events: none; \}/);
  assert.match(source, /#guided-tour-bubble \{[\s\S]*?visibility: visible !important;/);
  assert.match(source, /tour-control-prompt:not\(\.tour-gate-complete\) #guided-tour-bubble[\s\S]*?pointer-events: none/);
  assert.match(source, /#guided-tour-overlay\.tour-control-prompt \{ pointer-events: none; \}/);
  assert.match(source, /tour-control-prompt\.tour-gate-complete #guided-tour-bubble \{ pointer-events: auto; \}/);
  assert.match(source, /classList\.toggle\('tour-control-prompt', !!\(step && step\.requiresHighlightedClick\)\)/);
});

test('guided-tour tab handoffs verify Home is actually visible after delayed feature work', () => {
  const source = featureTourSource();

  assert.match(source, /var targetSelectors = \{[\s\S]*?dashboard:'#view-dashboard'[\s\S]*?learning:'#view-learning'[\s\S]*?friends:'#view-friends'/);
  assert.match(source, /var stableDestinationChecks = 0/);
  assert.match(source, /for \(var attempt = 0; attempt < 8; attempt \+= 1\)/);
  assert.match(source, /switchAppTab\(tabName, navButton\)/);
  assert.match(source, /if \(q\(targetSelector\)\) stableDestinationChecks \+= 1/);
  assert.match(source, /if \(stableDestinationChecks >= 2\) return/);
  assert.match(source, /if \(!destinationVisible\) \{[\s\S]*?switchAppTab\(tabName, navButton\)/);
});

test('guided-tour positioning is frame-coordinated and settles once without chasing the page', () => {
  const source = featureTourSource();

  assert.match(source, /function scheduleTourPosition\(step, options\)/);
  assert.match(source, /tourPositionFrame = requestAnimationFrame/);
  assert.match(source, /scheduleTourPosition\(displayStep, \{ settleOnly:true, settleDelay:240 \}\)/);
  assert.match(source, /resizeHandler = function\(\)\{[\s\S]*?scheduleTourPosition\(step\)/);
  assert.match(source, /document\.addEventListener\('load', resizeHandler, true\)/);
  assert.match(source, /document\.removeEventListener\('load', resizeHandler, true\)/);
  assert.match(source, /transition: opacity \.14s ease, box-shadow \.16s ease, border-color \.16s ease/);
  assert.doesNotMatch(source, /#guided-tour-spotlight[\s\S]{0,220}transition: all/);
  assert.doesNotMatch(source, /transition: top 0\.28s/);
  assert.doesNotMatch(source, /\}, 1100\);[\s\S]{0,240}positionBubbleAndSpotlight/);
  assert.doesNotMatch(source, /\}, 1800\);[\s\S]{0,240}positionBubbleAndSpotlight/);
});

test('prompted tour actions recover when the destination opens before the action signal is observed', () => {
  const source = featureTourSource();

  assert.match(source, /var exactPromptTarget = step\.preActionSel/);
  assert.match(source, /var exactPromptVisible = !!\(exactPromptRect/);
  assert.match(source, /expectedActionId && !exactPromptVisible && resolveStepTarget\(step\)\.target/);
  assert.match(source, /beginPromptedAction\(true\)/);
});

test('page-level stops opt into the softer context view', () => {
  const source = featureTourSource();

  for (const title of [
    'Check your workout week',
    'Follow the exercise card',
    'See every meal on Day 1',
    'One shopping list for the week',
    'Read, then take the quiz',
    'The Balance community'
  ]) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      source,
      new RegExp(`title:'${escapedTitle}'[^\\n]*pageView:true|pageView:true[^\\n]*title:'${escapedTitle}'`),
      `${title} should preserve the full-page context`
    );
  }
});

test('Meta preview opens the next strength workout and waits for real proof media', () => {
  const source = featureTourSource();

  assert.match(source, /function getMetaPreviewStrengthDayIndex\(\)/);
  assert.match(source, /workoutId !== 'rest'/);
  assert.match(source, /!workoutId\.startsWith\('yoga-'\)/);
  assert.match(source, /!workoutId\.startsWith\('recovery-'\)/);
  assert.match(source, /window\.openCalendarWorkout\(dayIndex\)/);
  assert.match(source, /title:'Open your first workout'/);
  assert.match(source, /title:'Follow the exercise card'/);
  assert.match(source, /data-thumbnail-state="ready"/);
  assert.match(source, /title:'Open your first workout'[^\n]*return !!\(await openMetaPreviewStrengthWorkout\(\)\)/);
  assert.doesNotMatch(source, /title:'Open your first workout'[^\n]*advanceAfterAction:true/);
  assert.match(source, /title:'Follow the exercise card'[^\n]*waitForMetaPreviewWorkoutProof\(\{ requireThumbnail:true, timeoutMs:8000 \}\)/);
  assert.doesNotMatch(source, /title:'Follow the exercise card'[^\n]*openMetaPreviewStrengthWorkout\(\)/);
  assert.match(source, /tour-transitioning #guided-tour-bubble/);
  assert.match(source, /overlay\.classList\.add\('tour-transitioning'\)/);
  assert.match(source, /overlay\.classList\.remove\('tour-transitioning'\)/);
});

test('Home prompts only become tappable after their first-tap handler is ready', () => {
  const source = featureTourSource();

  assert.match(source, /async function showStep\(i, options\)[\s\S]*?overlay\.classList\.add\('tour-transitioning'\)/);
  assert.match(source, /const promptTab = isPromptBeforeAction \? \(step\.preActionTab \|\| 'dashboard'\) : step\.tab;[\s\S]*?await ensureTab\(promptTab\);[\s\S]*?if \(renderToken !== tourRenderToken\) return/);
  assert.match(source, /armPromptTarget\(step, target, i\);[\s\S]*?overlay\.classList\.remove\('tour-transitioning'\)/);
  assert.match(source, /document\.addEventListener\('pointerdown', handleTargetClick, true\)/);
  assert.match(source, /document\.removeEventListener\('pointerdown', handleTargetClick, true\)/);
  assert.match(source, /if \(idx >= activeSteps\.length - 1\)[\s\S]*?await showStep\(idx \+ 1\)/);
  assert.match(source, /window\.tourBack = async function\(\)/);
});

test('Meta preview waits for the rendered meal photo and includes the guided community stops', () => {
  const source = featureTourSource();

  assert.match(source, /function waitForMetaPreviewMealPhoto\(timeoutMs\)/);
  assert.match(source, /photo\.complete && photo\.naturalWidth > 0/);
  assert.match(source, /await waitForMetaPreviewMealPhoto\(30000\)/);
  assert.match(source, /title:'The Balance community'[^\n]*metaPreview:true/);
  assert.match(source, /legacyFeedPostStep[\s\S]*?title:'Introduce yourself'[\s\S]*?requiresFeedPost:true/);
});

test('guided tours and returning-user reveals both reset and apply page-view mode', () => {
  const source = featureTourSource();

  assert.match(source, /function positionBubbleAndSpotlight\(target, step\)[\s\S]*?classList\.toggle\('tour-page-view', pageView\)/);
  assert.match(source, /function positionReveal\(target, step\)[\s\S]*?classList\.toggle\('tour-page-view', pageView\)/);
  assert.ok((source.match(/if \(pageView\) \{/g) || []).length >= 2);
});

test('required onboarding tours cannot be skipped', () => {
  const source = featureTourSource();

  assert.match(source, /if \(skipped && \(completedMetaPreviewTour \|\| completedClientActivationTour\)\)/);
  assert.match(source, /showToast\('Finish the guided tour to continue\.'/);
  assert.match(source, /skipButton\.hidden = metaPreviewTour \|\| clientActivationTour/);
  assert.match(source, /<button class="tour-skip" onclick="endFeatureTour\(true\)" hidden>Skip<\/button>/);
});

test('required onboarding continues from Feed through Foundations, coach, and Weekly Goals', () => {
  const source = featureTourSource();
  const order = [
    "'The Balance community'",
    "'Introduce yourself'",
    "'Read, then take the quiz'",
    "'Watch Shannon’s coach note'",
    "'Pick your Weekly Goals'"
  ].map(title => source.indexOf(title, source.indexOf('REQUIRED_ONBOARDING_TOUR_TITLES')));

  assert.ok(order.every(index => index >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(source, /activeSteps = requiredOnboardingTourSteps\(\)/);
  assert.match(source, /requiresFeedPost[\s\S]*?pbbFeedPostCreated/);
  assert.match(stories, /dispatchEvent\(new CustomEvent\('pbbFeedPostCreated'/);
  assert.match(source, /waitForPromptedStepSurface\(step, 900\)/);
  assert.match(source, /const displayStep = isPromptBeforeAction[\s\S]*?coachNoteGuide: false,[\s\S]*?requiresWelcomeVideo: false/);
  assert.match(source, /if \(options\.afterPromptedAction\) tourNextBlockedUntil = Date\.now\(\) \+ 900/);
  assert.match(source, /window\.tourNext = async function\(\)\{[\s\S]*?if \(Date\.now\(\) < tourNextBlockedUntil\) return/);
});

test('shopping-list tour accepts a tap anywhere on the highlighted ingredient row', () => {
  const source = featureTourSource();
  assert.match(source, /sel:'#ai-plan-shopping-list \.ai-plan-shopping__item'.*title:'One shopping list for the week'/);
  assert.match(source, /title:'One shopping list for the week'[^\n]*tourScrollContextSel:'#ai-plan-shopping-card'/);
  assert.match(source, /tourScrollTarget\.scrollIntoView\(\{ block:displayStep\.tourScrollContextSel \? 'start'/);
  assert.doesNotMatch(source, /sel:'#ai-plan-shopping-list \.ai-plan-shopping__item input'.*title:'One shopping list for the week'/);
});

test('community handoff keeps one tap from skipping its explanation', () => {
  const source = featureTourSource();
  assert.match(source, /const communityTourStep = findTourStep\('The Balance community'\)[\s\S]*?setTimeout\(resolve, 140\)/);
});

test('the required tour introduction also completes the Week 1 Feed action', () => {
  const source = featureTourSource();
  assert.match(
    source,
    /const communityTourStep = findTourStep\('The Balance community'\)[\s\S]*?sessionStorage\.setItem\('pbb_foundations_feed_action', 'w1_feed_intro'\)/
  );
  assert.match(stories, /course_action_id: foundationsCourseActionId \|\| null/);
});

test('completed required actions leave their old instruction card automatically', () => {
  const source = featureTourSource();
  assert.match(source, /requiresFeedPost[\s\S]*?Your introduction is posted[\s\S]*?showStep\(completedStepIndex \+ 1\)/);
  assert.match(source, /requiresFoundationsLesson[\s\S]*?First lesson complete[\s\S]*?showStep\(completedStepIndex \+ 1\)/);
  assert.match(source, /requiresWeeklyGoals[\s\S]*?Weekly Goals saved[\s\S]*?showStep\(completedStepIndex \+ 1\)/);
});
