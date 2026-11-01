(()=>{
 const button=document.getElementById('payment-method'),status=document.getElementById('payment-status');
 button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Loading payment settings...';
  try{
   if(!window.supabase)throw Error('Payment settings could not load. Please refresh and try again.');
   const client=window.supabase.createClient('https://hzapaorxqboevxnumxkv.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjA3MTYsImV4cCI6MjA4NDIzNjcxNn0.L8ZuxevbB1pNx2nXtIiiQ-6dZSeqfdGuiEvscljOxq0');
   const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('Please log in to manage your payment method.');
   const response=await fetch('/.netlify/functions/create-billing-portal-session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({returnUrl:location.origin+'/dashboard.html?tab=dashboard&settings_return=1'})});
   const result=await response.json();if(!response.ok||!result.url)throw Error(result.error||'No direct payment account was found. If you paid through Apple or Google, manage your payment in that store.');
   const url=new URL(result.url);if(url.protocol!=='https:'||!['billing.stripe.com','payments.stripe.com'].includes(url.hostname))throw Error('Payment settings returned an unexpected address. Please contact Shannon.');
   location.href=url.href;
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
})();
