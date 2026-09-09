const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = require('node:fs').readFileSync(require('node:path').join(__dirname,'../dashboard.html'),'utf8');
const start = html.indexOf('    if (step && step.requiresWorkoutBrowse) {');
const gate = html.slice(start,html.indexOf('    if (step && step.requiresHighlightedClick)',start));
function setup(count,index=0){
 let current=index, update, disconnected=false;
 const cards=Array.from({length:count},(_,i)=>({classList:{contains:()=>i===current}}));
 const ctx={step:{requiresWorkoutBrowse:true},idx:4,finalLabel:'Next',activeTourGate:null,Set,Array,document:{getElementById:()=>({querySelectorAll:()=>cards})},q:()=>({}),scheduleTourPosition:()=>{},setTourGateUi:(complete,message)=>{ctx.result={complete,message}},MutationObserver:class{constructor(fn){update=fn}observe(){}disconnect(){disconnected=true}}};
 vm.runInNewContext('(function(){'+gate+'})()',ctx);
 return {ctx,visit(i){current=i;update()},cleanup(){ctx.activeTourGate.cleanup();return disconnected}};
}
test('workout browsing requires distinct visible exercises and handles reverse navigation',()=>{
 const p=setup(4);assert.equal(p.ctx.result.complete,false);
 p.visit(0);assert.equal(p.ctx.result.complete,false);
 p.visit(3);assert.equal(p.ctx.result.complete,false);assert.equal(p.ctx.step.sel,'#workout-swipe-prev');
 p.visit(2);assert.equal(p.ctx.result.complete,false);
 p.visit(1);assert.equal(p.ctx.result.complete,true);assert.equal(p.cleanup(),true);
});
test('workout browse handles one exercise, missing data, and starting in the middle',()=>{
 assert.equal(setup(1).ctx.result.complete,true);
 assert.equal(setup(0,-1).ctx.result.complete,false);
 const p=setup(3,1);p.visit(2);assert.equal(p.ctx.result.complete,false);p.visit(0);assert.equal(p.ctx.result.complete,true);
});
