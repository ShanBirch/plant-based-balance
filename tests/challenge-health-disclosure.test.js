const test=require('node:test');const assert=require('node:assert/strict');
const {collectChallengeLeadIssues,resolveChallengeTurn}=require('../netlify/functions/_lib/plant-based-challenge-dm');
for(const text of ['Health issues','I have leperacy','Leprosy','I did a bicep curl and my finger fell off'])test('Health disclosure pauses sales: '+text,()=>{
 const history=[{direction:'in',text:'I want to get stronger'},{direction:'out',text:'What has been getting in the way?'}];
 assert.equal(resolveChallengeTurn({currentMessage:text,history}).support,true);
 assert.ok(collectChallengeLeadIssues({currentMessage:text,history,draft:{joined:'We can help. Want me to grab the booking link for you so we can tee up a call time?'}}).length);
 assert.equal(collectChallengeLeadIssues({currentMessage:text,history,draft:{joined:'Thanks for letting me know. Have you had any exercise guidance from your treating doctor?'}}).length,0);
});
test('Vague health issues cannot establish programme suitability',()=>assert.ok(collectChallengeLeadIssues({currentMessage:'Health issues',draft:{joined:'It’s built to work around health issues, so the training and food setup can be adjusted to what you can actually manage.'}}).length));
