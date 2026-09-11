(function () {
    'use strict';
    let active = null, loadedUser = null, completed = new Set();
    async function load() {
        const user = window.currentUser?.id;
        if (loadedUser !== user) { completed = new Set(); loadedUser = user; }
        if (!user) throw new Error('Sign in to load reflections.');
        const result = await window.supabaseClient.from('lesson_reflections').select('lesson_id').eq('user_id',user);
        if (result.error) { completed = new Set(); throw new Error('Could not load your quiz reflections. Please retry.'); }
        if (window.currentUser?.id !== user) throw new Error('Your account changed.');
        completed = new Set((result.data || []).map(row=>row.lesson_id));
    }
    window.BalanceLessonReflections = {
        load, has: id => loadedUser === window.currentUser?.id && completed.has(id),
        async open(context) {
            const client = window.supabaseClient;
            const userId = window.currentUser?.id;
            if (!client || !userId || !context.lessonId || context.score !== 100 || active) return;
            const content = document.getElementById('learning-content');
            const resultElement = content?.querySelector('[data-lesson-result]');
            const title = String(context.lessonTitle || 'Your lesson').slice(0, 300);
            const token = {};
            active = token;
            try {
                const { data, error } = await client.from('lesson_reflections').select('lesson_id')
                    .eq('user_id', userId).eq('lesson_id', context.lessonId).maybeSingle();
                if (window.currentUser?.id !== userId) return;
                if (data) { if(loadedUser !== userId) {completed = new Set(); loadedUser = userId;} completed.add(context.lessonId); return; }
                if (!context.required && (error || (content && !resultElement?.isConnected))) return;
                await new Promise(resolve => {
                    const previousFocus = document.activeElement;
                    const overlay = document.createElement('div');
                    overlay.id = 'lesson-reflection-popup';
                    overlay.innerHTML = `<style>
                    #lesson-reflection-popup{--lr-paper:#fffcf4;--lr-ink:#20251f;--lr-muted:#64685e;--lr-line:#a79b80;--lr-error:#a13225;--lr-gold:var(--pbb-luxe-gold,#d8b25e);--lr-top:env(safe-area-inset-top,0px);--lr-bottom:env(safe-area-inset-bottom,0px);position:fixed;inset:0;z-index:100130;display:flex;align-items:center;justify-content:center;padding:calc(20px + var(--lr-top)) 20px calc(20px + var(--lr-bottom));box-sizing:border-box;background:rgba(20,25,20,.45);backdrop-filter:blur(5px);font-family:Inter,system-ui,sans-serif}
                    html[data-pbb-theme="dark"] #lesson-reflection-popup,html.pbb-theme-dark #lesson-reflection-popup,body[data-pbb-theme="dark"] #lesson-reflection-popup,body.dark-mode #lesson-reflection-popup{--lr-paper:#181b19;--lr-ink:#f8f1e4;--lr-muted:#c5bfb3;--lr-line:#827b6c;--lr-error:#ffad9e}
                    #lesson-reflection-popup *{box-sizing:border-box;color:var(--lr-ink)!important;-webkit-text-fill-color:currentColor!important;font-family:Inter,system-ui,sans-serif!important}
                    #lesson-reflection-popup .lr-card{width:100%;max-width:390px;max-height:100%;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:var(--lr-paper);border:1px solid var(--lr-line);border-radius:24px;padding:24px;box-shadow:0 18px 60px #0003}
                    #lesson-reflection-popup .lr-kicker{font-size:11px;letter-spacing:.08em;color:var(--lr-muted)!important}
                    #lesson-reflection-popup h2{font:700 28px/1.2 Inter,system-ui,sans-serif;margin:12px 0}
                    #lesson-reflection-popup .lr-lesson{font-size:13px;color:var(--lr-muted)!important;overflow-wrap:anywhere;margin:0 0 20px}
                    #lesson-reflection-popup label{display:block;font-size:15px;line-height:1.5;margin-bottom:10px}
                    #lesson-reflection-popup textarea{display:block;width:100%;min-height:120px;max-height:220px;resize:vertical;border:1px solid var(--lr-line);border-radius:12px;padding:12px;font:400 16px/1.5 Inter,system-ui,sans-serif;background:var(--lr-paper)}
                    #lesson-reflection-popup textarea::placeholder{color:var(--lr-muted)!important;-webkit-text-fill-color:var(--lr-muted)!important;opacity:1}
                    #lesson-reflection-popup .lr-help{font-size:12px;line-height:1.5;color:var(--lr-muted)!important;margin:10px 0}
                    #lesson-reflection-popup .lr-error{font-size:14px;color:var(--lr-error)!important;line-height:1.4}
                    #lesson-reflection-popup .lr-actions{display:flex;gap:10px;margin-top:18px}
                    #lesson-reflection-popup button{flex:1;min-height:46px;border-radius:12px;border:1px solid var(--lr-line);background:var(--lr-paper);font:600 14px Inter,system-ui,sans-serif;padding:10px;cursor:pointer}
                    #lesson-reflection-popup button[type="submit"]{background:var(--lr-gold)!important;color:#211b10!important;-webkit-text-fill-color:#211b10!important;border-color:var(--lr-gold)}
                    #lesson-reflection-popup button:disabled{opacity:.75;cursor:wait}
                    #lesson-reflection-popup button[type="submit"]:hover:not(:disabled){background:var(--pbb-luxe-gold-light,#f5d98a)!important}
                    #lesson-reflection-popup textarea{caret-color:var(--lr-ink)}
                    @media(max-width:600px),(max-height:500px){#lesson-reflection-popup{--lr-top:max(42px,env(safe-area-inset-top,0px));--lr-bottom:max(20px,env(safe-area-inset-bottom,0px));padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
                    #lesson-reflection-popup :focus-visible{outline:3px solid #a58a45;outline-offset:3px}
                    </style><form class="lr-card" role="dialog" aria-modal="true" aria-labelledby="lr-title">
                    <div class="lr-kicker">100% · QUIZ COMPLETE</div><h2 id="lr-title">Make it yours</h2><p class="lr-lesson"></p>
                    <label for="lr-answer">What’s one thing you learned, and how could you use it?</label>
                    <textarea id="lr-answer" maxlength="2000" placeholder="A thought, a takeaway, or something to try…"></textarea>
                    <p class="lr-help">${context.required ? 'Required before continuing.' : 'Optional.'} Saved with this lesson for you and your coach. Not posted to the Feed.</p>
                    <p class="lr-error" role="status" aria-live="polite"></p>
                    <div class="lr-actions"><button type="button" data-skip ${context.required ? 'hidden' : ''}>Not now</button><button type="submit">Save reflection</button></div></form>`;
                    overlay.querySelector('.lr-lesson').textContent = title;
                    const form = overlay.querySelector('form');
                    const answer = overlay.querySelector('textarea');
                    const save = form.querySelector('[type="submit"]');
                    const skip = form.querySelector('[data-skip]');
                    const status = form.querySelector('.lr-error');
                    let saving = false;
                    function close() {
                        overlay.remove();
                        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
                        resolve();
                    }
                    skip.onclick = () => { if (!saving && !context.required) close(); };
                    overlay.onkeydown = event => {
                        if (event.key === 'Escape' && !saving && !context.required) { event.preventDefault(); close(); }
                        if (event.key === 'Tab') {
                            const nodes = [answer, skip, save].filter(el => !el.disabled && !el.hidden);
                            const first = nodes[0], last = nodes[nodes.length - 1];
                            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                        }
                    };
                    form.onsubmit = async event => {
                        event.preventDefault();
                        if (saving) return;
                        const reflection = answer.value.trim();
                        if (reflection.length < 3) { status.textContent = 'Write what you learned and how you could use it.'; answer.focus(); return; }
                        saving = true; save.disabled = skip.disabled = true; save.textContent = 'Saving…'; status.textContent = '';
                        try {
                            if (window.currentUser?.id !== userId) throw new Error('session_changed');
                            const row = { user_id: userId, lesson_id: context.lessonId, lesson_title: title,
                                unit_id: context.unitId || null, course_id: context.courseId || null, reflection_text: reflection };
                            const { error: writeError } = await client.from('lesson_reflections').upsert(row, { onConflict: 'user_id,lesson_id' });
                            if (writeError) throw writeError;
                            const { data: saved, error: readError } = await client.from('lesson_reflections').select('reflection_text')
                                .eq('user_id', userId).eq('lesson_id', context.lessonId).single();
                            if (readError || saved?.reflection_text !== reflection) throw readError || new Error('not_verified');
                            if(loadedUser !== userId) {completed = new Set(); loadedUser = userId;} completed.add(context.lessonId);
                            close();
                            if (typeof window.showToast === 'function') window.showToast('Reflection saved', 'success');
                        } catch (_) {
                            status.textContent = 'Your reflection hasn’t been confirmed saved. Your text is still here. Try again when connected.';
                        } finally { saving = false; save.disabled = skip.disabled = false; save.textContent = 'Save reflection'; }
                    };
                    document.body.appendChild(overlay);
                    // Keep the keyboard closed until they choose to write.
                    (context.required ? save : skip).focus({ preventScroll: true });
                });
            } catch (_) {
                // A reflection lookup must never stop lesson completion or activation.
            } finally { if (active === token) active = null; }
        }
    };
})();
