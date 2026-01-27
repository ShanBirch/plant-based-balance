// checkout.js - Stripe Integration Logic

console.log(`
%c STRIPE INTEGRATION ACTIVE
`, 'font-weight: bold; color: #48864B; font-size: 14px;');

document.addEventListener('DOMContentLoaded', () => {
    // Store referral code from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
        sessionStorage.setItem('referralCode', referralCode);
        console.log('Referral code stored:', referralCode);
    }

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
    // Flat Pricing - no discount complexity
    const PLAN_DETAILS = {
        '1-month': { amount: 3000, label: 'Balance Membership (1 Month)' },      // $30 AUD
        '3-month': { amount: 7500, label: 'Balance Membership (3 Months)' },     // $75 AUD ($25/mo)
        '6-month': { amount: 12000, label: 'Balance Membership (6 Months)' }     // $120 AUD ($20/mo)
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
            const isTrial = (currentSelectedPlan === '6-month');
            const response = await fetch('/.netlify/functions/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: ev.payerEmail,
                    name: ev.payerName,
                    paymentMethodId: ev.paymentMethod.id,
                    priceId: PRICES[currentSelectedPlan],
                    isDiscounted: false, // Flat pricing, no discount
                    isTrial: isTrial, // Pass Trial Flag
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
                // Redirect to success page
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
        if (result) {
            walletAvailable = true;
            const btns = document.querySelectorAll('.checkout-btn');
            btns.forEach(btn => {
                const plan = btn.getAttribute('data-plan');
                const originalText = plan.replace('-', ' ').toUpperCase();
                
                let walletLabel = "G-Pay"; 
                const ua = navigator.userAgent.toLowerCase();
                
                if (result.applePay) {
                    walletLabel = " Apple Pay";
                } else if (ua.includes('safari') && !ua.includes('chrome')) {
                    walletLabel = " Apple Pay";
                } else {
                    walletLabel = "G-Pay";
                }

                // Don't override the "Start 7-Day Trial" text too aggressively
                if (plan === '6-month') {
                     btn.innerHTML = `START 7-DAY FREE TRIAL <br/> <span style="font-size:0.8em; font-weight: 700;">via ${walletLabel}</span>`;
                } else {
                     btn.innerHTML = `${originalText} <br/> <span style="font-size:0.8em; font-weight: 700;">Pay with ${walletLabel}</span>`;
                }
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
                const container = document.getElementById('checkout-terms-container');
                if(container) {
                    container.style.border = "2px solid #ef4444";
                    container.style.background = "#fef2f2";
                    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        container.style.border = "1px solid #e2e8f0";
                        container.style.background = "#f8fafc";
                    }, 3000);
                }
                return;
            }

            // B. If Wallet is available
            if (walletAvailable) {
                const details = PLAN_DETAILS[plan];
                if (details) {
                    let totalAmount = details.amount;
                    let displayLabel = details.label;

                    if (isBumpChecked) {
                        totalAmount += BUMP_AMOUNT;
                        displayLabel += " + Acupressure Series";
                    }

                    // Special Logic for Trial Display in Wallet Sheet
                    if (plan === '6-month') {
                        // For Wallet Sheet, showing $0.00 might be confusing if we don't setup "Recurring" display items correctly.
                        // But we CAN set total to $0 if there is no bump.
                        // If bump, set total to $9.
                        // Stripe Payment Request API handles 'recurring' line items if configured, but here we just request the initial charge.
                        if (!isBumpChecked) {
                            totalAmount = 0;
                            displayLabel = "7-Day Free Trial (Then $108)";
                        } else {
                            totalAmount = BUMP_AMOUNT;
                            displayLabel = "Acupressure Series (Trial Starts Now)";
                        }
                    }

                    paymentRequest.update({
                        total: { label: displayLabel, amount: totalAmount }
                    });
                    
                    try {
                        paymentRequest.show();
                        return;
                    } catch (e) {
                         console.error("Wallet Sheet Failed:", e);
                    }
                }
            }

            // C. Fallback to Redirect
            const priceId = PRICES[plan];
            if (!priceId) return;

            // Check for referral code - if present, give 14-day trial
            const urlParams = new URLSearchParams(window.location.search);
            const referralCode = urlParams.get('ref') || sessionStorage.getItem('referralCode');
            const hasReferral = !!referralCode;

            // NEW: 6-Month Plan uses Backend Session (for Trial)
            // OR any plan with referral code gets trial
            if (plan === '6-month' || hasReferral) {
                btn.innerText = hasReferral ? "Launching 2 Week Trial..." : "Launching Trial...";
                try {
                    const response = await fetch('/.netlify/functions/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            priceId: priceId,
                            isTrial: true,
                            trialDays: hasReferral ? 14 : 7, // 2 weeks for referrals, 1 week for 6-month
                            referralCode: referralCode || null,
                            email: sessionStorage.getItem('userEmail'),
                            bump: isBumpChecked,
                            utm_data: utmData,
                            fbc: getCookie('_fbc'),
                            fbp: getCookie('_fbp')
                        })
                    });
                    const session = await response.json();
                    if (session.error) {
                         alert("Checkout Error: " + session.error.message);
                         btn.innerText = "Try Again";
                    } else {
                         stripe.redirectToCheckout({ sessionId: session.sessionId });
                    }
                } catch (err) {
                    console.error("Backend Checkout Error", err);
                    alert("System Error. Please try again.");
                }
                return;
            }

            // EXISTING: 1 & 3 Month Plans use Client-Side Redirect (No Trial)
            const planData = PLAN_DETAILS[plan];
            let totalVal = planData.amount / 100;
            if (isBumpChecked) totalVal += 9;

            const lineItems = [{ price: priceId, quantity: 1 }];
            if (isBumpChecked) {
                lineItems.push({ price: ACUPRESSURE_PRICE_ID, quantity: 1 });
            }

            // CAPI
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

            // Flat pricing - no discount coupons needed
            const { error } = await stripe.redirectToCheckout({
                lineItems: lineItems,
                mode: 'subscription', 
                successUrl: window.location.origin + '/success.html?amount=' + totalVal + '&bump=' + isBumpChecked,
                cancelUrl: window.location.origin + '/plantbasedswitch.html',
                customerEmail: sessionStorage.getItem('userEmail'),
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

