import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit

@objc(FitGotchiAuthPlugin)
public class FitGotchiAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitGotchiAuthPlugin"
    public let jsName = "FitGotchiAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openOAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise)
    ]

    private var authSession: ASWebAuthenticationSession?
    private var appleSignInCall: CAPPluginCall?
    private var currentNonce: String?

    /// Opens a URL in an ASWebAuthenticationSession (system in-app browser).
    /// When the browser redirects to com.fitgotchi.app://, the session
    /// automatically closes and returns the full callback URL to JavaScript.
    @objc func openOAuth(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("Missing or invalid URL")
            return
        }

        let callbackScheme = "com.fitgotchi.app"

        DispatchQueue.main.async { [weak self] in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                self?.authSession = nil

                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    call.reject("User cancelled login")
                    return
                }

                if let error = error {
                    call.reject("Auth failed: \(error.localizedDescription)")
                    return
                }

                guard let callbackURL = callbackURL else {
                    call.reject("No callback URL received")
                    return
                }

                // Return the full callback URL so JS can extract the fragment
                call.resolve(["url": callbackURL.absoluteString])
            }

            session.presentationContextProvider = self
            // Keep the user's existing session cookies (don't force re-login)
            session.prefersEphemeralWebBrowserSession = false

            self?.authSession = session
            session.start()
        }
    }
    // MARK: - Sign in with Apple (native one-tap)

    @objc func signInWithApple(_ call: CAPPluginCall) {
        appleSignInCall = call

        let nonce = Self.randomNonceString()
        currentNonce = nonce
        let hashedNonce = Self.sha256(nonce)

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    /// Generate a random nonce string for Apple Sign In
    private static func randomNonceString(length: Int = 32) -> String {
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length
        while remainingLength > 0 {
            let randoms: [UInt8] = (0 ..< 16).map { _ in
                var random: UInt8 = 0
                let errorCode = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                if errorCode != errSecSuccess { fatalError("Unable to generate nonce.") }
                return random
            }
            randoms.forEach { random in
                if remainingLength == 0 { return }
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }
        return result
    }

    /// SHA256 hash of the nonce
    private static func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.compactMap { String(format: "%02x", $0) }.joined()
    }
}

extension FitGotchiAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = appleIDCredential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            appleSignInCall?.reject("Failed to get Apple ID token")
            appleSignInCall = nil
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "nonce": currentNonce ?? ""
        ]

        // Apple only returns name/email on FIRST sign-in
        if let email = appleIDCredential.email {
            result["email"] = email
        }
        if let fullName = appleIDCredential.fullName {
            let givenName = fullName.givenName ?? ""
            let familyName = fullName.familyName ?? ""
            let name = [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
            if !name.isEmpty {
                result["fullName"] = name
            }
        }

        appleSignInCall?.resolve(result)
        appleSignInCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            appleSignInCall?.reject("User cancelled Apple Sign In")
        } else {
            appleSignInCall?.reject("Apple Sign In failed: \(error.localizedDescription)")
        }
        appleSignInCall = nil
    }
}

extension FitGotchiAuthPlugin: ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
