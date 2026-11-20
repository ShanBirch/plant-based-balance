(() => {
    const accountId = "b8d2b28a-5efd-42d3-882b-3b3ab3230a03";
    const freeUntil = Date.parse("2026-11-22T20:05:00+10:00");
    let dialog;
    let checking = false;

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

    function showGate(auth) {
        if (dialog?.open) return;
        dialog = document.createElement("dialog");
        dialog.style.cssText = "position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;box-sizing:border-box;overflow:auto;padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));background:#f8f0df;color:#272219;text-align:center;font:1rem system-ui";
        dialog.setAttribute("aria-labelledby", "continuation-title");
        dialog.innerHTML = `<div style="max-width:28rem;margin:clamp(2rem,14vh,10rem) auto">
            <p style="color:#785726;letter-spacing:.18em">BALANCE</p>
            <h1 id="continuation-title">Keen to keep coaching with Shannon?</h1>
            <p>Your free month has wrapped up. Continue coaching to unlock your workouts and keep your progress going.</p>
            <button type="button" data-checkout style="background:#272219;color:#fff;border:0;border-radius:10px;padding:14px 18px;font:inherit" disabled>Continue coaching · A$14.99/week</button>
            <p style="font-size:.9rem">Billed weekly until cancelled.</p>
            <p role="status">Checking your membership…</p>
            <button type="button" data-retry>Check payment status</button>
            <button type="button" data-signout>Sign out</button>
        </div>`;
        dialog.addEventListener("cancel", event => event.preventDefault());
        dialog.querySelector("[data-retry]").onclick = () => check(auth);
        dialog.querySelector("[data-signout]").onclick = async () => {
            const { error } = await auth.signOut();
            if (!error) location.reload();
        };
        dialog.querySelector("[data-checkout]").onclick = async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                const { data } = await auth.getSession();
                const result = await request(data.session, true);
                if (result.unlocked) {
                    closeGate();
                } else if (result.url) {
                    location.assign(result.url);
                }
            } catch (error) {
                dialog.querySelector("[role=status]").textContent = error.message;
            } finally {
                button.disabled = false;
            }
        };
        document.body.append(dialog);
        dialog.showModal();
    }

    function closeGate() {
        dialog?.close();
        dialog?.remove();
        dialog = null;
    }

    async function check(auth) {
        if (checking) return;
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
        check(auth);
        auth.onAuthStateChange(() => setTimeout(() => check(auth), 0));
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) check(auth);
        });
        const delay = freeUntil - Date.now();
        if (delay > 0 && delay <= 2147483647) setTimeout(() => check(auth), delay);
    }

    if (document.readyState === "complete") initialize();
    else window.addEventListener("load", initialize, { once: true });
})();