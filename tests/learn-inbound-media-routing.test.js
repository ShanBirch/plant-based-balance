const test = require('node:test');
const assert = require('node:assert/strict');
const {buildMediaReviewInfo} = require('../netlify/functions/_lib/client-context');
const {_test} = require('../netlify/functions/ig-instant-draft');
test('verified course questions in decoded video receive their requested answers', () => {
 const mediaDecode={analysis_complete:true,analysis_succeeded:true,media_summary:'A slide with three questions: how many lessons are included, whether there is a completion certificate, and what happens in week 4.'};
 const result=_test.applyDecodedPaidMetaAudioHandoff({joined:'Balance is a six-week course.',mediaDecode},{flowVariant:'broad_pain',currentMessage:'[VIDEO attachment]'});
 assert.match(result.joined,/31 lessons/);
 assert.match(result.joined,/Certificate of Completion/);
 assert.match(result.joined,/Week 4: take the fight out of food/);
 assert.doesNotMatch(result.joined,/slide|three questions|Week 1:/);
 assert.equal(result.mediaDecode,mediaDecode);
});
test('decoded goal and shift constraints replace a repeated blocker question with the offer', () => {
 const draft={joined:"Before I line up your week, what's your blocker right now?",mediaDecode:{analysis_complete:true,analysis_succeeded:true,media_summary:"Goal: build strength. Available Tuesday and Saturday. Work shifts change each week. Dumbbells at home."}};
 const result=_test.applyDecodedPaidMetaAudioHandoff(draft,{flowVariant:'broad_pain',currentMessage:'Could this work for me?'});
 assert.doesNotMatch(result.joined,/your blocker|gets in the way/i);
 assert.match(result.joined,/preview/i);
 assert.equal(result.mediaDecode,draft.mediaDecode);
 assert.notEqual(result.appPreviewHandoff,true);
 assert.equal(_test.applyDecodedPaidMetaAudioHandoff({...draft,mediaDecode:{...draft.mediaDecode,analysis_complete:false}},{flowVariant:'broad_pain'}).joined,draft.joined);
 for (const joined of ['Quick check so I tailor your plan properly: what’s the main real-life thing that usually makes consistency tricky with this schedule?', 'What makes it difficult to stay consistent?', 'Which part of your routine is hardest?']) {
  const repaired=_test.applyDecodedPaidMetaAudioHandoff({...draft,joined},{flowVariant:'broad_pain',currentMessage:'Could this work for me?'});
  assert.notEqual(repaired.joined,joined);
  assert.match(repaired.joined,/preview/i);
 }
});

test('free personalised preview requests send the card and explicit declines do not', () => {
  const options={flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/Test_123-xyz9876543210'};
  const mediaDecode={analysis_complete:true};
  for(const currentMessage of ['Can you just send me the free app preview first? I want to look before deciding.','Please show me my free personalised app preview.','Actually, I would like the app preview now. Please send it.']) {
    assert.equal(_test.applyDecodedPaidMetaAudioHandoff({mediaDecode},{...options,currentMessage}).appPreviewHandoff,true);
  }
  assert.ok(!_test.applyDecodedPaidMetaAudioHandoff({mediaDecode},{...options,currentMessage:"Do not send me the free app preview."}).appPreviewHandoff);
});

test('weekly pricing answers can pass without the upfront-price exact phrase', () => {
  const currentMessage='Before goals, how much is Learn weekly and does it stop charging after six weeks?';
  const review=joined=>_test.collectPaidMetaWriterContractIssues({draft:{joined},currentMessage,flowVariant:'broad_pain'});
  const valid='It is AUD $149 upfront for the full six weeks. There is also AUD $24.83/week with a six-week minimum, and that one continues weekly until cancelled.';
  assert.ok(!review(valid).some(issue=>/Answer the price exactly/.test(issue)));
  assert.deepEqual(review(valid).filter(_test.isBlockingPaidMetaWriterContractIssue), []);
  for(const wrong of [valid.replace('$24.83','$9.99'),valid.replace('six-week minimum','no minimum'),valid.replace('continues weekly until cancelled','stops automatically')]) {
    assert.ok(review(wrong).some(issue=>/Answer the price exactly/.test(issue)));
  }
});

test('a media reply cannot silently change the course into six lessons', () => {
  const issues=_test.collectPaidMetaWriterContractIssues({draft:{joined:'Balance Learn has 6 lessons, one for each week.'},currentMessage:'[video]',flowVariant:'broad_pain'});
  assert.ok(issues.some(issue=>/Incorrect Learn lesson count/.test(issue)));
  assert.ok(issues.some(_test.isBlockingPaidMetaWriterContractIssue));
});

test('decoded video speech and a typed follow-up can each authorize preview delivery', () => {
  const options={flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/Test_123-xyz9876543210'};
  for (const [transcript,currentMessage] of [['Please send me the app preview.','[video]'],['','Please send me the app preview.']]) {
    const result=_test.applyDecodedPaidMetaAudioHandoff({mediaDecode:{analysis_complete:true,video_processing:[{transcript}]}},{...options,currentMessage});
    assert.equal(result.appPreviewHandoff,true);
    assert.equal(_test.buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft:result,currentMessage})?.required,false);
  }
});

