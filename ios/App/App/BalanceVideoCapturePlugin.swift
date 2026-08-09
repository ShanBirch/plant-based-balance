import Foundation
import AVFoundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

@objc(BalanceVideoCapturePlugin)
public class BalanceVideoCapturePlugin: CAPPlugin, CAPBridgedPlugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "BalanceVideoCapturePlugin"
    public let jsName = "BalanceVideoCapture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "captureWorkoutVideo", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var shouldIncludeVideoData = false

    @objc func captureWorkoutVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["cancelled": true, "reason": "plugin-unavailable"])
                return
            }

            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.captureWorkoutVideo(call)
                        } else {
                            self.showCameraPermissionRecovery(call)
                        }
                    }
                }
                return
            case .denied, .restricted:
                self.showCameraPermissionRecovery(call)
                return
            default:
                break
            }

            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.resolve(["cancelled": true, "reason": "camera-unavailable"])
                return
            }

            let movieType = UTType.movie.identifier
            let availableTypes = UIImagePickerController.availableMediaTypes(for: .camera) ?? []
            guard availableTypes.contains(movieType) else {
                call.resolve(["cancelled": true, "reason": "video-unavailable"])
                return
            }

            if self.pendingCall != nil {
                call.resolve(["cancelled": true, "reason": "camera-busy"])
                return
            }

            guard let viewController = self.bridge?.viewController else {
                call.resolve(["cancelled": true, "reason": "view-unavailable"])
                return
            }

            self.pendingCall = call
            self.shouldIncludeVideoData = call.getBool("includeDataBase64") ?? false

            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.mediaTypes = [movieType]
            picker.cameraCaptureMode = .video
            if UIImagePickerController.isCameraDeviceAvailable(.rear) {
                picker.cameraDevice = .rear
            }
            picker.videoQuality = .typeHigh
            picker.videoMaximumDuration = TimeInterval(call.getInt("maxDurationSeconds") ?? 75)
            picker.delegate = self

            viewController.present(picker, animated: true)
        }
    }

    private func showCameraPermissionRecovery(_ call: CAPPluginCall) {
        call.resolve(["cancelled": true, "reason": "permission-denied"])

        guard let viewController = bridge?.viewController else { return }
        let alert = UIAlertController(
            title: "Connect camera?",
            message: "Balance needs camera access to film your sets. Open Settings to connect it.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Not now", style: .cancel))
        alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
            guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
            UIApplication.shared.open(settingsURL)
        })
        viewController.present(alert, animated: true)
    }
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { [weak self] in
            self?.pendingCall?.resolve(["cancelled": true])
            self?.pendingCall = nil
            self?.shouldIncludeVideoData = false
        }
    }

    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        guard let sourceUrl = info[.mediaURL] as? URL else {
            picker.dismiss(animated: true) { [weak self] in
                self?.pendingCall?.resolve(["cancelled": true, "reason": "missing-video"])
                self?.pendingCall = nil
                self?.shouldIncludeVideoData = false
            }
            return
        }

        do {
            let result = try prepareResult(for: sourceUrl)
            picker.dismiss(animated: true) { [weak self] in
                self?.pendingCall?.resolve(result)
                self?.pendingCall = nil
                self?.shouldIncludeVideoData = false
            }
        } catch {
            picker.dismiss(animated: true) { [weak self] in
                self?.pendingCall?.reject("Could not prepare recorded video: \(error.localizedDescription)")
                self?.pendingCall = nil
                self?.shouldIncludeVideoData = false
            }
        }
    }

    private func prepareResult(for sourceUrl: URL) throws -> [String: Any] {
        let ext = sourceUrl.pathExtension.isEmpty ? "mov" : sourceUrl.pathExtension
        let fileName = "share-set-\(UUID().uuidString).\(ext)"
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.copyItem(at: sourceUrl, to: destination)

        let attrs = try? FileManager.default.attributesOfItem(atPath: destination.path)
        let size = attrs?[.size] as? NSNumber
        let mimeType = UTType(filenameExtension: ext)?.preferredMIMEType ?? "video/quicktime"
        let webPath = bridge?.portablePath(fromLocalURL: destination)?.absoluteString

        var result: [String: Any] = [
            "cancelled": false,
            "path": destination.absoluteString,
            "name": fileName,
            "mimeType": mimeType
        ]
        if let webPath = webPath {
            result["webPath"] = webPath
        }
        if let size = size {
            result["size"] = size.int64Value
        }
        if shouldIncludeVideoData {
            let videoData = try Data(contentsOf: destination, options: .mappedIfSafe)
            result["dataBase64"] = videoData.base64EncodedString()
        }
        return result
    }
}
