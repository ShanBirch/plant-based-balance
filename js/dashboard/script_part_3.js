if(window._crumb)window._crumb('scripts_model_viewer_start');
// Safe mode: skip model-viewer entirely to prevent WebGL crash loops
if (window._pbbSafeMode) {
    if(window._crumb)window._crumb('scripts_model_viewer_SKIPPED_safe_mode');
} else if (window._pbbIsIOSSafari) {
    // iOS Safari: defer model-viewer module (~500KB + Three.js) until after init.
    if(window._crumb)window._crumb('scripts_model_viewer_DEFERRED_ios');
    window.addEventListener('pbbInitComplete', function() {
        if(window._crumb)window._crumb('scripts_model_viewer_scheduled_5s');

        // BEFORE loading model-viewer, replace non-essential <model-viewer> elements
        // with <div> placeholders. When model-viewer CE registers, it upgrades ALL
        // existing <model-viewer> elements (creating shadow DOMs, scenes, observers).
        // With 14 elements, this causes significant memory overhead on iOS.
        // Only keep the main tamagotchi-model; everything else gets a placeholder.
        try {
            var keepIds = { 'tamagotchi-model': true };
            var allMV = document.querySelectorAll('model-viewer');
            var replaced = 0;
            for (var mi = 0; mi < allMV.length; mi++) {
                var el = allMV[mi];
                if (keepIds[el.id]) continue;
                var ph = document.createElement('div');
                ph.id = el.id;
                ph.className = el.className;
                ph.setAttribute('style', el.getAttribute('style') || '');
                ph.dataset.mvPlaceholder = 'true';
                // Save attributes needed to recreate the model-viewer later
                for (var ai = 0; ai < el.attributes.length; ai++) {
                    var attr = el.attributes[ai];
                    if (attr.name !== 'id' && attr.name !== 'class' && attr.name !== 'style') {
                        ph.dataset['mv_' + attr.name.replace(/-/g, '_')] = attr.value;
                    }
                }
                el.parentNode.replaceChild(ph, el);
                replaced++;
            }
            if (window._crumb) window._crumb('ios_replaced_' + replaced + '_mv_with_placeholders');
        } catch(e3) {
            if (window._crumb) window._crumb('ios_mv_placeholder_error');
        }

        setTimeout(function() {
            if (window._pbbSafeMode) return;
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