import Foundation
import Capacitor
import UIKit

@objc(BalanceInstagramSharePlugin)
public class BalanceInstagramSharePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentInteractionControllerDelegate {
    public let identifier = "BalanceInstagramSharePlugin"
    public let jsName = "BalanceInstagramShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareImageToInstagram", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareVideoToInstagram", returnType: CAPPluginReturnPromise)
    ]

    private var documentInteractionController: UIDocumentInteractionController?
    private var activityViewController: UIActivityViewController?

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

    @objc func shareVideoToInstagram(_ call: CAPPluginCall) {
        guard let dataUrl = call.getString("dataUrl"), let target = call.getString("target") else {
            call.resolve(["opened": false, "reason": "missing-args"])
            return
        }

        guard let media = Self.mediaData(from: dataUrl), media.mimeType.hasPrefix("video/") else {
            call.resolve(["opened": false, "reason": "bad-video-data-url"])
            return
        }

        guard media.mimeType == "video/mp4" || media.mimeType == "video/quicktime" else {
            call.resolve(["opened": false, "reason": "unsupported-video-type", "mimeType": media.mimeType])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["opened": false, "reason": "plugin-unavailable"])
                return
            }
            if target == "story" {
                self.shareVideoToStory(media.data, call: call)
            } else {
                self.shareVideoToFeed(media.data, mimeType: media.mimeType, call: call)
            }
        }
    }

    private func shareToStory(_ imageData: Data, call: CAPPluginCall) {
        let sourceApplication = Bundle.main.bundleIdentifier ?? "com.fitgotchi.app"
        let encodedSourceApplication = sourceApplication.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sourceApplication
        guard let url = URL(string: "instagram-stories://share?source_application=\(encodedSourceApplication)"), UIApplication.shared.canOpenURL(url) else {
            call.resolve(["opened": false, "target": "story", "reason": "instagram-unavailable"])
            return
        }

        UIPasteboard.general.setItems(
            [[
                "com.instagram.sharedSticker.backgroundImage": imageData,
                "com.instagram.sharedSticker.backgroundTopColor": "#0f3d2e",
                "com.instagram.sharedSticker.backgroundBottomColor": "#f5c45c",
                "com.instagram.sharedSticker.contentURL": "https://plantbased-balance.org/bio",
                "com.instagram.sharedSticker.appID": sourceApplication
            ]],
            options: [.expirationDate: Date().addingTimeInterval(300)]
        )

        UIApplication.shared.open(url, options: [:]) { opened in
            call.resolve(["opened": opened, "target": "story"])
        }
    }

    private func shareVideoToStory(_ videoData: Data, call: CAPPluginCall) {
        let sourceApplication = Bundle.main.bundleIdentifier ?? "com.fitgotchi.app"
        let encodedSourceApplication = sourceApplication.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sourceApplication
        guard let url = URL(string: "instagram-stories://share?source_application=\(encodedSourceApplication)"), UIApplication.shared.canOpenURL(url) else {
            call.resolve(["opened": false, "target": "story", "reason": "instagram-unavailable"])
            return
        }

        UIPasteboard.general.setItems(
            [[
                "com.instagram.sharedSticker.backgroundVideo": videoData,
                "com.instagram.sharedSticker.backgroundTopColor": "#0f3d2e",
                "com.instagram.sharedSticker.backgroundBottomColor": "#f5c45c",
                "com.instagram.sharedSticker.contentURL": "https://plantbased-balance.org/bio",
                "com.instagram.sharedSticker.appID": sourceApplication
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

    private func shareVideoToFeed(_ videoData: Data, mimeType: String, call: CAPPluginCall) {
        guard let sourceViewController = bridge?.viewController else {
            call.resolve(["opened": false, "target": "feed", "reason": "view-unavailable"])
            return
        }
        do {
            let fileExtension = mimeType == "video/quicktime" ? "mov" : "mp4"
            let fileUrl = FileManager.default.temporaryDirectory
                .appendingPathComponent("balance-instagram-motion-\(UUID().uuidString).\(fileExtension)")
            try videoData.write(to: fileUrl, options: .atomic)
            let controller = UIActivityViewController(activityItems: [fileUrl], applicationActivities: nil)
            controller.popoverPresentationController?.sourceView = sourceViewController.view
            controller.popoverPresentationController?.sourceRect = CGRect(
                x: sourceViewController.view.bounds.midX,
                y: sourceViewController.view.bounds.midY,
                width: 1,
                height: 1
            )
            controller.completionWithItemsHandler = { [weak self] _, _, _, _ in
                self?.activityViewController = nil
                try? FileManager.default.removeItem(at: fileUrl)
            }
            activityViewController = controller
            sourceViewController.present(controller, animated: true) {
                call.resolve(["opened": true, "target": "feed"])
            }
        } catch {
            call.reject("Could not prepare Instagram motion share: \(error.localizedDescription)")
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

    private static func mediaData(from dataUrl: String) -> (data: Data, mimeType: String)? {
        guard dataUrl.hasPrefix("data:"), let semicolon = dataUrl.firstIndex(of: ";"), let comma = dataUrl.firstIndex(of: ","), semicolon < comma else {
            return nil
        }
        let mimeStart = dataUrl.index(dataUrl.startIndex, offsetBy: 5)
        let mimeType = String(dataUrl[mimeStart..<semicolon])
        let base64 = String(dataUrl[dataUrl.index(after: comma)...])
        guard let data = Data(base64Encoded: base64, options: [.ignoreUnknownCharacters]) else { return nil }
        return (data, mimeType)
    }
}
