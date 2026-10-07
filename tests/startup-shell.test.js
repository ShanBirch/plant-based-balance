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
    const document = { documentElement: { setAttribute(k,v) { attributes[k]=v; } }, querySelectorAll(selector) { assert.match(selector,/dashboard-style-1\.css/); return [{sheet:{},media:''}]; }, getElementById() { return overlay; }, createElement() { return {style:{}}; } };
    const window = { location:{href:'https://plantbased-balance.org/dashboard.html?native_rev=1',replace(url){ window.reloaded=url; }}, weeklyGoals:{getState(){return {week:{},loading:false};}}, socialJourney: { refresh: async()=>true }, pbbNextSteps:{refreshStatus:async()=>{},refresh(){window.rendered=true;}} };
    vm.runInNewContext(source,{window,document,Date,URL,Promise,setTimeout,clearTimeout,requestAnimationFrame:fn=>setTimeout(fn,0)});
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
test('failed Home card does not trap an authenticated member behind Retry',async()=>{
    const ctx=setup();ctx.window.socialJourney.refresh=async()=>false;
    await ctx.window.BalanceStartupShell.prepare();
    assert.equal(ctx.window._pbbHomeRefreshDeferred,true);
    ctx.window.BalanceStartupShell.reveal();
    assert.equal(ctx.attributes['data-pbb-shell-ready'],'true');
});
test('critical failure Retry requests a fresh page and prevents double taps',()=>{
    const ctx=setup();
    ctx.window.BalanceStartupShell.fail();
    assert.equal(ctx.attributes['data-pbb-shell-ready'],undefined);
    assert.equal(ctx.children[1].textContent,'Retry');ctx.children[1].onclick();
    assert.match(ctx.window.reloaded,/startup_retry=\d+/);
    assert.match(ctx.window.reloaded,/native_rev=1/);
    assert.equal(ctx.children[1].disabled,true);
});

test('Home fetches independent state together but waits for the slower result',async()=>{
    for (const slow of ['journey', 'daily']) {
        const ctx=setup(); const started=[]; let release;
        const pending=new Promise(resolve=>{release=resolve;});
        ctx.window.socialJourney.refresh=()=>{started.push('journey');return slow==='journey'?pending:Promise.resolve(true);};
        ctx.window.pbbNextSteps.refreshStatus=()=>{started.push('daily');return slow==='daily'?pending:Promise.resolve();};
        const ready=ctx.window.BalanceStartupShell.prepare();
        await new Promise(resolve=>setTimeout(resolve,5));
        assert.deepEqual(started,['journey','daily']);
        assert.equal(ctx.window.rendered,undefined);
        release(true); await ready;
        assert.equal(ctx.window.rendered,true);
    }
});

test('failed daily state no longer blocks the Home reveal',async()=>{
    const ctx=setup();
    ctx.window.pbbNextSteps.refreshStatus=async()=>{throw new Error('daily state offline');};
    await ctx.window.BalanceStartupShell.prepare();
    assert.equal(ctx.window.rendered,true);
    assert.equal(ctx.window._pbbHomeRefreshDeferred,true);
    assert.equal(ctx.attributes['data-pbb-shell-ready'],undefined);
});

test('broken weekly widget state cannot escape the optional refresh boundary',async()=>{
    const ctx=setup();ctx.window.weeklyGoals.getState=()=>{throw Error('widget unavailable');};
    await ctx.window.BalanceStartupShell.prepare();
    assert.equal(ctx.window._pbbHomeRefreshDeferred,true);
});
test('hanging refresh and unavailable optional modules still allow startup',async()=>{
    const ctx=setup();ctx.window._pbbStartupRefreshTimeoutMs=15;
    ctx.window.socialJourney.refresh=()=>new Promise(()=>{});
    ctx.window.weeklyGoals.getState=()=>({week:{},loading:true});
    await ctx.window.BalanceStartupShell.prepare();
    assert.equal(ctx.window._pbbHomeRefreshDeferred,true);
    delete ctx.window.socialJourney;delete ctx.window.weeklyGoals;delete ctx.window.pbbNextSteps;
    await ctx.window.BalanceStartupShell.prepare();
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
