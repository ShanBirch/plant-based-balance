// Share the existing personal Facebook surface lock, without adopting its chats
// or its Story quota. Database RPCs remain authoritative for comment attempts.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(process.env.USERPROFILE,'.codex','facebook-personal-outreach');
const lock=path.join(root,'owner.json');
const read=()=>JSON.parse(fs.readFileSync(lock,'utf8'));
function main() {
 const [cmd,token,input]=process.argv.slice(2),now=Date.now();
 if(cmd==='acquire') {
  const owner={token:crypto.randomUUID(),role:'public_comments',created:now,expires:now+9*60000};
  try {fs.writeFileSync(lock,JSON.stringify(owner),{flag:'wx'});}
  catch(e){if(e.code!=='EEXIST')throw e;const old=read();console.log(JSON.stringify({acquired:false,reason:old.expires>now?'owned':'stale_owner_requires_review'}));return;}
  console.log(JSON.stringify({acquired:true,...owner}));return;
 }
 const owner=read();
 if(owner.token!==token||owner.role!=='public_comments')throw Error('Exact public comment surface owner required');
 if(cmd==='release') {
  fs.appendFileSync(path.join(root,'lease-history.jsonl'),JSON.stringify({...owner,released:now,expired:now>=owner.expires})+'\n');
  fs.unlinkSync(lock);console.log('{"released":true}');return;
 }
 if(now>=owner.expires)throw Error('Expired surface; no browser work');
 if(cmd==='check'){console.log('{"owned":true}');return;}
 const data=JSON.parse(fs.readFileSync(input,'utf8'));
 const file=path.join(root,'state.json'),state=JSON.parse(fs.readFileSync(file,'utf8'));
 if(cmd==='reserve'||cmd==='reserve-reply') {
  for(const k of ['id','recipient','source','text','evidence'])if(typeof data[k]!=='string'||!data[k])throw Error('Missing '+k);
  const reactive=cmd==='reserve-reply';
  if(reactive) {
   const parent=state.actions.find(a=>a.id===data.root_attempt_id&&a.kind==='public_comment'&&a.status==='confirmed'&&!a.reactive_reply);
   if(!parent||!/^facebook:comment:[0-9]+$/.test(data.source)||data.source!==`facebook:comment:${data.inbound_comment_id}`||data.database_reserved!==true)
    throw Error('Verified original comment, exact inbound and database reservation required');
  }
  if(state.holds.some(h=>h.recipient===data.recipient)||state.actions.some(a=>a.recipient===data.recipient&&
   (a.status==='reserved'||(now-a.created<7*86400000&&!(reactive&&a.status==='confirmed'&&
    (a.id===data.root_attempt_id||(a.reactive_reply&&a.root_attempt_id===data.root_attempt_id)))))))throw Error('Shared Facebook person hold or recent touch');
  if(state.actions.some(a=>a.id===data.id||a.source===data.source))throw Error('Shared exact source already reserved');
  state.actions.push({...data,reactive_reply:reactive,kind:'public_comment',role:'public_comments',status:'reserved',created:now});
 } else if(cmd==='confirm') {
  const a=state.actions.find(a=>a.id===data.id&&a.kind==='public_comment'&&a.status==='reserved');
  if(!a||!data.evidence||!data.outbound)throw Error('Exact reserved comment and native proof required');
  a.status='confirmed';a.confirmed=now;a.proof=data.evidence;a.outbound=data.outbound;
 } else throw Error('Unknown operation');
 const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2));fs.renameSync(temp,file);
 console.log(JSON.stringify({saved:true,id:data.id}));
}
try{main();}catch(e){console.error(e.message);process.exitCode=1;}
