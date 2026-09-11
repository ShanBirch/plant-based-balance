(() => {
 if (!window.supabase) { document.getElementById('account-status').textContent='Account services could not load. Please refresh and try again.'; return; }
 const client = window.supabase.createClient('https://hzapaorxqboevxnumxkv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjA3MTYsImV4cCI6MjA4NDIzNjcxNn0.L8ZuxevbB1pNx2nXtIiiQ-6dZSeqfdGuiEvscljOxq0');
 const el = id => document.getElementById(id);
 function signedOut() { el('account-content').hidden=true; el('account-login').hidden=false; el('account-status').textContent=''; }
 async function init() {
  try {
   const {data, error}=await client.auth.getSession(); if(error) throw error;
   if(!data.session) { signedOut(); return; }
   const result=await client.auth.getUser(); if(result.error) throw result.error;
   const user=result.data.user; if(!user){signedOut();return;}
   el('account-name').textContent=user.user_metadata?.full_name || user.user_metadata?.name || 'Balance member';
   el('account-email').textContent=user.email || '';
   el('account-login').hidden=true; el('account-content').hidden=false; el('account-status').textContent='';
   await loadMembership();
  } catch { el('account-status').textContent='We could not load your account. Please log in again.'; el('account-login').hidden=false; }
 }
 el('account-logout').addEventListener('click',async()=>{el('account-logout').disabled=true;try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;signedOut();}catch{el('account-status').textContent='Could not log out. Please try again.';}finally{el('account-logout').disabled=false;}});

 const money = cents => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
 const date = seconds => new Date(seconds*1000).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});
 const add=(parent,tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;parent.append(node);return node;};
 async function api(body){const {data}=await client.auth.getSession();if(!data.session)throw new Error('Please log in again.');const response=await fetch('/.netlify/functions/change-membership',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Please try again.');return result;}
 async function loadMembership(){
  const host=el('membership-options');host.textContent='Loading membership options…';
  try{const data=await api();host.replaceChildren();if(!data.subscriptions.length)add(host,'p',data.message||'No active Stripe membership was found. Contact Shannon if you need help linking your plan.');
   for(const s of data.subscriptions){add(host,'h3',s.name);if(s.scheduled){add(host,'p','Scheduled: '+s.scheduled.name+' from '+date(s.scheduled.effectiveAt)+'. Cancelling or pausing removes this scheduled change.');continue;}if(!s.options.length)add(host,'p','Contact Shannon to arrange a change for this membership.');
    for(const p of s.options){const row=add(host,'div','','membership-option');add(row,'h3',p.name);add(row,'p',money(p.unitAmount)+' / week · '+p.commitmentWeeks+'-week minimum');const button=add(row,'button','Review this change','account-button');button.type='button';button.onclick=()=>review(s.id,p.token,button);}
   }
  }catch(error){host.textContent=error.message;}
 }
 async function review(subscriptionId,token,button){button.disabled=true;const host=el('membership-review');host.hidden=false;host.textContent='Loading your price and start date…';
  try{const {quote:q,quoteId}=await api({action:'preview',subscriptionId,token});host.replaceChildren();add(host,'h3',q.name);add(host,'p',money(q.unitAmount)+' weekly from '+date(q.effectiveAt)+'.');add(host,'p','Nothing to pay today. Your current plan continues until then. No overlapping membership or mid-period charge.');add(host,'p',q.disclosure);add(host,'p','New minimum total: '+money(q.minimumTotal)+'. Your new minimum term starts on '+date(q.effectiveAt)+'.');const label=add(host,'label','');const check=document.createElement('input');check.type='checkbox';label.append(check);add(label,'span','I agree to the new price, minimum term and cancellation terms.');const confirm=add(host,'button','Confirm membership change','account-button');confirm.type='button';confirm.disabled=true;check.onchange=()=>confirm.disabled=!check.checked;const back=add(host,'button','Keep my current plan','account-link');back.type='button';back.onclick=()=>{host.hidden=true;button.focus();};confirm.onclick=async()=>{confirm.disabled=true;back.disabled=true;check.disabled=true;try{await api({action:'confirm',subscriptionId,token,quoteId,accepted:true});host.replaceChildren();add(host,'h3','Your change is scheduled');add(host,'p',q.name+' starts on '+date(q.effectiveAt)+'.');await loadMembership();}catch(error){host.replaceChildren();add(host,'p',error.message+' Refresh this page to check the latest membership status.');}};host.focus();
  }catch(error){host.textContent=error.message;}finally{button.disabled=false;}
 }
 init();
})();