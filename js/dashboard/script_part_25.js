// --- PWA INSTALL BANNER LOGIC ---
// On iOS, skip entirely: beforeinstallprompt never fires on iPhone/iPad (Apple restriction).
// This avoids compiling 266 lines of JS during the critical parsing window.
if (window._pbbIsIOSSafari) {
    // Provide stubs so onclick="installPWA()" in HTML doesn't throw
    window.installPWA = function() { alert("On iOS, tap Share → Add to Home Screen"); };
    window.dismissInstall = function() {
        var b = document.getElementById('pwa-install-banner');
        if(b) b.style.display='none';
    };
} else {
let deferredPrompt;
let installBannerDismissed = localStorage.getItem('pwa_banner_dismissed_v2') === 'true';

// Detect if running as installed PWA, native Capacitor app, or inside an APK (TWA/WebView)
const isInstalledPWA = (function() {
    // Native Capacitor app (iOS/Android) — already installed
    if (typeof isNativeApp === 'function' && isNativeApp()) return true;
    if (navigator.userAgent.includes('FitGotchi-Native')) return true;
    // Standard PWA detection
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.navigator.standalone) return true; // iOS
    // TWA (Trusted Web Activity) detection
    if (document.referrer.includes('android-app://')) return true;
    // Android WebView detection (APK wrapper)
    if (/; wv\)/.test(navigator.userAgent || '')) return true;
    return false;
})();

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("Install Prompt Captured");
    // Update any buttons that were showing "waiting" state
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
        }
    });
});

window.addEventListener('load', () => {
    // Detect if running inside native Capacitor shell (App Store install)
    const isNativeCapacitor = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isInstalledPWA) {
        // App is already installed — hide download elements entirely for native apps,
        // or show "already installed" state for PWA installs
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';

        const settingsDownload = document.getElementById('settings-download-app');
        const profileDownload = document.getElementById('profile-download-app-btn');

        if (isNativeCapacitor) {
            // Native app from App Store — just hide download options completely
            if (settingsDownload) settingsDownload.style.display = 'none';
            if (profileDownload) profileDownload.style.display = 'none';
        } else {
            // Installed PWA — show "already installed" state
            if (settingsDownload) {
                const btn = settingsDownload.querySelector('button');
                if (btn) {
                    btn.onclick = null;
                    btn.style.background = '#6b7280';
                    btn.style.cursor = 'default';
                    btn.innerHTML = '&#10003; Installed';
                }
                const subtitle = settingsDownload.querySelector('div > div:last-child');
                if (subtitle) subtitle.textContent = 'Already installed on your phone';
            }

            if (profileDownload) {
                const btn = profileDownload.querySelector('button');
                if (btn) {
                    btn.onclick = null;
                    btn.style.background = 'linear-gradient(135deg, #6b7280, #9ca3af)';
                    btn.style.cursor = 'default';
                    btn.style.boxShadow = 'none';
                    btn.onmouseover = null;
                    btn.onmouseout = null;
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ALREADY INSTALLED';
                }
            }
        }
    } else if (!installBannerDismissed) {
        showPwaBanner();
    }

    // Make Coach Bubble Draggable
    initDraggableBubble();
});

function showPwaBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if(banner) {
        banner.style.display = 'flex';
        document.body.style.transition = 'padding-top 0.3s ease';
        document.body.style.paddingTop = banner.offsetHeight + 'px';
    }
}

