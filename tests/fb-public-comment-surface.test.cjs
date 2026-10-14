const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
test('public commenter shares foreign mutex and leaves Story enrollment/quota alone',()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fb-comment-test-'));
 const root=path.join(profile,'.codex','facebook-personal-outreach');fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'state.json'),JSON.stringify({version:1,actions:[],holds:[]}));
 const call=(...args)=>spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/fb-public-comment-surface.cjs'),...args],{env:{...process.env,USERPROFILE:profile},encoding:'utf8',windowsHide:true});
 try {
  const owner=JSON.parse(call('acquire').stdout);assert.equal(owner.acquired,true);
  assert.equal(JSON.parse(call('acquire').stdout).acquired,false);
  assert.notEqual(call('release','foreign-token').status,0);
  const input=path.join(profile,'input.json');
  fs.writeFileSync(input,JSON.stringify({id:'db-attempt',recipient:'https://www.facebook.com/fixture',source:'https://www.facebook.com/fixture/posts/123/',text:'Fixture never sent',evidence:'fixture.txt'}));
  assert.equal(call('reserve',owner.token,input).status,0);
  assert.notEqual(call('reserve',owner.token,input).status,0);
  const state=JSON.parse(fs.readFileSync(path.join(root,'state.json')));
  assert.equal(state.actions[0].kind,'public_comment');assert.equal(state.actions[0].status,'reserved');
  assert.equal(state.actions.filter(a=>a.kind==='story').length,0);
  assert.equal(call('release',owner.token).status,0);
  assert.equal(fs.existsSync(path.join(root,'owner.json')),false);
 } finally {fs.rmSync(profile,{recursive:true,force:true});}
});
