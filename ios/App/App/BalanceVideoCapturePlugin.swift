import Foundation
import AVFoundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

@objc(BalanceVideoCapturePlugin)
public class BalanceVideoCapturePlugin: CAPPlugin, CAPBridgedPlugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate, UIDocumentPickerDelegate {
    public let identifier = "BalanceVideoCapturePlugin"
    public let jsName = "BalanceVideoCapture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "captureWorkoutVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickWorkoutVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enqueueExerciseVideoUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getExerciseVideoUploadStatus", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var pendingPickerCall: CAPPluginCall?
    private var shouldIncludeVideoData = false
    private static let uploadStatusPrefix = "exercise_video_"
    private static let siteURL = "https://plantbased-balance.org"

    private struct ExerciseUploadPayload: Sendable {
        let accessToken: String
        let userId: String
        let exerciseId: String
        let sourceURL: URL
        let fileName: String
        let contentType: String
        let techniqueData: Data
    }

    private enum ExerciseUploadError: LocalizedError {
        case invalidResponse
        case http(Int, String)
        case incompleteTarget

        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "The upload service returned an invalid response."
            case .http(let status, let message):
                return message.isEmpty ? "The upload service returned HTTP \(status)." : message
            case .incompleteTarget:
                return "The upload target was incomplete."
            }
        }
    }

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

    @objc func pickWorkoutVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["cancelled": true, "reason": "plugin-unavailable"])
                return
            }
            guard self.pendingPickerCall == nil, self.pendingCall == nil else {
                call.resolve(["cancelled": true, "reason": "picker-busy"])
                return
            }
            guard let viewController = self.bridge?.viewController else {
                call.resolve(["cancelled": true, "reason": "view-unavailable"])
                return
            }

            self.pendingPickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.movie], asCopy: true)
            picker.allowsMultipleSelection = false
            picker.delegate = self
            viewController.present(picker, animated: true)
        }
    }

    @objc func enqueueExerciseVideoUpload(_ call: CAPPluginCall) {
        guard let raw = call.getObject("payload"),
              let accessToken = raw["accessToken"] as? String,
              let userId = raw["userId"] as? String,
              let exerciseId = raw["exerciseId"] as? String,
              let sourcePath = raw["sourcePath"] as? String,
              !accessToken.isEmpty,
              !userId.isEmpty,
              !exerciseId.isEmpty,
              !sourcePath.isEmpty else {
            call.reject("The exercise video upload request was incomplete.")
            return
        }

        let sourceURL = URL(fileURLWithPath: sourcePath)
        guard FileManager.default.fileExists(atPath: sourceURL.path) else {
            call.reject("The selected video is no longer available.")
            return
        }

        do {
            let durableURL = try Self.copyToUploadCache(sourceURL, exerciseId: exerciseId)
            let technique = raw["technique"] ?? [:]
            let techniqueData = (try? JSONSerialization.data(withJSONObject: technique)) ?? Data("{}".utf8)
            let payload = ExerciseUploadPayload(
                accessToken: accessToken,
                userId: userId,
                exerciseId: exerciseId,
                sourceURL: durableURL,
                fileName: (raw["fileName"] as? String) ?? sourceURL.lastPathComponent,
                contentType: (raw["contentType"] as? String) ?? "video/mp4",
                techniqueData: techniqueData
            )
            Self.writeUploadStatus(exerciseId, status: "preparing", progress: 0)
            call.resolve(["accepted": true, "bridgeVersion": 1])
            Task(priority: .utility) {
                await Self.performExerciseVideoUpload(payload)
            }
        } catch {
            call.reject("Could not prepare the selected video: \(error.localizedDescription)")
        }
    }

    @objc func getExerciseVideoUploadStatus(_ call: CAPPluginCall) {
        guard let exerciseId = call.getString("exerciseId"), !exerciseId.isEmpty else {
            call.resolve(["status": "missing", "progress": 0])
            return
        }
        let key = Self.uploadStatusKey(exerciseId)
        guard let raw = UserDefaults.standard.string(forKey: key),
              let data = raw.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            call.resolve(["status": "missing", "progress": 0])
            return
        }
        call.resolve(value)
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

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        controller.dismiss(animated: true) { [weak self] in
            self?.pendingPickerCall?.resolve(["cancelled": true])
            self?.pendingPickerCall = nil
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let sourceURL = urls.first else {
            documentPickerWasCancelled(controller)
            return
        }
        let accessed = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if accessed { sourceURL.stopAccessingSecurityScopedResource() }
        }
        do {
            let result = try prepareResult(for: sourceURL)
            controller.dismiss(animated: true) { [weak self] in
                self?.pendingPickerCall?.resolve(result)
                self?.pendingPickerCall = nil
            }
        } catch {
            controller.dismiss(animated: true) { [weak self] in
                self?.pendingPickerCall?.reject("Could not prepare selected video: \(error.localizedDescription)")
                self?.pendingPickerCall = nil
            }
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
            "nativePath": destination.path,
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

    private static func copyToUploadCache(_ sourceURL: URL, exerciseId: String) throws -> URL {
        let manager = FileManager.default
        let root = try manager.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("exercise_video_uploads", isDirectory: true)
        try manager.createDirectory(at: root, withIntermediateDirectories: true)
        let safeId = exerciseId.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "", options: .regularExpression)
        let ext = sourceURL.pathExtension.isEmpty ? "mp4" : sourceURL.pathExtension
        let destination = root.appendingPathComponent("\(safeId)-\(UUID().uuidString).\(ext)")
        try manager.copyItem(at: sourceURL, to: destination)
        return destination
    }

    private static func performExerciseVideoUpload(_ payload: ExerciseUploadPayload) async {
        do {
            let attrs = try FileManager.default.attributesOfItem(atPath: payload.sourceURL.path)
            let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
            guard size > 0 else { throw ExerciseUploadError.invalidResponse }

            writeUploadStatus(payload.exerciseId, status: "preparing", progress: 1)
            let target = try await postJSON(
                path: "/api/create-exercise-video-upload",
                token: payload.accessToken,
                body: [
                    "userId": payload.userId,
                    "exerciseId": payload.exerciseId,
                    "fileName": payload.fileName,
                    "contentType": payload.contentType,
                    "size": size
                ]
            )
            guard let uploadURLString = target["uploadUrl"] as? String,
                  let uploadURL = URL(string: uploadURLString),
                  let authorizationToken = target["authorizationToken"] as? String,
                  let storagePath = target["fileName"] as? String,
                  let publicURL = target["publicUrl"] as? String else {
                throw ExerciseUploadError.incompleteTarget
            }

            writeUploadStatus(payload.exerciseId, status: "uploading", progress: 5)
            var request = URLRequest(url: uploadURL)
            request.httpMethod = "POST"
            request.timeoutInterval = 300
            request.setValue(authorizationToken, forHTTPHeaderField: "Authorization")
            request.setValue(encodeB2FileName(storagePath), forHTTPHeaderField: "X-Bz-File-Name")
            request.setValue(payload.contentType, forHTTPHeaderField: "Content-Type")
            request.setValue(String(size), forHTTPHeaderField: "Content-Length")
            request.setValue("do_not_verify", forHTTPHeaderField: "X-Bz-Content-Sha1")
            let (uploadData, uploadResponse) = try await URLSession.shared.upload(for: request, fromFile: payload.sourceURL)
            try validateHTTP(uploadResponse, data: uploadData)

            writeUploadStatus(payload.exerciseId, status: "saving", progress: 100, publicUrl: publicURL, storagePath: storagePath)
            _ = try await postJSON(
                path: "/api/finalize-exercise-video-upload",
                token: payload.accessToken,
                body: [
                    "userId": payload.userId,
                    "exerciseId": payload.exerciseId,
                    "videoUrl": publicURL,
                    "storagePath": storagePath
                ]
            )
            let technique = (try? JSONSerialization.jsonObject(with: payload.techniqueData)) ?? [:]
            _ = try await postJSON(
                path: "/api/custom-exercise-review",
                token: payload.accessToken,
                body: [
                    "action": "submit",
                    "exerciseId": payload.exerciseId,
                    "technique": technique
                ]
            )
            writeUploadStatus(payload.exerciseId, status: "uploaded", progress: 100, publicUrl: publicURL, storagePath: storagePath)
            try? FileManager.default.removeItem(at: payload.sourceURL)
        } catch {
            writeUploadStatus(
                payload.exerciseId,
                status: "failed",
                progress: 0,
                error: error.localizedDescription.isEmpty ? "Video upload failed. Tap Retry video." : error.localizedDescription
            )
        }
    }

    private static func postJSON(path: String, token: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: siteURL + path) else { throw ExerciseUploadError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateHTTP(response, data: data)
        if data.isEmpty { return [:] }
        guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ExerciseUploadError.invalidResponse
        }
        return value
    }

    private static func validateHTTP(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw ExerciseUploadError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message: String
            if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let error = object["error"] as? String {
                message = error
            } else {
                message = String(data: data, encoding: .utf8) ?? ""
            }
            throw ExerciseUploadError.http(http.statusCode, message)
        }
    }

    private static func encodeB2FileName(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~/"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private static func uploadStatusKey(_ exerciseId: String) -> String {
        let safeId = exerciseId.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "", options: .regularExpression)
        return uploadStatusPrefix + safeId
    }

    private static func writeUploadStatus(
        _ exerciseId: String,
        status: String,
        progress: Int,
        error: String? = nil,
        publicUrl: String? = nil,
        storagePath: String? = nil
    ) {
        var value: [String: Any] = ["status": status, "progress": progress]
        if let error = error { value["error"] = error }
        if let publicUrl = publicUrl { value["publicUrl"] = publicUrl }
        if let storagePath = storagePath { value["storagePath"] = storagePath }
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let raw = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(raw, forKey: uploadStatusKey(exerciseId))
    }
}
