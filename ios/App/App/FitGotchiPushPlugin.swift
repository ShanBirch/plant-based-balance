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
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        Messaging.messaging().delegate = self
    }

    /// Asks iOS for notification permission. Shows the system dialog on
    /// first call; returns the current state thereafter.
    @objc func requestPermissions(_ call: CAPPluginCall) {
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

    @objc func checkPermissions(_ call: CAPPluginCall) {
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
    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        call.resolve()
    }

    /// Returns the current FCM token. Waits for FCM to finish its handshake
    /// with APNs if the token isn't ready yet.
    @objc func getToken(_ call: CAPPluginCall) {
        Messaging.messaging().token { token, error in
            if let error = error {
                call.reject("FCM token error: \(error.localizedDescription)")
                return
            }
            guard let token = token else {
                call.reject("FCM token unavailable")
                return
            }
            call.resolve(["token": token])
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
