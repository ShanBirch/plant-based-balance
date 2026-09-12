const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../netlify/functions/ig-instant-draft')._test;
const {buildPaidMetaZoomHandoff,ZOOM_BOOKING_URL}=require('../netlify/functions/_lib/paid-meta-zoom');
const history=[{direction:'out',text:'Would you like one-on-one Zoom training with Learn? We can book a fit call.'}];
for(const currentMessage of ['I want the Zoom training with the course','Yes please','How much is Zoom training?','Can I book Zoom PT three sessions a week?','Do not send the preview, I want Zoom training'])test(currentMessage,()=>{
 const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage,history,flowVariant:'broad_pain'});
 assert.equal(draft?.paidMetaZoomHandoff,true);
 assert.match(draft.joined,/30-minute/);assert.match(draft.joined,/six-week/);
 assert.ok(draft.joined.includes(ZOOM_BOOKING_URL));assert.equal(draft.appPreviewHandoff,undefined);
 assert.equal(api.selectFastDeterministicPaidMetaProgression({draft,currentMessage}),draft);
 const approval=api.buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft,currentMessage,history});
 assert.equal(approval?.required,false);
 assert.equal(api.shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression({approval,draft}),true);
 assert.equal(api.getAutoDmHoldReason({draft,currentMessage,alertData:{meta_ad_conversation_fast_lane:true},draftReview:{verdict:'pass',confidence:1,issues:[]}}),null);
 assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft,currentMessage,history,flowVariant:'broad_pain'}),[]);
});
for(const currentMessage of ['No Zoom, just the course please','I do not want Zoom','Not now, hold off on Zoom','I work on Zoom all day','Can I train with Zoom if my shoulder hurts?'])test('does not force call: '+currentMessage,()=>{
 assert.equal(buildPaidMetaZoomHandoff({currentMessage,history:[],flowVariant:'broad_pain'}),null);
});
test('ordinary preview acceptance does not inherit an old Zoom topic',()=>{
 assert.equal(buildPaidMetaZoomHandoff({currentMessage:'Yes please',history:[...history,{direction:'out',text:'Want the Learn preview instead?'}],flowVariant:'broad_pain'}),null);
});
test('selected weekly frequency has the correct price',()=>{
 const d=buildPaidMetaZoomHandoff({currentMessage:'I want Zoom three sessions a week',flowVariant:'broad_pain'});
 assert.match(d.joined,/AUD \$275 per week/);
});
test('split Zoom offer keeps yes on the call route',()=>{
 const d=buildPaidMetaZoomHandoff({currentMessage:'Yes please',history:[{direction:'out',text:'Zoom PT includes Learn and live 30-minute training.'},{direction:'out',text:'Book a fit call here: https://plantbased-balance.org/book'}],flowVariant:'broad_pain'});
 assert.equal(d.paidMetaZoomHandoff,true);
});

test('compact PT5 selects five weekly sessions',()=>{
 const d=buildPaidMetaZoomHandoff({currentMessage:'Tell me about Zoom PT5 and how to get started',flowVariant:'broad_pain'});
 assert.match(d.joined,/AUD \$425 per week/);
});
test('one Zoom session a week retains the chosen frequency and price',()=>{
 const d=buildPaidMetaZoomHandoff({currentMessage:'Yes please, one Zoom session a week',flowVariant:'broad_pain'});
 assert.match(d.joined,/AUD \$125 per week/);
});
for (const currentMessage of ['I work on Zoom all day so I want workouts away from my screen. Can I see the Learn preview?','Does the 149 dollars cover the Learn course and a 30-minute Zoom session each week?']) test('writer must resolve meaning: '+currentMessage,()=>{
 assert.equal(buildPaidMetaZoomHandoff({currentMessage,flowVariant:'broad_pain'}),null);
});
