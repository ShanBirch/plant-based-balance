import Foundation
import Capacitor
import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging

/// Minimal push plugin compiled directly into the App target.
///
/// We roll our own instead of using @capacitor-firebase/messaging because
/// that plugin ships as a Swift Package and its @objc(FirebaseMessagingPlugin)
/// class gets dead-stripped — Capacitor.registerPlugin('FirebaseMessaging')
/// returns a stub at runtime and permission / token calls silently no-op.
/// Custom plugins in the App target don't have that problem.
@objc(FitGotchiPushPlugin)
public class FitGotchiPushPlugin: CAPPlugin, CAPBridgedPlugin, MessagingDelegate {
    public let identifier = "FitGotchiPushPlugin"
    public let jsName = "FitGotchiPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPerm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPerm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        Messaging.messaging().delegate = self
    }

    /// Asks iOS for notification permission. Shows the system dialog on
    /// first call; returns the current state thereafter.
    @objc func requestPerm(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        let options: UNAuthorizationOptions = [.alert, .badge, .sound]
        center.requestAuthorization(options: options) { granted, error in
            if let error = error {
                call.reject("Authorization error: \(error.localizedDescription)")
                return
            }
            let receive = granted ? "granted" : "denied"
            // Kick off remote notification registration on the main thread —
            // this is what ultimately causes didRegisterForRemoteNotifications
            // to fire in AppDelegate, which feeds APNs token to FCM.
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            call.resolve(["receive": receive])
        }
    }

    @objc func checkPerm(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let receive: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: receive = "granted"
            case .denied: receive = "denied"
            case .notDetermined: receive = "prompt"
            @unknown default: receive = "prompt"
            }
            call.resolve(["receive": receive])
        }
    }

    /// Registers for remote notifications (in case permission was already
    /// granted and JS just wants to kick off token issuance).
    @objc func registerToken(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        call.resolve()
    }

    /// Returns the current FCM token. Retries if APNs hasn't delivered
    /// its device token to AppDelegate yet (race right after the user
    /// taps Allow on the first permission prompt).
    @objc func getToken(_ call: CAPPluginCall) {
        // Make sure we've kicked off APNs registration — needed if the
        // caller jumped straight to getToken without going through
        // requestPerm (e.g. re-entry on app launch after permission
        // previously granted).
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        fetchFcmToken(attempt: 0, call: call)
    }

    private func fetchFcmToken(attempt: Int, call: CAPPluginCall) {
        Messaging.messaging().token { [weak self] token, error in
            if let token = token, !token.isEmpty {
                call.resolve(["token": token])
                return
            }
            let message = error?.localizedDescription ?? "unknown"
            // "no APNs token specified" arrives when iOS hasn't handed the
            // device token to AppDelegate yet. Retry a handful of times on
            // a 1-second schedule — the whole APNs handshake normally
            // completes in under 5s.
            if attempt < 15 && (message.contains("APNS") || message.contains("APNs") || message.contains("apns")) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self?.fetchFcmToken(attempt: attempt + 1, call: call)
                }
                return
            }
            call.reject("FCM token error (attempt \(attempt + 1)): \(message)")
        }
    }

    // MARK: - MessagingDelegate

    /// Fires whenever FCM rotates the token. We forward it to JS so the
    /// subscription row in Supabase stays in sync on the rare occasion the
    /// token changes (e.g. app reinstall on the same device).
    public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        notifyListeners("tokenReceived", data: ["token": token])
    }
}
