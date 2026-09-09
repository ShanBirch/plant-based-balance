const test = require('node:test');
const assert = require('node:assert/strict');
const {buildMediaReviewInfo} = require('../netlify/functions/_lib/client-context');
const {_test} = require('../netlify/functions/ig-instant-draft');

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
