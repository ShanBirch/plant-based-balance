// Read-only playback monitor: no app login, user events, or production writes.
const fs = require('node:fs');
const path = require('node:path');
const modulePath = process.env.PBB_PLAYWRIGHT_MODULE || 'C:/Users/shann/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(modulePath);
(async () => {
  const response = await fetch('https://plantbased-balance.org/data/exercise-video-backups.json', {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Video monitor manifest HTTP ' + response.status);
  const manifest = await response.json();
  if (!Array.isArray(manifest) || manifest.length < 15) throw new Error('Incomplete monitored video list');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const results = [];
  try {
    for (let i=0; i<manifest.length; i+=3) await Promise.all(manifest.slice(i,i+3).map(async item => {
      for (const source of ['primary','backup']) {
        const url = new URL(item[source], 'https://plantbased-balance.org').href;
        if (!['plantbased-balance.org','f005.backblazeb2.com'].includes(new URL(url).hostname)) throw new Error('Unapproved media host');
        let result;
        for (let attempt=0; attempt<2; attempt++) {
          const page = await browser.newPage();
          try {
            await page.setContent('<video muted playsinline></video>');
            result = await page.evaluate(async url => {
              const video=document.querySelector('video'); video.src=url;
              const check=async()=>{
                await video.play();
                await new Promise(resolve=>setTimeout(resolve,500));
                if (video.currentTime<=0 || video.videoWidth<=0) throw Error('No decoded frames');
                video.currentTime=Math.min(2,video.duration/2);
                await new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=()=>reject(Error('Seek failed'))});
                return {ok:true,duration:video.duration,width:video.videoWidth};
              };
              try {return await Promise.race([check(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Playback timed out')),15000))])}
              catch(error){return {ok:false,error:error.message,mediaCode:video.error?.code||0}}
            },url);
          } finally {await page.close()}
          if (result.ok) break;
        }
        results.push({name:item.name,source,...result});
      }
    }));
  } finally {await browser.close()}
  const report={checkedAt:new Date().toISOString(),tested:results.length,failures:results.filter(x=>!x.ok),results};
  const output=process.argv[2]||path.resolve('output/workout-video-health.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({tested:report.tested,failures:report.failures,report:output}));
  if(report.failures.length) process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1});
