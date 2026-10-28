import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {planRelationshipChecks,recordRelationshipCheck,returningTrial} from './story-relationship-priority.mjs';
export function applyRelationshipObservation(state,input) {
  const checks=recordRelationshipCheck(state.checks??{},input);
  const username=Object.keys(checks).find(key=>checks[key]!==state.checks?.[key]);
  const event={...input,username};
  const key=`${username}|${input.checked_at}|${input.check_method??'one_profile_check'}`;
  const events=[...(state.events??[])];
  if(!events.some(e=>e.observation_key===key)) events.push({...event,observation_key:key});
  return {...state,version:1,checks,events,trial:returningTrial,
    returning_cursor:input.audience==='returning_bc'?username:state.returning_cursor??null};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [operation,inputPath]=process.argv.slice(2);
  if(!['plan','record'].includes(operation)||!inputPath) throw new Error('Use plan or record with actual private input JSON');
  const statePath=path.join(path.dirname(fileURLToPath(import.meta.url)),'story-relationship-priority-state.json');
  let state={version:1,checks:{},events:[],returning_cursor:null,trial:returningTrial};
  try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const input=JSON.parse(await fs.readFile(inputPath,'utf8'));
  if(operation==='plan') process.stdout.write(JSON.stringify(planRelationshipChecks({...input,checks:state.checks,observations:state.events,returningCursor:state.returning_cursor})));
  else {
    state=applyRelationshipObservation(state,input);
    const temporary=statePath+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(state,null,2),'utf8');
    await fs.rename(temporary,statePath);
    process.stdout.write(JSON.stringify({recorded:true,checks:Object.keys(state.checks).length,observations:state.events.length}));
  }
}
