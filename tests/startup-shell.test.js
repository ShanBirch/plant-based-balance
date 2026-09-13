const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-startup-shell.js'), 'utf8');
function setup() {
    const attributes = {};
    const children = [];
    const overlay = { style: {}, classList: { remove() {} }, replaceChildren() { children.length = 0; }, append(...items) { children.push(...items); } };
    const document = { documentElement: { setAttribute(k,v) { attributes[k]=v; } }, querySelectorAll() { return [{sheet:{},media:''}]; }, getElementById() { return overlay; }, createElement() { return {style:{}}; } };
    const window = { location:{reload(){ window.reloaded=true; }}, weeklyGoals:{getState(){return {week:{},loading:false};}}, socialJourney: { refresh: async()=>true }, pbbNextSteps:{refreshStatus:async()=>{},refresh(){window.rendered=true;}} };
    vm.runInNewContext(source,{window,document,Date,Promise,setTimeout,clearTimeout,requestAnimationFrame:fn=>setTimeout(fn,0)});
    return {window,attributes,children,overlay};
}
test('Home remains guarded until async saved state and rendering settle',async()=>{
    const ctx=setup(); let resolve;
    ctx.window.socialJourney.refresh=()=>new Promise(r=>{resolve=r;});
    const ready=ctx.window.BalanceStartupShell.prepare();
    await new Promise(r=>setTimeout(r,5));
    assert.equal(ctx.attributes['data-pbb-shell-ready'],undefined);
    assert.equal(ctx.window.rendered,undefined);
    resolve(true); await ready; ctx.window.BalanceStartupShell.reveal();
    assert.equal(ctx.window.rendered,true);
    assert.equal(ctx.attributes['data-pbb-shell-ready'],'true');
});
test('failed saved setup offers retry without exposing legacy Home',async()=>{
    const ctx=setup();ctx.window.socialJourney.refresh=async()=>false;
    await assert.rejects(ctx.window.BalanceStartupShell.prepare(),/saved Home setup/);
    ctx.window.BalanceStartupShell.fail();
    assert.equal(ctx.attributes['data-pbb-shell-ready'],undefined);
    assert.equal(ctx.children[1].textContent,'Retry');ctx.children[1].onclick();
    assert.equal(ctx.window.reloaded,true);
});
test('startup awaits saved state and applies the shell gate before fade-out',()=>{
    const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
    const init=fs.readFileSync(path.join(root,'js/dashboard/dashboard-script-3-1_get_user_data.js'),'utf8');
    assert.ok(html.indexOf('html:not([data-pbb-shell-ready])')<html.indexOf('<body'));
    assert.match(html,/max\(42px, env\(safe-area-inset-top/);
    assert.doesNotMatch(init,/if \(fastStartupEligible\)/);
    assert.match(init,/await runStartupDataRefresh\(\)/);
    assert.ok(init.indexOf('await window.BalanceStartupShell.prepare()')<init.indexOf('window.BalanceStartupShell.reveal()'));
});
