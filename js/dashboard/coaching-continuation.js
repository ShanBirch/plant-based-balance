(() => {
    const accountId = "b8d2b28a-5efd-42d3-882b-3b3ab3230a03";
    const freeUntil = Date.parse("2026-11-22T20:05:00+10:00");
    let dialog;
    let checking = false;
    let openingCheckout = false;

    async function request(session, checkout = false) {
        const response = await fetch("/api/coaching-continuation", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ checkout }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
    }

    function showGate(auth, preview = false) {
        if (dialog?.open) return;
        dialog = document.createElement("dialog");
        dialog.id = "coaching-continuation-dialog";
        dialog.setAttribute("aria-labelledby", "continuation-title");
        dialog.innerHTML = `<style>
            #coaching-continuation-dialog {
                position: fixed;
                inset: 0;
                margin: auto;
                width: min(26rem, calc(100vw - 2rem));
                height: fit-content;
                max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem);
                box-sizing: border-box;
                overflow: auto;
                padding: clamp(1.25rem, 5vw, 2rem);
                border: 1px solid #b59154;
                border-radius: 1.25rem;
                background: #f8f0df;
                color: #272219;
                -webkit-text-fill-color: #272219;
                text-align: center;
                font: 1rem/1.5 system-ui, sans-serif;
                box-shadow: 0 16px 50px #19150f44;
            }
            #coaching-continuation-dialog::backdrop { background: #19150f77; }
            #coaching-continuation-dialog h1 { margin: .4rem 0; font-size: 1.65rem; line-height: 1.15; }
            #coaching-continuation-dialog p { margin: .75rem 0; }
            #coaching-continuation-dialog [data-checkout] {
                width: 100%; padding: .8rem; border: 0; border-radius: .65rem;
                background: #272219; color: #fff; -webkit-text-fill-color: #fff; font: inherit;
            }
            #coaching-continuation-dialog [data-checkout]:disabled { opacity: .65; }
            #coaching-continuation-dialog [role=status]:empty { display: none; }
            #coaching-continuation-dialog [data-retry], #coaching-continuation-dialog [data-signout] {
                background: transparent; border: 0; padding: .5rem; font: inherit; text-decoration: underline;
            }
        </style>
            <h1 id="continuation-title">Keen to keep coaching with Shannon?</h1>
            <p>Your free month has wrapped up. Continue coaching to unlock your workouts and keep your progress going.</p>
            <button type="button" data-checkout disabled>Continue coaching · A$14.99/week</button>
            <p style="font-size:.9rem">Billed weekly until cancelled.</p>
            <p role="status">Checking your membership…</p>
            <button type="button" data-retry>Check payment status</button>
            <button type="button" data-signout>Sign out</button>`;
        dialog.addEventListener("cancel", event => event.preventDefault());
        dialog.querySelector("[data-retry]").onclick = () => check(auth);
        dialog.querySelector("[data-signout]").onclick = async () => {
            const { error } = await auth.signOut();
            if (!error) location.reload();
        };
        dialog.querySelector("[data-checkout]").onclick = async event => {
            if (preview) {
                dialog.querySelector("[role=status]").textContent = "On Joanne’s account, this opens Stripe Checkout for A$14.99 per week.";
                return;
            }
            const button = event.currentTarget;
            openingCheckout = true;
            button.disabled = true;
            try {
                const { data } = await auth.getSession();
                const result = await request(data.session, true);
                if (result.unlocked) {
                    closeGate();
                } else if (result.url) {
                    const url = new URL(result.url);
                    if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) {
                        throw new Error("Stripe returned an unexpected address.");
                    }
                    const browser = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Browser;
                    if (browser?.open) await browser.open({ url: url.href });
                    else location.assign(url.href);
                }
            } catch (error) {
                const status = dialog?.querySelector("[role=status]");
                if (status) status.textContent = error.message;
            } finally {
                openingCheckout = false;
                button.disabled = false;
            }
        };
        if (preview) {
            dialog.querySelector("[data-checkout]").disabled = false;
            dialog.querySelector("[role=status]").textContent = "Coach preview";
            dialog.querySelector("[data-retry]").onclick = () => {
                dialog.querySelector("[role=status]").textContent = "Balance checks the subscription when Joanne returns from Stripe.";
            };
            const close = dialog.querySelector("[data-signout]");
            close.textContent = "Close preview";
            close.onclick = closeGate;
        }
        document.body.append(dialog);
        dialog.showModal();
    }

    function closeGate() {
        dialog?.close();
        dialog?.remove();
        dialog = null;
    }

    async function check(auth) {
        if (checking || openingCheckout) return;
        checking = true;
        try {
            const { data } = await auth.getSession();
            const session = data?.session;
            if (session?.user?.id !== accountId || Date.now() < freeUntil) {
                closeGate();
                return;
            }
            showGate(auth);
            const result = await request(session);
            if (result.unlocked) {
                closeGate();
                return;
            }
            dialog.querySelector("[role=status]").textContent = "";
            dialog.querySelector("[data-checkout]").disabled = false;
        } catch (error) {
            if (dialog) dialog.querySelector("[role=status]").textContent = error.message;
        } finally {
            checking = false;
        }
    }

    function initialize() {
        const auth = window.supabaseClient?.auth;
        if (!auth) return;
        if (window.isAdminViewing) {
            if (window.currentUser?.id === accountId && new URLSearchParams(location.search).get("preview_renewal") === "1") {
                showGate(auth, true);
            }
            return;
        }
        check(auth);
        auth.onAuthStateChange(() => setTimeout(() => check(auth), 0));
        window.addEventListener("focus", () => check(auth));
        if (window.Capacitor?.isNativePlatform?.()) {
            window.Capacitor.Plugins?.Browser?.addListener?.("browserFinished", () => check(auth));
        }
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) check(auth);
        });
        const delay = freeUntil - Date.now();
        if (delay > 0 && delay <= 2147483647) setTimeout(() => check(auth), delay);
    }

    if (window._appCriticalContentReady) initialize();
    else window.addEventListener("appCriticalContentReady", initialize, { once: true });
})();
