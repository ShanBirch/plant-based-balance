// Bounded Stripe REST operations for the two coaching checkout routes. Native
// fetch keeps these modern-function bundles independent of runtime npm loading.
class StripeCheckoutClient {
 constructor(secret,{apiVersion}={}) {
  const request=async(path,method='GET',params=null,options={})=>{
   const headers={Authorization:`Bearer ${secret}`,'Stripe-Version':apiVersion};
   const init={method,headers};
   if(params){
    const body=new URLSearchParams();
    function append(key,value){
     if(value===undefined||value===null)return;
     if(Array.isArray(value))value.forEach((item,index)=>append(`${key}[${index}]`,item));
     else if(typeof value==='object')Object.entries(value).forEach(([child,item])=>append(`${key}[${child}]`,item));
     else body.append(key,String(value));
    }
    Object.entries(params).forEach(([key,value])=>append(key,value));
    headers['Content-Type']='application/x-www-form-urlencoded';init.body=body;
   }
   if(options.idempotencyKey)headers['Idempotency-Key']=options.idempotencyKey;
   const response=await fetch(`https://api.stripe.com/v1/${path}`,init);
   const result=await response.json();if(!response.ok)throw Error('Stripe checkout request failed');return result;
  };
  this.prices={retrieve:id=>request('prices/'+encodeURIComponent(id))};
  this.checkout={sessions:{create:(params,options)=>request('checkout/sessions','POST',params,options)}};
 }
}
module.exports=StripeCheckoutClient;
