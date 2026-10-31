(async()=>{
 const status=document.getElementById('replay-status');
 try{
  const key='sb-hzapaorxqboevxnumxkv-auth-token';let session;
  try{session=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(!session?.access_token){location.replace('/login.html?redirect='+encodeURIComponent('/dashboard.html?onboarding_replay=1'));return;}
  const auth=await fetch('/.netlify/functions/coaching-support-preview?replay=1',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
  if(!auth.ok)throw Error(auth.status===403?'This walkthrough requires Shannon’s own administrator login. Sign out of the test account and sign in as Shannon.':'Please sign in to your own Balance account again.');
  const access=await auth.json();if(access.adminPreview!==true)throw Error('Administrator verification required.');
  const source=await fetch('/dashboard.html',{cache:'no-store'});if(!source.ok)throw Error('Balance could not load. Please retry.');
  const frame=document.createElement('iframe');frame.title='Actual Balance onboarding, preview only';frame.setAttribute('sandbox','allow-scripts');
  const csp="default-src "+location.origin+" https: data: blob:; script-src "+location.origin+" https: 'unsafe-inline' 'unsafe-eval' blob:; style-src "+location.origin+" https: 'unsafe-inline'; img-src "+location.origin+" https: data: blob:; connect-src 'none'; form-action 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'";
  // Opaque-origin iframe: it cannot access this page's account storage, cookies,
  // real session or parent DOM. Only reviewed static GET assets cross the bridge.
  window.addEventListener('message',async event=>{
   if(event.source!==frame.contentWindow||event.data?.type!=='balance_preview_asset'||!event.ports[0])return;
   const port=event.ports[0];try{const url=new URL(event.data.path,location.origin);
    if(url.origin!==location.origin||/\/(?:api|\.netlify)\//.test(url.pathname)||! /\.(?:json|js|css|glb|gltf|png|jpe?g|webp|svg|mp4|mp3|woff2?)(?:$)/i.test(url.pathname))throw Error('Preview only');
    const result=await fetch(url,{method:'GET',credentials:'omit'});const data=await result.arrayBuffer();port.postMessage({status:result.status,contentType:result.headers.get('content-type'),data},[data]);
   }catch{port.postMessage({status:503,error:'Preview only. This request was not sent.'});}finally{port.close();}
  });
  const html=await source.text();frame.srcdoc=html.replace(/<head>/i,'<head><base href="'+location.origin+'/"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><script src="/js/dashboard/pbb-onboarding-replay-sandbox.js?v=20261101-v1"></script>');
  document.body.replaceChildren(frame);
 }catch(error){status.textContent=error.message;const login=document.createElement('a');login.href='/login.html?switch_account=1&redirect='+encodeURIComponent('/dashboard.html?onboarding_replay=1');login.textContent='Sign in as Shannon';status.append(document.createElement('br'),login);}
})();
