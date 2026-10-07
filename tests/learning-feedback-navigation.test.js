const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('lib/learning-inline.js','utf8');
const helper=source.slice(source.indexOf('    function dismissGameFeedback('),source.indexOf('    window.retryCurrentGameAfterFeedback'));
function fixture(){
    let finish,called=0;
    const state={currentLesson:{id:'menopause-1-1'},currentGameIndex:0,currentView:'game'};
    const context={learningState:state,document:{getElementById:()=>({style:{},remove(){}})},setTimeout:f=>finish=f};
    vm.runInNewContext(helper,context);
    context.dismissGameFeedback(()=>called++);
    return {state,finish:()=>finish(),called:()=>called};
}
test('feedback continues the same question after dismissal',()=>{const f=fixture();f.finish();assert.equal(f.called(),1);});
test('returning to the course prevents delayed feedback from reopening a quiz',()=>{const f=fixture();f.state.currentView='courseDetail';f.finish();assert.equal(f.called(),0);});
test('switching lessons prevents the old feedback from advancing the new lesson',()=>{const f=fixture();f.state.currentLesson={id:'mind-1-1'};f.finish();assert.equal(f.called(),0);});
