const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
test('regular FCM tap uses app launcher and retains check-in data', async () => {
 const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
 const account={project_id:'qa',client_email:'test@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 let sent;
 const module={exports:{}};
 const scope={module,exports:module.exports,Buffer,console:{log(){},warn(){},error(){}},process:{env:{}},
  require(id){
   if(id==='web-push')return {};
   if(id==='crypto')return crypto;
   if(id==='./_lib/client-context')return {normalizeCoachDraftText:v=>v};
   if(id==='./_lib/firebase-service-account')return {loadFirebaseServiceAccount:async()=>account};
   if(id==='./_lib/ig-dispatch-approval-token')return {};
   if(id==='./_lib/business-scorecard-token')return {};
   throw Error(id);
  },
  fetch:async(url,options)=>{
   if(url.includes('oauth2.googleapis.com'))return {ok:true,json:async()=>({access_token:'test-only'})};
   sent=JSON.parse(options.body).message;
   return {ok:true,json:async()=>({name:'test-message'})};
  }
 };
 vm.runInNewContext(fs.readFileSync('netlify/functions/send-dm-notification.js','utf8'),scope);
 await module.exports.__test.sendNativePush('test-token',{title:'Check-in ready',body:'Tap to open',data:{type:'client_checkin_ready',url:'/dashboard.html?checkin=ready'}});
 assert.equal(Object.hasOwn(sent.android.notification,'click_action'),false);
 assert.equal(sent.data.type,'client_checkin_ready');
 assert.equal(sent.data.url,'/dashboard.html?checkin=ready');
 assert.equal(sent.notification.title,'Check-in ready');
 const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 assert.ok(manifest.includes('android.intent.category.LAUNCHER'));
 await module.exports.__test.sendNativePush('test-token',{title:'Coach',body:'Draft',data:{type:'coach_draft_ready'}});
 assert.equal(sent.notification,undefined,'coach inline reply must remain data-only');
});