window.installPWA = async function(clickedBtn) {
    // If already installed, just show the message
    if (isInstalledPWA) {
        if (clickedBtn) {
            clickedBtn.innerHTML = '&#10003; Already Installed';
            clickedBtn.disabled = true;
        }
        return;
    }

    if (deferredPrompt) {
        // Show installing feedback immediately
        if (clickedBtn) {
            clickedBtn.dataset.originalText = clickedBtn.innerHTML;
            clickedBtn.innerHTML = 'Installing...';
            clickedBtn.disabled = true;
        }

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                // Successfully accepted install
                if (clickedBtn) {
                    clickedBtn.innerHTML = '&#10003; Installed!';
                }
                dismissInstall();
                // Update all other install buttons
                document.querySelectorAll('.pwa-install-btn').forEach(btn => {
                    btn.innerHTML = '&#10003; Installed!';
                    btn.disabled = true;
                });
            } else {
                // User dismissed — restore button
                if (clickedBtn) {
                    clickedBtn.innerHTML = clickedBtn.dataset.originalText || 'Install';
                    clickedBtn.disabled = false;
                }
            }
        } catch(err) {
            console.error('Install error:', err);
            if (clickedBtn) {
                clickedBtn.innerHTML = clickedBtn.dataset.originalText || 'Install';
                clickedBtn.disabled = false;
            }
        }
        deferredPrompt = null;
    } else {
        // No deferred prompt available
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            // Show iOS-specific instructions
            if (clickedBtn) {
                clickedBtn.innerHTML = 'Use Share → Add to Home Screen';
                clickedBtn.style.fontSize = '0.7rem';
                setTimeout(() => {
                    clickedBtn.innerHTML = clickedBtn.dataset.originalText || 'Install';
                    clickedBtn.style.fontSize = '';
                }, 4000);
            }
        } else {
            // Android/Desktop — prompt may not have fired yet, or browser doesn't support it
            if (clickedBtn) {
                clickedBtn.dataset.originalText = clickedBtn.dataset.originalText || clickedBtn.innerHTML;
                clickedBtn.innerHTML = 'Installing...';
                clickedBtn.disabled = true;
                // Wait a moment for the prompt to potentially arrive
                setTimeout(() => {
                    if (deferredPrompt) {
                        // Prompt arrived, retry
                        window.installPWA(clickedBtn);
                    } else {
                        clickedBtn.innerHTML = 'Use browser menu → Install';
                        clickedBtn.style.fontSize = '0.7rem';
                        setTimeout(() => {
                            clickedBtn.innerHTML = clickedBtn.dataset.originalText || 'Install';
                            clickedBtn.style.fontSize = '';
                            clickedBtn.disabled = false;
                        }, 4000);
                    }
                }, 1500);
            }
        }
    }
};

window.dismissInstall = function() {
    const banner = document.getElementById('pwa-install-banner');
    if(banner) {
        banner.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
    localStorage.setItem('pwa_banner_dismissed_v2', 'true');
};

function initDraggableBubble() {
    const bubble = document.getElementById('coach-floating-btn');
    if(!bubble) return;
    
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    const moveThreshold = 5; // Pixels to satisfy 'drag'

    const handleStart = (e) => {
        if(e.target.closest('.notification-badge')) return; // Don't drag if clicking badge
        isDragging = false; // Assume click first
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;

        const rect = bubble.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Remove transition during drag
        bubble.style.transition = 'none';
        // Attach window-level listeners only during drag (saves memory — was firing on every touch/mouse event)
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, {passive: false});
        window.addEventListener('touchend', handleEnd);
    };

    const handleMove = (e) => {
        e.preventDefault(); // Prevent scrolling
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
            isDragging = true;
        }

        if (isDragging) {
             bubble.style.right = 'auto';
             bubble.style.bottom = 'auto';
             bubble.style.left = (initialLeft + dx) + 'px';
             bubble.style.top = (initialTop + dy) + 'px';
        }
    };

    const handleEnd = (e) => {
        bubble.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        // Remove window-level listeners when drag ends
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    };

    bubble.addEventListener('mousedown', handleStart);
    bubble.addEventListener('touchstart', handleStart, {passive: false});
}


window.installPWA = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            dismissInstall();
        }
        deferredPrompt = null;
    } else {
        // User requested "No instructions, just download".
        // If we are here, the browser hasn't fired the event yet or doesn't support it (iOS).
        // specific check for iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
             alert("On iOS, please tap 'Share' then 'Add to Home Screen' manually."); 
        } else {
             console.log("Install prompt not ready yet.");
             // Try to force it? No API for that.
             alert("App installation is getting ready. Please try again in a moment.");
        }
    }
};

window.dismissInstall = function() {
    const banner = document.getElementById('pwa-install-banner');
    if(banner) {
        banner.style.display = 'none';
        document.body.style.paddingTop = '0';
    }
    localStorage.setItem('pwa_banner_dismissed_v2', 'true');
};
} // end else (non-iOS PWA install banner)