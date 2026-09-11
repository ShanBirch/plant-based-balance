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
  } catch { el('account-status').textContent='We could not load your account. Please log in again.'; el('account-login').hidden=false; }
 }
 el('account-logout').addEventListener('click',async()=>{el('account-logout').disabled=true;try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;signedOut();}catch{el('account-status').textContent='Could not log out. Please try again.';}finally{el('account-logout').disabled=false;}});
 init();
})();