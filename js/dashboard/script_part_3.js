if(window._crumb)window._crumb('scripts_model_viewer_start');

// Meshopt decoder URL — used by both model-viewer (via meshoptDecoderLocation)
// and avatar3d.js standalone Three.js loader (via window.MeshoptDecoder)
var MESHOPT_DECODER_URL = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_decoder.min.js';

// Load meshopt decoder script globally (needed for avatar3d.js standalone loader)
function _pbbLoadMeshoptDecoder(callback) {
    var s = document.createElement('script');
    s.src = MESHOPT_DECODER_URL;
    s.onload = function() {
        if(window._crumb)window._crumb('meshopt_decoder_loaded');
        if (window.MeshoptDecoder && window.MeshoptDecoder.ready) {
            window.MeshoptDecoder.ready.then(callback);
        } else {
            callback();
        }
    };
    s.onerror = function() {
        if(window._crumb)window._crumb('meshopt_decoder_failed');
        callback();
    };
    document.head.appendChild(s);
}

// Configure model-viewer to use meshopt decoder once it's registered.
// model-viewer has meshopt SUPPORT but needs meshoptDecoderLocation set
// to actually load the decoder — without this, meshoptDecoder stays null
// and meshopt-compressed GLBs fail silently.
customElements.whenDefined('model-viewer').then(function() {
    var MV = customElements.get('model-viewer');
    if (MV) {
        MV.meshoptDecoderLocation = MESHOPT_DECODER_URL;
        if(window._crumb)window._crumb('model_viewer_meshopt_configured');
    }
});

// iOS native app: skip model-viewer entirely. The native SceneKit viewer
// (NativeCharacterViewerPlugin.swift) handles 3D rendering in native memory
// space, bypassing WKWebView's ~300MB limit that causes OOM crashes.
// _pbbNativeViewerAvailable is set by native-character-viewer-bridge.js
// which loads BEFORE this script (see dashboard.html line 65 vs 271).
if (window._pbbNativeViewerAvailable) {
    if(window._crumb)window._crumb('scripts_model_viewer_SKIPPED_native_viewer');
    // Replace non-essential model-viewer elements with div placeholders to prevent
    // WebGL initialization. Keep the main tamagotchi-model as a hidden <model-viewer>
    // so it can be used as a fallback if the native viewer can't decode a model
    // (e.g. Draco-compressed GLB files that GLTFKit2 doesn't support).
    try {
        var keepIds = { 'tamagotchi-model': true };
        var allMV = document.querySelectorAll('model-viewer');
        var replaced = 0;
        for (var mi = 0; mi < allMV.length; mi++) {
            var el = allMV[mi];
            if (keepIds[el.id]) {
                // Keep as real model-viewer but hide and remove src to prevent rendering
                el.removeAttribute('src');
                el.style.visibility = 'hidden';
                continue;
            }
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

        // If we've been crashing repeatedly (5+ times in <2 min), skip
        // loading model-viewer to break the crash loop. Raised from 3 to 5
        // because normal app restarts were triggering false positives.
        if (window._pbbCrashCount >= 5) {
            if (window._crumb) window._crumb('ios_SKIP_model_viewer_crash_recovery');
            return;
        }

        // Load meshopt decoder and model-viewer in PARALLEL (not sequential).
        // The 1s delay gives placeholders time to settle and GC to run after
        // the init sequence, but doesn't add unnecessary wait time.
        setTimeout(function() {
            if(window._crumb)window._crumb('scripts_model_viewer_loading_post_init');
            _pbbLoadMeshoptDecoder(function() {}); // fire-and-forget; CE config happens in whenDefined above

            function loadModelViewerScript(attempt) {
                var mvScript = document.createElement('script');
                mvScript.type = 'module';
                mvScript.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
                mvScript.onerror = function() {
                    if (window._crumb) window._crumb('model_viewer_script_FAILED_attempt_' + attempt);
                    if (attempt < 3) {
                        // Retry after increasing delay (2s, 4s)
                        setTimeout(function() { loadModelViewerScript(attempt + 1); }, attempt * 2000);
                    }
                };
                document.head.appendChild(mvScript);
            }
            loadModelViewerScript(1);

            // Safety: if model-viewer CE doesn't register within 20s, something is wrong.
            // Check if the main model-viewer has src but no model loaded — this means
            // the script loaded but model decoding failed (e.g. meshopt decoder issue).
            setTimeout(function() {
                if (!customElements.get('model-viewer')) {
                    if (window._crumb) window._crumb('model_viewer_CE_STILL_NOT_DEFINED_after_20s');
                    // Last resort: try loading one more time
                    loadModelViewerScript(99);
                }
            }, 20000);
        }, 1000);
    }, { once: true });
} else {
    // Non-iOS: load meshopt decoder first, then model-viewer
    _pbbLoadMeshoptDecoder(function() {
        var mvScript = document.createElement('script');
        mvScript.type = 'module';
        mvScript.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
        document.head.appendChild(mvScript);
        if(window._crumb)window._crumb('scripts_model_viewer_injected');
    });
}
