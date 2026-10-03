const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const scope = {};
vm.createContext(scope);
vm.runInContext(source.slice(source.indexOf('function getPrescribedSetPrefill('), source.indexOf('function getDateBasedCustomProgramWeekNumber(')), scope);
test('coach load and reps override differing historical sets and persist without history', () => {
  const target = scope.getPrescribedSetPrefill({reps:'12 each side', prescribedWeightKg:5}, false);
  for (const history of [{kg:'7',reps:'8'}, {kg:'',reps:'10'}, null]) {
    const result = scope.mergeSetPrefill(history, target);
    assert.equal(result.kg, '5'); assert.equal(result.reps, '12'); assert.equal(result.explicitLoad, true);
  }
});
test('bodyweight zero overrides bogus historical loads; invalid loads preserve legacy behavior', () => {
  assert.equal(scope.mergeSetPrefill({kg:'.1'}, scope.getPrescribedSetPrefill({reps:'10', prescribedWeightKg:0},false)).kg, '0');
  for (const load of [undefined,null,'',-1,'unknown']) {
    assert.equal(scope.mergeSetPrefill({kg:'10',reps:'8'},scope.getPrescribedSetPrefill({reps:'12',prescribedWeightKg:load},false)).kg,'10');
  }
  assert.equal(scope.mergeSetPrefill({kg:'10',reps:'8'},scope.getPrescribedSetPrefill({reps:'12'},false)).reps,'8');
  assert.equal(scope.mergeSetPrefill({kg:'.1',time:'20'},scope.getPrescribedSetPrefill({reps:'30 sec',prescriptionClearsHistoricalLoad:true},true)).time,'30');
});
