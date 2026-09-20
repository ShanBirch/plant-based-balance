(function () {
    'use strict';
    // No account data, payment status or arbitrary redirect is accepted from the URL.
    // The existing app session owns the payment gate and keeps it locked until paid.
    const status = new URLSearchParams(window.location.search).get('status');
    const message = document.getElementById('return-message');
    if (message && status === 'complete') message.textContent = 'Return to Balance to confirm your payment and continue in the app.';
    if (message && status === 'manage') message.textContent = 'Return to Balance to continue where you left off.';
    const appUrl = 'com.fitgotchi.app://checkout-return';
    const button = document.getElementById('open-balance');
    if (!button) return;
    if (/Android/i.test(navigator.userAgent)) {
        // Chrome can use the explicit button even when it blocks an automatic launch.
        button.href = 'intent://checkout-return#Intent;scheme=com.fitgotchi.app;package=com.fitgotchi.app;end';
    }
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.replace(appUrl);
    }
})();
