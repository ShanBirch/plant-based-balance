import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}


import Photos

@objc(RecordingLibraryPlugin)
public class RecordingLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecordingLibraryPlugin"
    public let jsName = "RecordingLibrary"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "saveVideo", returnType: CAPPluginReturnPromise)]

    @objc func saveVideo(_ call: CAPPluginCall) {
        guard let path = call.getString("uri"), let url = URL(string: path), url.isFileURL,
              let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            call.reject("The recording could not be found.")
            return
        }
        let source = url.resolvingSymlinksInPath().standardizedFileURL
        let root = cache.appendingPathComponent("recordings").resolvingSymlinksInPath().standardizedFileURL.path + "/"
        guard source.path.hasPrefix(root), FileManager.default.fileExists(atPath: source.path),
              UIVideoAtPathIsCompatibleWithSavedPhotosAlbum(source.path) else {
            call.reject("This recording cannot be added to Photos. Use Share video to keep a copy in Files.")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.reject("Allow Photos access in Settings to save your recording.", "PERMISSION_DENIED")
                return
            }
            var assetID: String?
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: source)
                assetID = request?.placeholderForCreatedAsset?.localIdentifier
            }) { success, error in
                if success, let identifier = assetID { call.resolve(["uri": identifier]) }
                else { call.reject("Could not save to Photos. Your recording is still available to share.", "SAVE_FAILED", error) }
            }
        }
    }
}

class TeleprompterViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecordingLibraryPlugin())
    }
}
