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
    private let maxShortcutDeliveryAttempts = 30
    private var shortcutDeliveryAttempts = 0
    private var metaTrialDeliveryAttempts = 0

    override func viewDidLoad() {
        super.viewDidLoad()

        // Inject a native platform flag at document start.
        // Primary mechanism: appendUserAgent in capacitor.config.json makes
        // navigator.userAgent contain 'FitGotchi-Native'.
        // This WKUserScript is the secondary mechanism, checked via
        // window._fitgotchiNativePlatform in native-character-viewer-bridge.js.
        let script = WKUserScript(
            source: nativeBootstrapScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        webView?.configuration.userContentController.addUserScript(script)

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(schedulePendingBalanceShortcutDelivery),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(schedulePendingBalanceShortcutDelivery),
            name: .balanceShortcutActionQueued,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(deliverPendingMetaTrial),
            name: .balanceMetaTrialQueued,
            object: nil
        )
        schedulePendingBalanceShortcutDelivery()
        deliverPendingMetaTrial()
    }

    override func capacitorDidLoad() {
        // Local app plugins must be explicitly registered — they are not
        // npm packages so npx cap sync does not generate the Objective-C
        // registration file for them.  Without this call,
        // window.Capacitor.Plugins.NativeCharacterViewer is undefined in JS
        // and the native SceneKit viewer never activates.
        // This bridge powers both native Sign in with Apple and the secure
        // system-browser flow used for Google sign-in on iPhone.
        bridge?.registerPluginInstance(FitGotchiAuthPlugin())
        bridge?.registerPluginInstance(NativeCharacterViewerPlugin())
        // FitGotchiPush bridges @capacitor/push-notifications + Firebase to
        // hand JS an FCM token on iOS. Same deal — app-target plugin, not
        // discovered automatically.
        bridge?.registerPluginInstance(FitGotchiPushPlugin())
        // Share today's calories/macros with the iOS home-screen widget.
        bridge?.registerPluginInstance(BalanceNutritionWidgetPlugin())
        // Open generated PB/workout cards in Instagram Story or Feed.
        bridge?.registerPluginInstance(BalanceInstagramSharePlugin())
        // Open the real phone video camera for Share a Set clips.
        bridge?.registerPluginInstance(BalanceVideoCapturePlugin())
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func schedulePendingBalanceShortcutDelivery() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.schedulePendingBalanceShortcutDelivery()
            }
            return
        }
        shortcutDeliveryAttempts = 0
        attemptPendingBalanceShortcutDelivery()
    }

    private func attemptPendingBalanceShortcutDelivery() {
        shortcutDeliveryAttempts += 1
        guard let action = BalanceShortcutHandoff.pendingAction() else {
            retryPendingBalanceShortcutDelivery()
            return
        }

        guard let webView = webView else {
            retryPendingBalanceShortcutDelivery()
            return
        }

        let escapedAction = javascriptStringLiteral(action)
        let js = """
        (function() {
            window._pendingBalanceShortcutAction = '\(escapedAction)';
            window._pbbShortcutLaunchAction = '\(escapedAction)';
            if (typeof window.handleBalanceShortcutAction !== 'function') return 'waiting';
            return window.handleBalanceShortcutAction('\(escapedAction)') ? 'handled' : 'unhandled';
        })();
        """

        webView.evaluateJavaScript(js) { [weak self] result, error in
            guard let self = self else { return }
            if error == nil, let state = result as? String, state == "handled" {
                BalanceShortcutHandoff.clear(action)
                self.shortcutDeliveryAttempts = 0
                return
            }
            self.retryPendingBalanceShortcutDelivery()
        }
    }

    private func retryPendingBalanceShortcutDelivery() {
        guard shortcutDeliveryAttempts < maxShortcutDeliveryAttempts else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.attemptPendingBalanceShortcutDelivery()
        }
    }

    @objc private func deliverPendingMetaTrial() {
        guard let query = BalanceMetaTrialHandoff.pendingQuery(), let webView = webView else { return }
        metaTrialDeliveryAttempts += 1
        let escapedQuery = javascriptStringLiteral(query)
        let js = """
        (function() {
            window._pendingBalanceMetaTrialQuery = '\(escapedQuery)';
            if (!window.BalanceMetaAdTrial || !window.BalanceMetaAdTrial.activateFromNativeQuery('\(escapedQuery)')) return 'waiting';
            var p = new URLSearchParams('\(escapedQuery)');
            window.location.replace(p.get('account_first') === '1' ? '/login.html?action=signup&\(escapedQuery)' : '/dashboard.html');
            return 'handled';
        })();
        """
        webView.evaluateJavaScript(js) { result, error in
            if error == nil, let state = result as? String, state == "handled" {
                BalanceMetaTrialHandoff.clear(query)
                self.metaTrialDeliveryAttempts = 0
            } else if self.metaTrialDeliveryAttempts < self.maxShortcutDeliveryAttempts {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    self?.deliverPendingMetaTrial()
                }
            }
        }
    }

    private func javascriptStringLiteral(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
    }

    private func nativeBootstrapScript() -> String {
        var source = "window._fitgotchiNativePlatform = 'ios';"
        if let action = BalanceShortcutHandoff.pendingAction() {
            let escapedAction = javascriptStringLiteral(action)
            source += "window._pendingBalanceShortcutAction = '\(escapedAction)';"
            source += "window._pbbShortcutLaunchAction = '\(escapedAction)';"
        }
        if let query = BalanceMetaTrialHandoff.pendingQuery() {
            let escapedQuery = javascriptStringLiteral(query)
            source += "window._pendingBalanceMetaTrialQuery = '\(escapedQuery)';"
        }
        return source
    }
}