test('decoded voice preview consent sends the signed link and preserves analysis evidence', () => {
  const mediaDecode = {analysis_complete:true,analysis_succeeded:true,audio_transcripts:[{text:'Yes please, I would like to see the app preview before I pay.'}]};
  const result = _test.applyDecodedPaidMetaAudioHandoff({chunks:['What is your goal?'],mediaDecode}, {currentMessage:'[voice note]',flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/Test_123-xyz9876543210'});
  assert.equal(result.appPreviewHandoff,true);
  assert.equal(result.mediaDecode,mediaDecode);
  assert.doesNotMatch(result.joined,/your goal/);
  const approval = _test.buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft:result,currentMessage:'[voice note]'});
  assert.equal(approval?.required,false);
  assert.equal(approval?.code,'approved_meta_ad_sales_progression');
  assert.equal(_test.buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft:result,currentMessage:'Do not send me the preview.'}),null);
});

test('incomplete audio analysis and typed declines cannot trigger voice handoffs', () => {
  const draft = {chunks:[],mediaDecode:{analysis_complete:false,audio_transcripts:[{text:'Send the preview'}]}};
  assert.equal(_test.applyDecodedPaidMetaAudioHandoff(draft,{flowVariant:'broad_pain'}),draft);
  const decoded = {...draft,mediaDecode:{...draft.mediaDecode,analysis_complete:true}};
  assert.equal(_test.applyDecodedPaidMetaAudioHandoff(decoded,{flowVariant:'broad_pain',currentMessage:'Actually no, do not send me the preview.'}),decoded);
});

test('paid media writer requires the private summary used by the delivery gate', () => {
  const prompt = _test.buildPaidMetaAgentPrompt({flowVariant:'broad_pain',hasMedia:true});
  assert.match(prompt, /"media_summary":"brief factual media description"/);
  assert.match(prompt, /31 lessons/);
  assert.match(prompt, /24\.83\/week/);
  assert.doesNotMatch(_test.buildPaidMetaAgentPrompt({flowVariant:'broad_pain'}), /media_summary/);
});

const draft = _test.buildDeterministicPaidMetaConversationReply({
  flowVariant: 'broad_pain', currentMessage: 'Can I see the preview?',
  appPreviewUrl: 'https://future-balance.netlify.app/p/Test_123-xyz9876543210',
});

for (const kind of ['AUDIO', 'PHOTO', 'VIDEO']) {
  test(`${kind} in an unanswered batch is analyzed before a text-only handoff`, () => {
    const media = buildMediaReviewInfo({
      message_preview: 'Can I see the preview?',
      recent_inbound_messages: [{text: `[${kind}:https://example.com/media]`}],
    });
    assert.equal(media.required, true);
    assert.equal(_test.selectFastDeterministicPaidMetaProgression({draft, requiresMediaAnalysis: media.required}), null);
  });
}

test('ordinary text keeps the tested fast preview handoff', () => {
  const media = buildMediaReviewInfo({message_preview: 'Can I see the preview?'});
  assert.equal(media.required, false);
  assert.equal(_test.selectFastDeterministicPaidMetaProgression({draft, requiresMediaAnalysis: media.required}), draft);
});

test('decoded mixed media is eligible for a content-based response', () => {
  const media = buildMediaReviewInfo({
    message_preview: '[AUDIO:https://example.com/voice] [PHOTO:https://example.com/photo] [VIDEO:https://example.com/video]',
    media_decode: {analysis_complete: true, analysis_succeeded: true,
      analyzed_kinds: ['audio', 'photo', 'video'],
      audio_transcripts: [{text: 'I want to build strength and can train at home twice a week.'}],
      media_summary: 'The photo and video show dumbbells and a bench in a home gym.'},
  });
  assert.equal(media.required, false);
});

test('an inaccessible attachment remains unresolved rather than being claimed as analyzed', () => {
  assert.equal(buildMediaReviewInfo({message_preview:'[AUDIO:https://example.com/voice]',media_decode:{analysis_succeeded:false,audio_failed:true}}).required,true);
});
