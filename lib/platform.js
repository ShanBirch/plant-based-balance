// platform.js - Platform detection for payment routing
// Web (website download) → Stripe
// iOS (App Store) → Apple StoreKit
// Android (Play Store) → Google Play Billing

const Platform = {
    isNative() {
        return navigator.userAgent.includes('FitGotchi-Native') ||
               (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    },

    isIOS() {
        if (window.Capacitor && window.Capacitor.getPlatform) {
            return window.Capacitor.getPlatform() === 'ios';
        }
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && this.isNative();
    },

    isAndroid() {
        if (window.Capacitor && window.Capacitor.getPlatform) {
            return window.Capacitor.getPlatform() === 'android';
        }
        return /Android/.test(navigator.userAgent) && this.isNative();
    },

    isWeb() {
        return !this.isNative();
    },

    // Returns 'stripe', 'apple', or 'google'
    getPaymentProvider() {
        if (this.isIOS()) return 'apple';
        if (this.isAndroid()) return 'google';
        return 'stripe';
    },

    name() {
        if (this.isIOS()) return 'ios';
        if (this.isAndroid()) return 'android';
        return 'web';
    }
};

window.Platform = Platform;
