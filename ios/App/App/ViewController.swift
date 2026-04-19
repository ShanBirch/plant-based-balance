import UIKit
import Capacitor
import WebKit

/// Custom view controller that extends Capacitor's bridge view controller.
///
/// Injects a WKUserScript as a belt-and-suspenders native platform detection
/// mechanism, backing up the `appendUserAgent` setting in capacitor.config.json.
///
/// When loading from a remote URL there is network latency between when
/// `load()` is called inside `super.viewDidLoad()` and when the HTML response
/// arrives. Adding the WKUserScript right after super returns registers it in
/// time for the `atDocumentStart` injection window, so
/// `native-character-viewer-bridge.js` can read `window._fitgotchiNativePlatform`
/// before it performs its native-detection check.
class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Inject a native platform flag at document start.
        // Primary mechanism: appendUserAgent in capacitor.config.json makes
        // navigator.userAgent contain 'FitGotchi-Native'.
        // This WKUserScript is the secondary mechanism, checked via
        // window._fitgotchiNativePlatform in native-character-viewer-bridge.js.
        let script = WKUserScript(
            source: "window._fitgotchiNativePlatform = 'ios';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        webView?.configuration.userContentController.addUserScript(script)
    }

    override func capacitorDidLoad() {
        // Local app plugins must be explicitly registered — they are not
        // npm packages so npx cap sync does not generate the Objective-C
        // registration file for them.  Without this call,
        // window.Capacitor.Plugins.NativeCharacterViewer is undefined in JS
        // and the native SceneKit viewer never activates.
        bridge?.registerPluginInstance(NativeCharacterViewerPlugin())
        // FitGotchiPush bridges @capacitor/push-notifications + Firebase to
        // hand JS an FCM token on iOS. Same deal — app-target plugin, not
        // discovered automatically.
        bridge?.registerPluginInstance(FitGotchiPushPlugin())
    }
}
