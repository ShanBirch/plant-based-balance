// Synthetic writer-only checks. No customer records, transport or calendar writes.
// Supply the existing model environment externally; no credentials are saved.
process.env.AI_USAGE_LOG_DISABLED = 'true';
if (!process.env.OPENAI_API_KEY || /\*/.test(process.env.OPENAI_API_KEY)) {
    throw new Error('Writer smoke needs an available, unmasked model credential. No customer messages are sent.');
}
const fs = require('node:fs');
const realFetch = global.fetch;
global.fetch = (url, options) => {
    if (String(url) !== 'https://api.openai.com/v1/responses') throw new Error('Writer smoke blocked non-model request');
    return realFetch(url, options);
};
const context = require('../netlify/functions/_lib/client-context');
context.loadEditExamples = async () => '';
const {generateDraft, collectPaidMetaWriterContractIssues} = require('../netlify/functions/ig-instant-draft')._test;
const {CHALLENGE_FLOW,CHALLENGE_BOOKING_URL,collectChallengeLeadIssues} = require('../netlify/functions/_lib/plant-based-challenge-dm');
const scenarios = [
    {name:'known goal unrelated rapport',history:[{direction:'in',text:'I want to build muscle'},{direction:'out',text:'We can work training around your shifts.'}],message:'That sunset looks amazing!',forbidden:/https?:|book|challenge|\$125|muscle|strength|can help/i},
    {name:'prior refusal stays respected',history:[{direction:'in',text:'I want to get stronger'},{direction:'in',text:'Not now, I need time to think.'},{direction:'out',text:'No worries, take your time.'}],message:'I trained yesterday.',forbidden:/https?:|\?|book|challenge|when you|if you/i},
    {name:'explicit booking resend',history:[{direction:'out',text:`Choose a time here: ${CHALLENGE_BOOKING_URL}`}],message:'Can you resend the consultation booking link?',card:true},
    {name:'price across rapid batch',batch:[{text:'What does the $125 a week option include?'}],message:'Is the live workout half an hour?',required:[/125/,/30|half.an.hour/i],forbidden:/https?:|want me to/i},
    {name:'ordinary unusual goal',message:'I want to hike without getting puffed and need some help with a plan.',card:true},
    {name:'pain question has no sales pitch',message:'I want to get stronger but my knee is swollen and painful. What exercise will fix it?',forbidden:/https?:|book|challenge|\$125/i},
    {name:'unknown goal',message:'Can you tell me about the eight-week plant-based challenge?',forbidden:/\$|\/book|free.*preview/i},
    {name:'goal and support',message:'I want to get stronger. I work night shifts and need a plan I can keep doing.',required:[/shift|night/i,/training|workout|strength plan/i,/meal|food|nutrition/i],card:true},
    {name:'known goal no interrogation',history:[{direction:'in',text:'I want to build muscle, I am vegetarian and work nights.'},{direction:'out',text:'We can work training around those night shifts.'}],message:'Yeah, how can you help me with that?',card:true,forbidden:/what.{0,30}(?:goal|achieve)|how long.{0,20}(?:vegetarian|plant)/i},
    {name:'direct price',message:'How much does the eight-week challenge cost?',required:[/support|package|option/i],forbidden:/\$149|\$125.{0,20}(?:challenge|everyone)/i},
    {name:'optional live package',message:'What does the $125 a week option include?',required:[/125/,/30/,/weekly|week/,/live|1:1|one.on.one/i]},
    {name:'explicit Learn question',message:'What does Balance Learn cover within the challenge?',required:[/learn|course/i],forbidden:/\$|free.*preview/i},
    {name:'autonomy',history:[{direction:'in',text:'I want to lose weight'}],message:'Not now, I need time to think.',forbidden:/https?:|\?|\$|preview/i},
    {name:'already delivered card',history:[{direction:'in',text:'I want to get stronger'},{direction:'out',text:`Pick a consultation time here: ${CHALLENGE_BOOKING_URL}`}],message:'Thanks!',forbidden:/https?:|\$|preview/i},
    {name:'rapid messages and reciprocal',history:[{direction:'out',text:'What change would you like help with?'}],batch:[{text:'I want strength and I am vegetarian. Are you vegan?'}],message:'Food is the confusing bit and I work night shifts.',required:[/vegan/i,/food|meal/i,/shift|night/i],card:true},
];
(async()=>{
    const results=[];
    for (let sample=1; sample<=Number(process.env.CHALLENGE_SMOKE_REPEATS || 1); sample++) for (const acquisitionMode of ['organic_inbound','paid_meta']) for (const item of scenarios) {
        const history=(item.history||[]).map((message,index)=>({...message,created_at:new Date(Date.now()-(10-index)*60000).toISOString()}));
        const recentInboundMessages=(item.batch||[]).map((message,index)=>({...message,direction:'in',created_at:new Date(Date.now()-(30-index)*1000).toISOString()}));
        const draft=await generateDraft({leadName:'Fixture',leadBlock:'Synthetic unlinked coaching enquiry.',profileBlock:'',memoryBlock:'',history,currentMessage:item.message,recentInboundMessages,leadStage:'qualifying',channel:'instagram',igThreadId:null,linkedUserId:null,priorScheduledDrafts:[],linkedNudges:[],qualifier:{facts:{}},botAccount:'shan_n_sunny',acquisitionMode,adFlowVariant:CHALLENGE_FLOW});
        const text=draft.joined||'';
        const issues=collectPaidMetaWriterContractIssues({flowVariant:CHALLENGE_FLOW,draft,currentMessage:[...(item.batch||[]).map(x=>x.text),item.message].join('\n'),history});
        const failures=[...issues,...(draft.error?[draft.error]:[]),...(!text?['empty']:[]),...(item.required||[]).filter(r=>!r.test(text)).map(r=>'missing '+r),...(item.forbidden?.test(text)?['forbidden '+item.forbidden]:[]),...(item.card&&!text.includes(CHALLENGE_BOOKING_URL)?['missing booking card']:[])];
        results.push({sample,lane:acquisitionMode,name:item.name,reply:text,failures,model:draft.model});
        console.log(JSON.stringify(results.at(-1)));
        if (/\b(?:401|403)\b/.test(draft.error || '')) throw new Error('Model authorization failed; stopped without further requests.');
    }
    if(process.env.CHALLENGE_SMOKE_OUTPUT)fs.writeFileSync(process.env.CHALLENGE_SMOKE_OUTPUT,JSON.stringify(results,null,2));
    console.log(JSON.stringify({passed:results.filter(r=>!r.failures.length).length,total:results.length}));
    process.exitCode=results.some(r=>r.failures.length)?1:0;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
