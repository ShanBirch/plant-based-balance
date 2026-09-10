const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
function extract(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
test('Back can revisit a known profile answer without bouncing forward', () => {
 const ctx = { wizardChatStarted:true, wizardChatComplete:false, wizardChatStepIndex:3, wizardChatAskToken:0,
  WIZARD_CHAT_STEPS:[{key:'start'},{key:'gender'},{key:'name'},{key:'age'}],
  wizardChatAnswers:{gender:'female',name:'Fresh',age:34}, wizardChatFreeformAnswers:{},
  skipWizardChatKnownProfileSteps(){ctx.wizardChatStepIndex++;},
  getWizardChatStep(){return ctx.WIZARD_CHAT_STEPS[ctx.wizardChatStepIndex];},
  getWizardChatInitialMultiSelection(){return [];}, appendWizardChatQuestion(){},
  renderWizardChatMessages(){},renderWizardChatProgress(){},renderWizardChatControls(){},rebuildWizardChatMessagesUntil(){} };
 vm.runInNewContext(extract('function askWizardChatQuestion(', 'function initializeWizardChatIntake('),ctx);
 vm.runInNewContext(extract('function goBackWizardChatQuestion(', 'function selectWizardChatChoice('),ctx);
 ctx.goBackWizardChatQuestion();
 assert.equal(ctx.wizardChatStepIndex,2);assert.equal(ctx.wizardChatAnswers.name,'Fresh');
 assert.equal(ctx.wizardChatAnswers.age,undefined);
 ctx.goBackWizardChatQuestion();assert.equal(ctx.wizardChatStepIndex,1);
});
test('normal forward entry still auto-fills known profile answers',()=>{
 assert.match(source,/if \(!options.revisit\) skipWizardChatKnownProfileSteps\(\)/);
 assert.match(source,/askWizardChatQuestion\(\{ instant: true, revisit: true \}\)/);
 assert.doesNotThrow(()=>new Function(source));
});
