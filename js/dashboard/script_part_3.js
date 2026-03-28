if(window._crumb)window._crumb('scripts_model_viewer_start');

// iOS native app: skip model-viewer entirely. The native SceneKit viewer
// (NativeCharacterViewerPlugin.swift) handles 3D rendering in native memory
// space, bypassing WKWebView's ~300MB limit that causes OOM crashes.
// _pbbNativeViewerAvailable is set by native-character-viewer-bridge.js
// which loads BEFORE this script (see dashboard.html line 65 vs 271).
if (window._pbbNativeViewerAvailable) {
    if(window._crumb)window._crumb('scripts_model_viewer_SKIPPED_native_viewer');
    // Replace all model-viewer elements with div placeholders to prevent
    // any WebGL initialization if model-viewer somehow loads later.
    try {
        var allMV = document.querySelectorAll('model-viewer');
        var replaced = 0;
        for (var mi = 0; mi < allMV.length; mi++) {
            var el = allMV[mi];
            var ph = document.createElement('div');
            ph.id = el.id;
            ph.className = el.className;
            ph.setAttribute('style', el.getAttribute('style') || '');
            ph.dataset.mvPlaceholder = 'true';
            for (var ai = 0; ai < el.attributes.length; ai++) {
                var attr = el.attributes[ai];
                if (attr.name !== 'id' && attr.name !== 'class' && attr.name !== 'style') {
                    ph.dataset['mv_' + attr.name.replace(/-/g, '_')] = attr.value;
                }
            }
            el.parentNode.replaceChild(ph, el);
            replaced++;
        }
        if (window._crumb) window._crumb('native_replaced_' + replaced + '_mv_with_placeholders');
    } catch(e3) {
        if (window._crumb) window._crumb('native_mv_placeholder_error');
    }
    // Do NOT load model-viewer script — no WebGL, no Three.js, no memory pressure.
} else if (window._pbbIsIOSSafari) {
    // iOS Safari (PWA / browser): defer model-viewer module (~500KB + Three.js) until after init.
    if(window._crumb)window._crumb('scripts_model_viewer_DEFERRED_ios');
    window.addEventListener('pbbInitComplete', function() {
        if(window._crumb)window._crumb('scripts_model_viewer_scheduled_5s');

        // BEFORE loading model-viewer, replace non-essential <model-viewer>
        // elements with <div> placeholders. When model-viewer CE registers,
        // it upgrades ALL existing <model-viewer> elements, creating shadow
        // DOMs, Three.js scenes, and observers for EACH one. With 11+
        // elements, this causes a ~50-100MB memory spike that pushes past
        // the iOS Jetsam limit.
        //
        // By replacing with divs first, only the main tamagotchi-model gets
        // upgraded. Other viewers are restored on-demand via
        // _pbbRestorePlaceholder() when the user actually opens that view.
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

        // If we've been crashing repeatedly (3+ times), skip loading
        // model-viewer entirely to break the crash loop. The emoji
        // fallback in script_part_6.js will show instead.
        if (window._pbbCrashCount >= 3) {
            if (window._crumb) window._crumb('ios_SKIP_model_viewer_crash_recovery');
            return;
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