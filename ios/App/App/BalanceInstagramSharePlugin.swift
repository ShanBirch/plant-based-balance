import Foundation
import Capacitor
import UIKit

@objc(BalanceInstagramSharePlugin)
public class BalanceInstagramSharePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentInteractionControllerDelegate {
    public let identifier = "BalanceInstagramSharePlugin"
    public let jsName = "BalanceInstagramShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareImageToInstagram", returnType: CAPPluginReturnPromise)
    ]

    private var documentInteractionController: UIDocumentInteractionController?

    @objc func shareImageToInstagram(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl"), let target = call.getString("target") else {
            call.resolve(["opened": false, "reason": "missing-args"])
            return
        }

        guard let imageData = Self.imageData(from: dataUrl) else {
            call.resolve(["opened": false, "reason": "bad-data-url"])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["opened": false, "reason": "plugin-unavailable"])
                return
            }

            if target == "story" {
                self.shareToStory(imageData, call: call)
            } else {
                self.shareToFeed(imageData, call: call)
            }
        }
    }

    private func shareToStory(_ imageData: Data, call: CAPPluginCall) {
        guard let url = URL(string: "instagram-stories://share"), UIApplication.shared.canOpenURL(url) else {
            call.resolve(["opened": false, "target": "story", "reason": "instagram-unavailable"])
            return
        }

        UIPasteboard.general.setItems(
            [[
                "com.instagram.sharedSticker.backgroundImage": imageData,
                "com.instagram.sharedSticker.backgroundTopColor": "#0f3d2e",
                "com.instagram.sharedSticker.backgroundBottomColor": "#f5c45c",
                "com.instagram.sharedSticker.contentURL": "https://plantbased-balance.org/bio"
            ]],
            options: [.expirationDate: Date().addingTimeInterval(300)]
        )

        UIApplication.shared.open(url, options: [:]) { opened in
            call.resolve(["opened": opened, "target": "story"])
        }
    }

    private func shareToFeed(_ imageData: Data, call: CAPPluginCall) {
        guard let instagramUrl = URL(string: "instagram://app"), UIApplication.shared.canOpenURL(instagramUrl) else {
            call.resolve(["opened": false, "target": "feed", "reason": "instagram-unavailable"])
            return
        }

        guard let sourceView = bridge?.viewController?.view else {
            call.resolve(["opened": false, "target": "feed", "reason": "view-unavailable"])
            return
        }

        do {
            let fileUrl = FileManager.default.temporaryDirectory
                .appendingPathComponent("balance-instagram-\(UUID().uuidString).igo")
            try imageData.write(to: fileUrl, options: .atomic)

            let controller = UIDocumentInteractionController(url: fileUrl)
            controller.delegate = self
            controller.uti = "com.instagram.exclusivegram"
            controller.annotation = ["InstagramCaption": ""]
            documentInteractionController = controller

            let anchor = CGRect(
                x: sourceView.bounds.midX,
                y: sourceView.bounds.midY,
                width: 1,
                height: 1
            )
            let opened = controller.presentOpenInMenu(from: anchor, in: sourceView, animated: true)
            if !opened {
                documentInteractionController = nil
            }
            call.resolve(["opened": opened, "target": "feed"])
        } catch {
            call.reject("Could not prepare Instagram feed share: \(error.localizedDescription)")
        }
    }

    public func documentInteractionControllerDidDismissOpenInMenu(_ controller: UIDocumentInteractionController) {
        if controller === documentInteractionController {
            documentInteractionController = nil
        }
    }

    private static func imageData(from dataUrl: String) -> Data? {
        guard let comma = dataUrl.firstIndex(of: ",") else { return nil }
        let base64 = String(dataUrl[dataUrl.index(after: comma)...])
        return Data(base64Encoded: base64, options: [.ignoreUnknownCharacters])
    }
}
