// analytics.js - Global Tracking & UTM Persistence
(function() {
    // 1. Capture UTM Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    
    let utmData = JSON.parse(sessionStorage.getItem('utm_data') || '{}');
    let hasNewUtm = false;

    utms.forEach(param => {
        if (urlParams.has(param)) {
            utmData[param] = urlParams.get(param);
            hasNewUtm = true;
        }
    });

    if (hasNewUtm) {
        sessionStorage.setItem('utm_data', JSON.stringify(utmData));
        console.log('--- UTM DATA CAPTURED ---', utmData);
    }

    // 2. Global Helper to get UTMs for Zapier/Stripe
    window.getUTMData = function() {
        return JSON.parse(sessionStorage.getItem('utm_data') || '{}');
    };

    // 3. Helper to get Facebook Cookies
    window.getFBParams = function() {
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        };
        return {
            fbc: getCookie('_fbc'),
            fbp: getCookie('_fbp')
        };
    };

    // 4. Google Analytics 4 (GA4) Initialization
    // TODO: RMS - Replace 'G-XXXXXXXXXX' with your actual Measurement ID from Google Analytics
    const GA_MEASUREMENT_ID = 'G-X4MJFTSBC3'; 

    if (GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID);
        console.log('--- GA4 INITIALIZED ---');
    } else {
        console.warn('--- GA4 NOT INITIALIZED: Missing Measurement ID in analytics.js ---');
    }
})();
