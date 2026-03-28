if(window._crumb)window._crumb('scripts_model_viewer_start');
if (window._pbbIsIOSSafari) {
    // iOS Safari: defer model-viewer module (~500KB + Three.js) until after init.
    if(window._crumb)window._crumb('scripts_model_viewer_DEFERRED_ios');
    window.addEventListener('pbbInitComplete', function() {
        if(window._crumb)window._crumb('scripts_model_viewer_scheduled_5s');

        // v2 strategy: strip src from non-main model-viewer elements rather
        // than replacing them with <div> placeholders.  model-viewer uses a
        // SHARED WebGL renderer, so leaving elements in the DOM is safe.
        // The old v1 placeholder approach created/destroyed elements which
        // caused memory leaks and fought model-viewer's internal management.
        try {
            var allMV = document.querySelectorAll('model-viewer');
            var stripped = 0;
            for (var mi = 0; mi < allMV.length; mi++) {
                var el = allMV[mi];
                if (el.id === 'tamagotchi-model') continue;
                el.removeAttribute('src');
                stripped++;
            }
            if (window._crumb) window._crumb('ios_stripped_src_' + stripped + '_mv_elements');
        } catch(e3) {
            if (window._crumb) window._crumb('ios_mv_strip_error');
        }

        setTimeout(function() {
            if(window._crumb)window._crumb('scripts_model_viewer_loading_post_init');
            var mvScript = document.createElement('script');
            mvScript.type = 'module';
            mvScript.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
            document.head.appendChild(mvScript);
        }, 5000);
    }, { once: true });
} else {
    // Non-iOS: load immediately (plenty of memory on desktop/Android)
    var mvScript = document.createElement('script');
    mvScript.type = 'module';
    mvScript.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
    document.head.appendChild(mvScript);
    if(window._crumb)window._crumb('scripts_model_viewer_injected');
}