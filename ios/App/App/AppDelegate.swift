import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase so FCM can issue tokens for iOS push.
        FirebaseApp.configure()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Hand the APNs device token to Firebase Messaging so it can mint the
    // FCM token that FitGotchiPush returns to JS.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: "apnsDeviceTokenHex")
        UserDefaults.standard.set("", forKey: "apnsRegistrationError")
        NSLog("[Push] APNs device token received: %@", hex)
    }

    // Fires when APNs registration fails (bad entitlement, no network, etc).
    // We surface the error to JS via UserDefaults so the debug banner can
    // show it instead of the silent "no APNs token" timeout.
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        let errMsg = error.localizedDescription
        UserDefaults.standard.set("", forKey: "apnsDeviceTokenHex")
        UserDefaults.standard.set(errMsg, forKey: "apnsRegistrationError")
        NSLog("[Push] APNs registration FAILED: %@", errMsg)
    }

}
