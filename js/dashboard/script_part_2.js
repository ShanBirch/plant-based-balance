// On iOS Safari: defer Supabase CDN (~170KB) + lib/supabase.js (111KB) + lib/auth-guard.js
// to AFTER DOMContentLoaded. During body parsing (19,000+ lines of HTML) those 280KB of JS
// were keeping memory at the iOS Jetsam limit, causing OOM crashes at
// scripts_model_viewer_DEFERRED_ios. Non-iOS loads synchronously as before.
if (window._pbbIsIOSSafari) {
    if(window._crumb)window._crumb('scripts_supabase_DEFERRED_ios');
    // Stripe/html2canvas still deferred to pbbInitComplete (same policy as before)
    window._pbbDeferredScripts = ['https://js.stripe.com/v3/', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];
    window.addEventListener('pbbInitComplete', function() {
        window._pbbDeferredScripts.forEach(function(src, i) {
            setTimeout(function() {
                var s = document.createElement('script');
                s.src = src;
                document.head.appendChild(s);
            }, (i + 1) * 3000);
        });
    }, { once: true });
    // Stub: queue any native Android OAuth callback that arrives before Supabase loads
    window._handleOAuthCallback = async function(fragment) {
        window._pendingOAuthFragment = fragment;
    };
    // Load Supabase CDN → lib/supabase.js → lib/auth-guard.js in sequence after DOM is parsed.
    // Use requestIdleCallback so iOS Safari only starts the 170KB download when the main
    // thread is genuinely idle (GC has finished reclaiming parsing temps).
    // Fallback: 500ms setTimeout (enough for GC after parsing 20K lines of HTML).
    document.addEventListener('DOMContentLoaded', function() {
        if(window._crumb)window._crumb('scripts_supabase_chain_start');
        function _startSupabaseChain() {
        if(window._crumb)window._crumb('scripts_supabase_chain_idle');
        // Helper: load a script, then wait for GC before calling next step.
        // Each step in the chain compiles 10-170KB of JS, spiking memory.
        // Without GC pauses between steps, the cumulative pressure exceeds
        // iOS Safari's Jetsam limit (~50MB for web content).
        function _chainLoad(src, crumbName, gcDelay, next) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = function() {
                if(window._crumb)window._crumb(crumbName);
                // Give GC time to reclaim compilation temps before next load
                setTimeout(next, gcDelay);
            };
            document.head.appendChild(s);
        }
        // Step 1: Supabase CDN (~170KB) — wait 200ms for GC after compilation
        _chainLoad('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'scripts_supabase_loaded', 200, function() {
            // Step 2: lib/supabase.js (111KB, 3700 lines) — creates window.db
            // This is the heaviest step: 3700 lines of object literals compiled + executed.
            // Wait 500ms for GC to reclaim the compilation temps.
            _chainLoad('lib/supabase.js?v=4', 'scripts_supabase_js_loaded', 500, function() {
                // supabaseClient now exists — install the real OAuth callback
                window._handleOAuthCallback = async function(fragment) {
                    try {
                        var params = new URLSearchParams(fragment);
                        var at = params.get('access_token'), rt = params.get('refresh_token');
                        if (at && rt) {
                            var r = await window.supabaseClient.auth.setSession({ access_token: at, refresh_token: rt });
                            if (!r.error) window.location.replace('/dashboard.html');
                            else console.error('OAuth setSession error on dashboard:', r.error);
                        }
                    } catch(e) { console.error('OAuth callback error on dashboard:', e); }
                };
                if (window._pendingOAuthFragment) {
                    window._handleOAuthCallback(window._pendingOAuthFragment);
                    window._pendingOAuthFragment = null;
                }
                // Step 3: lib/auth-guard.js (10KB) — lightweight, 100ms pause is enough
                _chainLoad('lib/auth-guard.js?v=4', 'scripts_auth_guard_loaded', 0, function() {
                    // Signal that auth is ready — script-3 can now start loading
                    window._pbbAuthIsReady = true;
                    window.dispatchEvent(new Event('pbbAuthReady'));
                });
            });
        });
        } // end _startSupabaseChain
        if (window.requestIdleCallback) {
            requestIdleCallback(_startSupabaseChain, { timeout: 800 });
        } else {
            setTimeout(_startSupabaseChain, 500);
        }
    });
} else {
    // Non-iOS: synchronous loading (same behaviour as before)
    document.write('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>');
    document.write('<script>if(window._crumb)window._crumb("scripts_supabase_loaded");<\/script>');
    document.write('<script src="https://js.stripe.com/v3/"><\/script>');
    document.write('<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>');
    document.write('<script src="lib/supabase.js?v=4"><\/script>');
    document.write('<script src="lib/auth-guard.js?v=4"><\/script>');
    document.write('<script>if(window._crumb)window._crumb("scripts_auth_guard_loaded");<\/script>');
}
