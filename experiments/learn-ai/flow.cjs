'use strict';
const crypto = require('node:crypto');
const prompt = require('./prompt.json');
const schema = {
  type: 'object', additionalProperties: false,
  required: ['conversation_facts', 'status', 'decision_summary', 'actions'],
  properties: {
    conversation_facts: {type:'object',additionalProperties:false,required:['goal','practical_blocker','support_choice','preview_consent','preview_consent_quote'],properties:{
      goal:{type:'string'},practical_blocker:{type:'string'},support_choice:{type:'string',enum:['unknown','independent','zoom']},preview_consent:{type:'string',enum:['absent','granted','withdrawn']},preview_consent_quote:{type:'string'},
    }},
    status: {type: 'string', enum: ['reply', 'pause', 'needs_human']},
    decision_summary: {type: 'string'},
    actions: {type: 'array', items: {type: 'object', additionalProperties: false,
      required: ['type', 'text', 'asset_id'], properties: {
        type: {type: 'string', enum: ['text', 'image', 'video', 'card']},
        text: {type: 'string'}, asset_id: {type: 'string'},
      }}},
  },
};
function catalogue(now = new Date()) {
  const standard = now.getTime() >= Date.parse('2026-10-21T00:00:00+10:00');
  return {
    ally: {type: 'image', url: 'https://plantbased-balance.org/photos/client-success/ally-cocos.png', facts: 'Weight loss. Ally lost 12kg in 16 weeks while working full time and raising a family.'},
    gen: {type: 'image', url: 'https://plantbased-balance.org/photos/client-success/gen-cocos.jpg', facts: 'Strength, fitness and confidence through progressive repeatable training.'},
    kristy: {type: 'image', url: 'https://plantbased-balance.org/photos/client-success/kristy-front-mirror-26-weeks.png', facts: 'Kristy. Progress over 26 weeks of coaching with me; not the duration of Learn.'},
    bec_kirsty: {type: 'image', url: 'https://plantbased-balance.org/photos/client-success/bec-kirsty-cocos.png', facts: 'Shared accountability. Both lost over 10kg and got stronger.'},
    course: {type: 'video', url: `https://plantbased-balance.org/assets/balance-learn-dm-${standard ? '450-v11' : '149-v13-polished-cards'}.mp4`, facts: 'Approved six-week Learn explanation.'},
    preview: {type: 'card', url: null, facts: 'Signed course WEBSITE link. Read the course information, then use the bottom button for app download and preview setup. Free preview before payment, no automatic charge.'},
    zoom: {type: 'card', url: 'https://balanceneurosciencefitness.com/book', facts: 'Fit-call booking, not checkout. Availability and suitability checked before payment.'},
  };
}
function facts(now = new Date()) {
  const weeks=require('../../lib/learn-curriculum.js').weeks();
  return {verified_date: now.toISOString(), course: 'Balance Learn', duration: 'six weeks', lessons_and_quizzes: weeks.reduce((n,w)=>n+w.lessonIds.length,0),
    upfront_aud: now.getTime() >= Date.parse('2026-10-21T00:00:00+10:00') ? 450 : 149,
    upfront_terms: 'One payment, no subscription or auto-renewal. Launch 21 September 2026. Intro price through 20 October Brisbane time.',
    optional_weekly: 'AUD 24.83/week, six-week minimum AUD 148.98, continuing until cancelled. Distinct from upfront payment.',
    includes: 'Fixed neuroscience/psychology course, personalised workout program, meal-plan support fitted to dietary preferences, my weekly training/food review and adjustments, six weeks app/community access. Home or gym workouts. Not unlimited daily coaching.',
    themes: weeks.map(w=>w.title),
    weekly_curriculum: weeks.map(w=>({week:w.number,title:w.title,description:w.description,lesson_count:w.lessonIds.length})),
    completion: 'Certificate of Completion after required lessons and actions, not accreditation.',
    written_lessons: true, video_captions: 'unconfirmed',
    zoom: 'Live 30-minute sessions: AUD 125/week for one, 275 for three, 425 for five. Six-week starting block. Learn included. Do not guarantee specific times.'};
}
function validatePlan(plan, assets = catalogue()) {
  if (!plan || !['reply','pause','needs_human'].includes(plan.status) || !Array.isArray(plan.actions)) throw Error('invalid_plan');
  if (plan.status === 'reply' && !plan.actions.length) throw Error('empty_reply');
  for (const [i,a] of plan.actions.entries()) {
    if (a.type === 'text') {
      if (!a.text?.trim() || a.asset_id || /https?:\/\//i.test(a.text)) throw Error('invalid_text_action');
    } else {
      if (plan.status !== 'reply' || !assets[a.asset_id] || assets[a.asset_id].type !== a.type || a.text) throw Error('invalid_asset_action');
      if (plan.actions[i-1]?.type !== 'text') throw Error('missing_media_introduction');
    }
  }
  return plan;
}
async function decide({history = [], inbound, receipts = [], pendingSafety = false, model = 'gpt-5.4-mini', apiKey = process.env.OPENAI_API_KEY, now = new Date(), fetchImpl = fetch}) {
  if (process.env.LEARN_EXPERIMENT_URL) {
    const response = await fetchImpl(process.env.LEARN_EXPERIMENT_URL, {method:'POST',signal:AbortSignal.timeout(100000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.LEARN_EXPERIMENT_TOKEN}`},body:JSON.stringify({history,inbound,receipts,model:process.env.LEARN_EXPERIMENT_MODEL||model})});
    if(!response.ok) throw Error(`experiment_http_${response.status}`);
    return response.json();
  }
  if (!apiKey) throw Error('api_key_unavailable');
  const assets = catalogue(now);
  const context = {facts: facts(now), assets: Object.fromEntries(Object.entries(assets).map(([id,a])=>[id,{type:a.type,facts:a.facts}])), history, receipts, pending_safety_review: pendingSafety, latest_inbound_burst: inbound};
  const started = Date.now();
  const res = await fetchImpl('https://api.openai.com/v1/responses', {method:'POST', signal:AbortSignal.timeout(90000),
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body: JSON.stringify({model, store:false, instructions:prompt, input:JSON.stringify(context), reasoning:{effort:'medium'}, max_output_tokens:2200,
      text:{format:{type:'json_schema',name:'learn_reply',strict:true,schema}}})});
  if (!res.ok) throw Error(`model_http_${res.status}`);
  const data = await res.json();
  if (data.status !== 'completed') throw Error(`model_${data.status || 'incomplete'}`);
  const output = (data.output || []).flatMap(x=>x.content || []).filter(x=>x.type === 'output_text').map(x=>x.text).join('');
  const plan = validatePlan(JSON.parse(output), assets);
  const stableFacts={...facts(now)};delete stableFacts.verified_date;
  return {plan, model:data.model, latency_ms:Date.now()-started, usage:data.usage, prompt_hash:crypto.createHash('sha256').update(prompt).digest('hex'),flow_hash:crypto.createHash('sha256').update(JSON.stringify({prompt,schema,facts:stableFacts,assets})).digest('hex')};
}
module.exports = {decide, validatePlan, catalogue, facts, prompt, schema};
