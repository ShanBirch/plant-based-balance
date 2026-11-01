(function(){
 const coach='00a6605e-8edb-4917-85ba-24a23f179059';let pending=null,owner=null,ready=false;
 async function ensure(){
  const uid=window.currentUser?.id;if(!uid||uid===coach||!window.supabaseClient)return null;
  if(owner!==uid){owner=uid;ready=false;pending=null;}if(ready)return true;if(pending)return pending;
  pending=(async()=>{try{const session=await window.supabaseClient.auth.getSession();if(session.data?.session?.user?.id!==uid)return null;
   const result=await window.supabaseClient.rpc('ensure_balance_inbox_welcome');
   if(window.currentUser?.id!==uid||result.error)return null;
   ready=!!result.data;return result.data;
  }catch{return null;}finally{pending=null;}})();return pending;
 }
 async function open(){await ensure();if(typeof window.openDirectMessage!=='function')return false;
  window.openDirectMessage(coach,'Coach Shannon','assets/coach_shannon.jpg');return true;
 }
 window.BalanceInboxWelcome={ensure,open};
 function retry(){let tries=0;const timer=setInterval(async()=>{if(await ensure()||++tries>=8)clearInterval(timer);},2500);}
 window.addEventListener('pbbOnboardingComplete',retry);window.addEventListener('pbbInitComplete',retry);window.addEventListener('online',retry);window.addEventListener('focus',()=>ensure());
})();
