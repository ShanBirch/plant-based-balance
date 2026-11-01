(function(){
 let owner=null,locked=true,pending=null;
 async function refresh(){
  const uid=window.currentUser?.id;if(!uid||!window.supabaseClient)return;
  if(pending||owner===uid)return pending;
  locked=true;pending=(async()=>{try{
   const session=await window.supabaseClient.auth.getSession();
   if(session.data?.session?.user?.id!==uid)return;
   const result=await window.supabaseClient.rpc('my_balance_courses_locked');
   if(window.currentUser?.id!==uid)return;
   if(result.error||typeof result.data!=='boolean')return;
   owner=uid;locked=result.data;
   window.dispatchEvent(new CustomEvent('balanceCourseAccessReady'));
   window.pbbNextSteps?.refresh?.();
   if(document.getElementById('view-learning')?.getClientRects().length)window.renderLearningHome?.();
  }catch{locked=true;}finally{pending=null;}})();return pending;
 }
 window.BalanceCourseAccess={ready:()=>owner===window.currentUser?.id,locked:()=>owner!==window.currentUser?.id||locked,refresh};
 window.addEventListener('pbbInitComplete',refresh);document.addEventListener('pbbInitComplete',refresh);window.addEventListener('focus',refresh);
 document.addEventListener('DOMContentLoaded',()=>{let count=0;const timer=setInterval(()=>{refresh();if(owner||++count>120)clearInterval(timer);},500);});
})();
