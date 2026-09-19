const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-15.js'), 'utf8');
const battle = fs.readFileSync(path.join(__dirname, '../js/dashboard/pbb-deferred-battle.js'), 'utf8');

function setup(policy) {
    const storage = new Map();
    const timers = [];
    const elements = new Map();
    function model() {
        const attrs = new Map([['id', 'tamagotchi-model'], ['src', '/old.glb']]);
        const listeners = new Map();
        return {
            style: {}, className: '', classList: { add() {} }, parentNode: parent,
            get attributes() { return [...attrs].map(([name,value]) => ({name,value})); },
            getAttribute: key => attrs.get(key), setAttribute: (key,value) => attrs.set(key,value),
            removeAttribute: key => attrs.delete(key),
            addEventListener: (name,fn) => listeners.set(name,fn),
            removeEventListener: name => listeners.delete(name),
            load() { listeners.get('load')?.(); }
        };
    }
    const parent = { removeChild() {}, appendChild(el) { elements.set('tamagotchi-model',el); } };
    elements.set('tamagotchi-model', model());
    const ctx = {
        _pbbIsIOSSafari: true, console: {log(){},warn(){}},
        localStorage: {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
        document: {getElementById:id=>elements.get(id)||null,createElement:model},
        navigator: {userAgent:'iPhone AppleWebKit'}, customElements: {get:()=>true},
        setTimeout(fn,ms) { timers.push({fn,ms}); }, requestAnimationFrame:fn=>fn(),
        fetch:async()=>({}), showToast(){},
        applyCharacterColors(){ctx.colored=(ctx.colored||0)+1;},
        applyIdleAnimation(){ctx.animated=(ctx.animated||0)+1;}
    };
    ctx.window = ctx;
    if (policy) ctx.pbbShouldApplyCharacterColorsToModel = policy;
    vm.createContext(ctx);
    vm.runInContext(source,ctx);
    return {ctx,elements,timers};
}

test('iPhone early colour checks finish before deferred battle code arrives', () => {
    const {ctx} = setup();
    assert.equal(ctx.pbbShouldApplyCharacterColorsToModel('/baby.glb'),true);
    assert.equal(ctx.pbbShouldApplyCharacterColorsToModel('/79.glb?pbb_model_v=1#x'),false);
    assert.equal(ctx.pbbShouldApplyCharacterColorsToModel('/baby.glb','level_character_2'),false);
    for (let i=0;i<100;i++) assert.equal(ctx.pbbShouldApplyCharacterColorsToModel('/baby.glb'),true);
});

test('real iPhone hot-swap load callback reaches animation and completion', async () => {
    const {ctx,elements,timers} = setup();
    let completed = 0;
    ctx.iosHotSwapModel('/baby.glb',()=>completed++);
    await Promise.resolve();
    timers.find(timer=>timer.ms===1500).fn();
    elements.get('tamagotchi-model').load();
    assert.equal(ctx.colored,1);
    assert.equal(ctx.animated,1);
    assert.equal(completed,1);
    assert.equal(ctx._pbbSwapInProgress,false);
});

test('desktop skin load callback can resolve the same policy', () => {
    const {ctx,elements} = setup();
    ctx._pbbIsIOSSafari=false;
    ctx.selectEvolutionSkin('/baby.glb','Baby');
    elements.get('tamagotchi-model').load();
    assert.equal(ctx.colored,1);
    assert.equal(ctx.animated,1);
});

test('deferred policy replaces fallback and preserves custom material allowlist', () => {
    const {ctx} = setup();
    const early = ctx.pbbShouldApplyCharacterColorsToModel;
    // Execute the actual battle policy declarations, without unrelated game startup.
    vm.runInContext(battle.slice(battle.indexOf('    function _pbbHasCustomizableColorMapping'),battle.indexOf('    // Sound System')),ctx);
    assert.notEqual(ctx.pbbShouldApplyCharacterColorsToModel,early);
    assert.equal(early('/baby.glb'),true);
    assert.equal(early('/optimus.glb'),false);
    assert.equal(early('/1.glb'),false);
});

test('battle-first load order retains the existing policy', () => {
    const calls = [];
    const policy = (...args) => { calls.push(args); return false; };
    const {ctx,elements} = setup(policy);
    ctx._pbbIsIOSSafari = false;
    ctx.selectEvolutionSkin('/optimus.glb','Robot');
    elements.get('tamagotchi-model').load();
    assert.equal(ctx.pbbShouldApplyCharacterColorsToModel,policy);
    assert.deepEqual(calls,[['/optimus.glb']]);
    assert.equal(ctx.colored,undefined);
    assert.equal(ctx.animated,1);
});

test('rare model load still completes without recolouring original textures', async () => {
    const {ctx,elements,timers} = setup();
    let completed = false;
    ctx.iosHotSwapModel('/79.glb?v=1',()=>completed=true,{skinId:'level_character_79'});
    await Promise.resolve();
    timers.find(timer=>timer.ms===1500).fn();
    elements.get('tamagotchi-model').load();
    assert.equal(ctx.colored,undefined);
    assert.equal(ctx.animated,1);
    assert.equal(completed,true);
});

test('native SceneKit path keeps its existing model handoff', () => {
    const {ctx} = setup();
    let loaded, completed = false;
    ctx._pbbNativeViewerAvailable = true;
    ctx.NativeCharacterViewer = {isActive:()=>true,loadModel:src=>loaded=src};
    ctx.iosHotSwapModel('/baby.glb',()=>completed=true);
    assert.equal(loaded,'/baby.glb');
    assert.equal(completed,true);
    assert.equal(ctx.colored,undefined);
});
