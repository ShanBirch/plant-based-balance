// checkout.js - Payment Integration Logic
// Web (website): Stripe | iOS (App Store): Apple IAP | Android (Play Store): Google Play Billing

console.log(`
%c PAYMENT INTEGRATION ACTIVE
`, 'font-weight: bold; color: #48864B; font-size: 14px;');

document.addEventListener('DOMContentLoaded', () => {
    const LEGAL_DOCUMENT_VERSIONS = {
        terms: '2026-05-19',
        privacy: '2026-05-19',
        client_agreement: '2026-05-19',
        refund_policy: '2026-05-19'
    };

    const getComplianceSessionId = () => {
        const key = 'balance_compliance_session_id';
        let id = sessionStorage.getItem(key);
        if (!id) {
            const randomPart = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            id = `web-${randomPart}`;
            sessionStorage.setItem(key, id);
        }
        return id;
    };

    const getStoredUserProfile = () => {
        try {
            return JSON.parse(sessionStorage.getItem('userProfile') || '{}');
        } catch (error) {
            return {};
        }
    };

    const buildCompliancePayload = (eventType, extra = {}) => {
        const profile = getStoredUserProfile();
        const email = extra.email || sessionStorage.getItem('userEmail') || profile.email || '';
        const name = extra.name || profile.name || '';
        const sourcePage = window.location.pathname || 'checkout';
        return {
            event_type: eventType,
            source_page: sourcePage,
            email,
            name,
            plan_key: extra.plan_key || extra.planKey || '',
            accepted: {
                terms: true,
                privacy: true,
                client_agreement: true,
                refund_policy: true
            },
            marketing_consent: Boolean(profile.marketing_consent || profile.email_marketing_consent),
            health_data_consent: true,
            document_versions: LEGAL_DOCUMENT_VERSIONS,
            profile,
            screening: {
                safety_notes: profile.health_screening_notes || ''
            },
            metadata: {
                compliance_session_id: getComplianceSessionId(),
                page_title: document.title,
                ...extra.metadata
            },
            idempotency_key: extra.idempotency_key || `${getComplianceSessionId()}:${eventType}:${extra.plan_key || extra.planKey || 'unknown'}`
        };
    };

    const recordComplianceEvent = async (eventType, extra = {}) => {
        try {
            const response = await fetch('/.netlify/functions/record-compliance-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildCompliancePayload(eventType, extra))
            });
            if (!response.ok) {
                console.warn('[Compliance] Record failed:', response.status);
                return null;
            }
            return await response.json();
        } catch (error) {
            console.warn('[Compliance] Record failed:', error);
            return null;
        }
    };

    window.BalanceCompliance = {
        record: recordComplianceEvent,
        getContext: (eventType, extra = {}) => buildCompliancePayload(eventType, extra)
    };

    // Store referral code from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
        sessionStorage.setItem('referralCode', referralCode);
        console.log('Referral code stored:', referralCode);
    }

    // ─── Native App Store / Play Store: use IAP ────────────────────────
    const isNative = window.Platform && window.Platform.isNative();

    if (isNative) {
        console.log('[Checkout] Native platform detected - using In-App Purchase');

        // Initialize IAP
        if (window.NativeIAP) {
            window.NativeIAP.initialize();
        }

        // Override checkout buttons for native IAP
        const checkoutButtons = document.querySelectorAll('.checkout-btn');
        checkoutButtons.forEach(btn => {
            // Update button label for native
            const plan = btn.getAttribute('data-plan');
            if (plan === '6-month' || plan === '1-month') {
                btn.innerHTML = `START COACHING <br/> <span style="font-size:0.8em; font-weight: 700;">Subscribe via ${window.Platform.isIOS() ? 'App Store' : 'Play Store'}</span>`;
            }

            btn.addEventListener('click', async (e) => {
                e.preventDefault();

                // CHECK TERMS FIRST
                const termsBox = document.getElementById('terms-checkbox');
                if (termsBox && !termsBox.checked) {
                    alert("Please agree to the Terms, Privacy Policy, Client Agreement and Refund Policy to proceed.");
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

                await recordComplianceEvent('native_checkout_attempt', {
                    plan_key: plan,
                    metadata: {
                        platform: window.Platform.isIOS() ? 'ios' : 'android'
                    }
                });

                btn.innerText = "Loading...";
                try {
                    const result = await window.purchaseSubscription();
                    if (result && !result.cancelled) {
                        window.location.href = '/success.html?amount=29.99&source=iap';
                    } else if (result && result.cancelled) {
                        btn.innerHTML = `START COACHING <br/> <span style="font-size:0.8em; font-weight: 700;">Subscribe via ${window.Platform.isIOS() ? 'App Store' : 'Play Store'}</span>`;
                    }
                } catch (err) {
                    console.error("IAP Error:", err);
                    alert("Purchase failed. Please try again.");
                    btn.innerText = "Try Again";
                }
            });
        });

        return; // Skip all Stripe setup on native
    }

    // ─── Web (website download): use Stripe ────────────────────────────
    console.log('[Checkout] Web platform - using Stripe');

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
    // Hosted Checkout creates the selected recurring price server-side.
    // Keep a truthy plan token here so legacy client-side checks still pass.
    const PRICES = {
        '1-month': 'balance_starter_coaching_weekly',
        'app-monthly': 'balance_app_community_monthly',
        'coaching-calls': 'balance_coaching_calls_weekly',
        'founders-pass': 'balance_vegan_founders_pass'
    };

    // 4. One-Click Payment Logic (Apple Pay / Google Pay)
    // Flat Pricing - no discount complexity
    const PLAN_DETAILS = {
        '1-month': { amount: 2999, label: 'Balance Starter Coaching', successPlan: 'starter_weekly' },
        'app-monthly': { amount: 1999, label: 'Balance App + Community', successPlan: 'app_community_monthly' },
        'coaching-calls': { amount: 9999, label: 'Balance Coaching + Calls', successPlan: 'coaching_calls_weekly' },
        'founders-pass': { amount: 8999, label: 'Balance Foundations Founders Pass', successPlan: 'balance_foundations_six_week' }
    };

    const paymentRequest = stripe.paymentRequest({
        country: 'AU',
        currency: 'aud',
        total: { label: 'Total', amount: 2999 }, // Use a real amount for the check
        requestPayerName: true,
        requestPayerEmail: true,
    });

    // Handle the actual payment (Thumbprint approved)
    paymentRequest.on('paymentmethod', async (ev) => {
        // 1. Send ID to backend to create subscription
        try {
            await recordComplianceEvent('wallet_payment_authorized', {
                plan_key: currentSelectedPlan,
                email: ev.payerEmail,
                name: ev.payerName,
                metadata: {
                    payment_method_type: ev.paymentMethod?.type || 'wallet'
                }
            });

            const response = await fetch('/.netlify/functions/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: ev.payerEmail,
                    name: ev.payerName,
                    paymentMethodId: ev.paymentMethod.id,
                    priceId: PRICES[currentSelectedPlan],
                    isDiscounted: false, // Flat pricing, no discount
                    isTrial: false,
                    fbc: getCookie('_fbc'),
                    fbp: getCookie('_fbp'),
                    compliance: window.BalanceCompliance?.getContext('wallet_payment_authorized', {
                        plan_key: currentSelectedPlan,
                        email: ev.payerEmail,
                        name: ev.payerName
                    })
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
                const successPlan = PLAN_DETAILS[currentSelectedPlan].successPlan;
                const emailParam = encodeURIComponent(ev.payerEmail || '');
                const nameParam = encodeURIComponent(ev.payerName || '');
                window.location.href = `/success.html?amount=${amount}&plan=${encodeURIComponent(successPlan)}&email=${emailParam}&name=${nameParam}`;
            }

        } catch (err) {
            ev.complete('fail');
            console.error(err);
            alert("An error occurred. Please try again.");
        }
    });

    let currentSelectedPlan = '1-month';
    let walletAvailable = false;

    // Check Availability
    paymentRequest.canMakePayment().then(function(result) {
        if (result) {
            walletAvailable = true;
            const btns = document.querySelectorAll('.checkout-btn');
            btns.forEach(btn => {
                if (btn.dataset.hostedCheckoutOnly === 'true') return;
                const plan = btn.getAttribute('data-plan');
                let walletLabel = "G-Pay";
                const ua = navigator.userAgent.toLowerCase();

                if (result.applePay) {
                    walletLabel = " Apple Pay";
                } else if (ua.includes('safari') && !ua.includes('chrome')) {
                    walletLabel = " Apple Pay";
                } else {
                    walletLabel = "G-Pay";
                }

                // Keep wallet labels aligned with the current paid weekly offer.
                if (plan === '6-month') {
                     btn.innerHTML = `START COACHING <br/> <span style="font-size:0.8em; font-weight: 700;">via ${walletLabel}</span>`;
                } else {
                     btn.innerHTML = `START COACHING <br/> <span style="font-size:0.8em; font-weight: 700;">Pay with ${walletLabel}</span>`;
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
                alert("Please agree to the Terms, Privacy Policy, Client Agreement and Refund Policy to proceed.");
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

            const checkoutReferralCode = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('referralCode');
            await recordComplianceEvent('checkout_attempt', {
                plan_key: plan,
                metadata: {
                    order_bump: isBumpChecked ? 'acupressure' : 'none',
                    wallet_available: walletAvailable,
                    referral_code: checkoutReferralCode || null,
                    utm_data: utmData
                }
            });

            // B. If Wallet is available
            // An order bump needs two server-created line items. Use hosted Checkout
            // for that case; Stripe Checkout still offers Apple Pay/Google Pay.
            if (walletAvailable && btn.dataset.hostedCheckoutOnly !== 'true' && !isBumpChecked) {
                const details = PLAN_DETAILS[plan];
                if (details) {
                    paymentRequest.update({
                        total: { label: details.label, amount: details.amount }
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

            // Referrals are tracked, but the starter coaching offer charges today.
            const urlParams = new URLSearchParams(window.location.search);
            const referralCode = checkoutReferralCode || urlParams.get('ref') || sessionStorage.getItem('referralCode');
            btn.innerText = "Launching Checkout...";
            try {
                const response = await fetch('/.netlify/functions/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        priceId: priceId,
                        isTrial: false,
                        trialDays: 0,
                        referralCode: referralCode || null,
                        email: sessionStorage.getItem('userEmail'),
                        bump: isBumpChecked,
                        utm_data: utmData,
                        fbc: getCookie('_fbc'),
                        fbp: getCookie('_fbp'),
                        returnPath: window.location.pathname,
                        pageVariant: document.body?.dataset?.landingVariant || 'general',
                        compliance: window.BalanceCompliance?.getContext('checkout_session_created', {
                            plan_key: plan,
                            metadata: {
                                order_bump: isBumpChecked ? 'acupressure' : 'none',
                                referral_code: referralCode || null,
                                utm_data: utmData
                            }
                        })
                    })
                });
                const session = await response.json();
                if (session.error) {
                     window.trackBalanceEvent?.('checkout_error', { plan, message: session.error.message });
                     alert("Checkout Error: " + session.error.message);
                     btn.innerText = "Try Again";
                } else {
                     window.trackBalanceEvent?.('checkout_started', { plan, session_id: session.sessionId });
                     stripe.redirectToCheckout({ sessionId: session.sessionId });
                }
            } catch (err) {
                window.trackBalanceEvent?.('checkout_error', { plan, message: err?.message || 'request_failed' });
                console.error("Backend Checkout Error", err);
                alert("System Error. Please try again.");
            }
            return;

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
