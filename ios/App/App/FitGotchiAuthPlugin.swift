import Foundation
import Capacitor
import AuthenticationServices

@objc(FitGotchiAuthPlugin)
public class FitGotchiAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitGotchiAuthPlugin"
    public let jsName = "FitGotchiAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openOAuth", returnType: CAPPluginReturnPromise)
    ]

    private var authSession: ASWebAuthenticationSession?

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
}

extension FitGotchiAuthPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
