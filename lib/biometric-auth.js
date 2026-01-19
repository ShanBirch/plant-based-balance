/**
 * Biometric Authentication Helper
 * Uses Web Authentication API (WebAuthn) for fingerprint/face login
 * Stores credentials locally and uses them to quickly re-authenticate
 */

const BiometricAuth = {
    // Storage keys
    CREDENTIAL_KEY: 'pbb_biometric_credential',
    USER_EMAIL_KEY: 'pbb_biometric_email',

    /**
     * Check if biometric authentication is available on this device
     */
    async isAvailable() {
        // Check if WebAuthn is supported
        if (!window.PublicKeyCredential) {
            return false;
        }

        // Check if a platform authenticator (fingerprint/face) is available
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return available;
        } catch (error) {
            console.error('Error checking biometric availability:', error);
            return false;
        }
    },

    /**
     * Check if user has already registered biometric credentials
     */
    hasCredentials() {
        const credential = localStorage.getItem(this.CREDENTIAL_KEY);
        const email = localStorage.getItem(this.USER_EMAIL_KEY);
        return !!(credential && email);
    },

    /**
     * Get the email associated with stored biometric credentials
     */
    getStoredEmail() {
        return localStorage.getItem(this.USER_EMAIL_KEY);
    },

    /**
     * Register biometric credentials for the current user
     * Call this after successful password login
     */
    async register(email, userId) {
        if (!await this.isAvailable()) {
            throw new Error('Biometric authentication is not available on this device');
        }

        // Generate a random challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        // Create credential options
        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: "PlantBasedBalance",
                id: window.location.hostname
            },
            user: {
                id: Uint8Array.from(userId, c => c.charCodeAt(0)),
                name: email,
                displayName: email.split('@')[0]
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" },   // ES256
                { alg: -257, type: "public-key" }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",  // Use device's built-in biometric
                userVerification: "required",
                residentKey: "preferred"
            },
            timeout: 60000,
            attestation: "none"
        };

        try {
            // Create the credential
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            // Store the credential ID for later authentication
            const credentialId = this._arrayBufferToBase64(credential.rawId);

            localStorage.setItem(this.CREDENTIAL_KEY, credentialId);
            localStorage.setItem(this.USER_EMAIL_KEY, email);

            console.log('Biometric registration successful');
            return true;
        } catch (error) {
            console.error('Biometric registration failed:', error);
            throw error;
        }
    },

    /**
     * Authenticate using biometrics
     * Returns the stored email if successful
     */
    async authenticate() {
        if (!this.hasCredentials()) {
            throw new Error('No biometric credentials registered');
        }

        const credentialId = localStorage.getItem(this.CREDENTIAL_KEY);
        const email = localStorage.getItem(this.USER_EMAIL_KEY);

        // Generate a random challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const publicKeyCredentialRequestOptions = {
            challenge: challenge,
            allowCredentials: [{
                id: this._base64ToArrayBuffer(credentialId),
                type: "public-key",
                transports: ["internal"]
            }],
            userVerification: "required",
            timeout: 60000
        };

        try {
            // Request authentication
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            // If we got here, biometric verification succeeded
            console.log('Biometric authentication successful');
            return email;
        } catch (error) {
            console.error('Biometric authentication failed:', error);
            throw error;
        }
    },

    /**
     * Remove stored biometric credentials
     */
    clear() {
        localStorage.removeItem(this.CREDENTIAL_KEY);
        localStorage.removeItem(this.USER_EMAIL_KEY);
        console.log('Biometric credentials cleared');
    },

    /**
     * Helper: Convert ArrayBuffer to Base64
     */
    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    /**
     * Helper: Convert Base64 to ArrayBuffer
     */
    _base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
};

// Make it globally available
window.BiometricAuth = BiometricAuth;
