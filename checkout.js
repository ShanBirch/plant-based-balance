// checkout.js - Stripe Integration Logic

console.log(`
%c STRIPE INTEGRATION ACTIVE
`, 'font-weight: bold; color: #48864B; font-size: 14px;');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Stripe
    const stripe = Stripe('pk_live_51GmycUCGCyRUsOfK9lOtnZNvinxCcjf7rZnpC0ter8eShFPATzVKB7ypy2BPQbMRkuWT67mf04tjzvu18jQvmlZX00BvlGLyds');

    // Helper to get cookies
    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };

    // 2. Define Product Pricing
    // Real Price IDs created on User's Stripe Account
    const PRICES = {
        '1-month': 'price_1SkDKhCGCyRUsOfKdi44QCWi', 
        '3-month': 'price_1SkDKiCGCyRUsOfKcb3Wm9O3',
        '6-month': 'price_1SkDKjCGCyRUsOfKQDGEmmkv' 
    };

    // 4. One-Click Payment Logic (Apple Pay / Google Pay)
    // Dynamic Pricing based on Timer Extension / Scarcity
    const isDiscounted = sessionStorage.getItem('is_discounted') !== 'false';
    const PLAN_DETAILS = isDiscounted ? {
        '1-month': { amount: 4600, label: '28-Day Switch (1 Month)' },
        '3-month': { amount: 9300, label: '28-Day Switch (3 Months)' },
        '6-month': { amount: 10800, label: '28-Day Switch (6 Months)' }
    } : {
        '1-month': { amount: 9200, label: '28-Day Switch (1 Month) - Full Price' },
        '3-month': { amount: 18600, label: '28-Day Switch (3 Months) - Full Price' },
        '6-month': { amount: 21600, label: '28-Day Switch (6 Months) - Full Price' }
    };

    const paymentRequest = stripe.paymentRequest({
        country: 'AU',
        currency: 'aud',
        total: { label: 'Total', amount: 4600 }, // Use a real amount for the check
        requestPayerName: true,
        requestPayerEmail: true,
    });

    // Handle the actual payment (Thumbprint approved)
    paymentRequest.on('paymentmethod', async (ev) => {
        // 1. Send ID to backend to create subscription
        try {
            const response = await fetch('/.netlify/functions/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: ev.payerEmail,
                    name: ev.payerName,
                    paymentMethodId: ev.paymentMethod.id,
                    priceId: PRICES[currentSelectedPlan],
                    isDiscounted: isDiscounted,
                    fbc: getCookie('_fbc'),
                    fbp: getCookie('_fbp')
                })
            });

            const session = await response.json();

            if (session.error) {
                ev.complete('fail');
                alert("Payment Failed: " + session.error.message);
                return;
            }

            // 2. Confirm the Payment
            const confirmResult = await stripe.confirmCardPayment(
                session.clientSecret,
                { payment_method: ev.paymentMethod.id }
            );

            if (confirmResult.error) {
                ev.complete('fail');
                alert("Payment Confirmation Failed: " + confirmResult.error.message);
            } else {
                ev.complete('success');
                // Redirect to success page with dynamic amount and user info
                const amount = PLAN_DETAILS[currentSelectedPlan].amount / 100;
                const emailParam = encodeURIComponent(ev.payerEmail || '');
                const nameParam = encodeURIComponent(ev.payerName || '');
                window.location.href = `/success.html?amount=${amount}&email=${emailParam}&name=${nameParam}`;
            }

        } catch (err) {
            ev.complete('fail');
            console.error(err);
            alert("An error occurred. Please try again.");
        }
    });

    let currentSelectedPlan = '1-month'; // Default
    let walletAvailable = false;

    // Check Availability
    paymentRequest.canMakePayment().then(function(result) {
        console.log("Stripe Wallet Result:", result); 
        if (result) {
            walletAvailable = true;
            const btns = document.querySelectorAll('.checkout-btn');
            btns.forEach(btn => {
                const plan = btn.getAttribute('data-plan');
                const originalText = plan.replace('-', ' ').toUpperCase();
                
                // Determine the best label
                let walletLabel = "G-Pay"; // Default to G-Pay if result is true
                const ua = navigator.userAgent.toLowerCase();
                
                if (result.applePay) {
                    walletLabel = " Apple Pay";
                } else if (ua.includes('safari') && !ua.includes('chrome')) {
                    walletLabel = " Apple Pay";
                } else {
                    walletLabel = "G-Pay";
                }

                btn.innerHTML = `${originalText} <br/> <span style="font-size:0.8em; font-weight: 700;">Pay with ${walletLabel}</span>`;
            });
        }
    });

    // 5. Order Bump Logic
    const ACUPRESSURE_PRICE_ID = 'price_1SkOMQCGCyRUsOfKlgfmqUsP'; 
    const BUMP_AMOUNT = 900; // $9.00 in cents

    // 3. Attach Event Listeners to Buttons
    const checkoutButtons = document.querySelectorAll('.checkout-btn');
    
    checkoutButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const plan = btn.getAttribute('data-plan');
            currentSelectedPlan = plan; 
            
            const isBumpChecked = document.getElementById('order-bump-check')?.checked || false;
            const utmData = window.getUTMData ? window.getUTMData() : {};

            if (window.location.protocol === 'file:') {
                alert("Stripe Checkout requires a hosted environment.");
                return;
            }

            // CHECK TERMS FIRST
            const termsBox = document.getElementById('terms-checkbox');
            if (termsBox && !termsBox.checked) {
                alert("Please agree to the Terms & Conditions and Refund Policy to proceed.");
                
                // Highlight the box
                const container = document.getElementById('checkout-terms-container');
                if(container) {
                    container.style.border = "2px solid #ef4444";
                    container.style.background = "#fef2f2";
                    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Reset after 3s
                    setTimeout(() => {
                        container.style.border = "1px solid #e2e8f0";
                        container.style.background = "#f8fafc";
                    }, 3000);
                }
                return;
            }

            // B. If Wallet is available -> Force Wallet Flow
            if (walletAvailable) {
                const details = PLAN_DETAILS[plan];
                if (details) {
                    let totalAmount = details.amount;
                    let displayLabel = details.label;

                    if (isBumpChecked) {
                        totalAmount += BUMP_AMOUNT;
                        displayLabel += " + Acupressure Series";
                    }

                    // Update the request with the specific plan amount before showing
                    paymentRequest.update({
                        total: { label: displayLabel, amount: totalAmount }
                    });

                    if (typeof fbq === 'function') {
                        fbq('track', 'InitiateCheckout', {
                            content_name: displayLabel,
                            value: totalAmount / 100,
                            currency: 'AUD',
                            ...utmData
                        });
                    }
                    
                    console.log("Triggering Wallet Sheet for:", plan, isBumpChecked ? "+ Bump" : "");
                    try {
                        paymentRequest.show();
                        return;
                    } catch (e) {
                         console.error("Wallet Sheet Failed:", e);
                         // Fall out to Redirect
                    }
                }
            }

            // C. Fallback to Redirect
            const priceId = PRICES[plan];
            if (!priceId) return;

            const planData = PLAN_DETAILS[plan];
            let totalVal = planData.amount / 100;
            if (isBumpChecked) totalVal += 9;

            // Track Initiate Checkout for Meta
            if (typeof fbq === 'function' && planData) {
                fbq('track', 'InitiateCheckout', {
                    content_name: planData.label + (isBumpChecked ? " + Bump" : ""),
                    value: totalVal,
                    currency: 'AUD',
                    ...utmData
                });
            }

            // Prepare Line Items
            const lineItems = [{ price: priceId, quantity: 1 }];
            if (isBumpChecked) {
                lineItems.push({ price: ACUPRESSURE_PRICE_ID, quantity: 1 });
            }

            // Server-side CAPI InitiateCheckout 
            fetch('/.netlify/functions/track-lead', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: sessionStorage.getItem('userEmail'), 
                    event: 'InitiateCheckout',
                    value: totalVal,
                    utm_data: utmData,
                    fbc: getCookie('_fbc'),
                    fbp: getCookie('_fbp')
                })
            }).catch(() => {});

            const discounts = isDiscounted ? [{ coupon: 'rjrlOEdm' }] : [];

            const { error } = await stripe.redirectToCheckout({
                lineItems: lineItems,
                mode: 'subscription',
                discounts: discounts, 
                successUrl: window.location.origin + '/success.html?amount=' + totalVal + '&bump=' + isBumpChecked,
                cancelUrl: window.location.origin + '/plantbasedswitch.html',
                customerEmail: sessionStorage.getItem('userEmail'), // Pre-fill email from Quiz
                metadata: {
                    ...utmData,
                    order_bump: isBumpChecked ? "acupressure" : "none",
                    fbc: getCookie('_fbc'),
                    fbp: getCookie('_fbp')
                }
            });

            if (error) {
                console.error("Stripe Checkout Error:", error);
            }
        });
    });

    /**
     * SYNC CONVERSION (Optional)
     * You can call your webhook here to mark the lead as "Purchased" 
     * in your CRM so the abandoned cart emails stop immediately.
     */
});

