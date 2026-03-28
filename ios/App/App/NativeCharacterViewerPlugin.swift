import Foundation
import Capacitor
import SceneKit
import GLTFKit2

@objc(NativeCharacterViewerPlugin)
public class NativeCharacterViewerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCharacterViewerPlugin"
    public let jsName = "NativeCharacterViewer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAnimation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAnimation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setCamera", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dispose", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Properties

    private var sceneView: SCNView?
    private var containerView: UIView?
    private var currentScene: SCNScene?
    private var characterNode: SCNNode?
    private var cameraNode: SCNNode?
    private var lightNodes: [SCNNode] = []
    private var currentAnimations: [String: SCNAnimationPlayer] = [:]
    private var availableAnimations: [String] = []
    private var activeAnimationKey: String?
    private var modelCache: [String: URL] = [:] // url -> local file path

    private let cacheDir: URL = {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("glb_models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    // MARK: - Show

    @objc func show(_ call: CAPPluginCall) {
        let x = call.getFloat("x") ?? 0
        let y = call.getFloat("y") ?? 0
        let width = call.getFloat("width") ?? Float(UIScreen.main.bounds.width)
        let height = call.getFloat("height") ?? 420

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.sceneView != nil {
                // Already visible — just reposition
                self.containerView?.frame = CGRect(
                    x: CGFloat(x), y: CGFloat(y),
                    width: CGFloat(width), height: CGFloat(height)
                )
                self.sceneView?.frame = self.containerView?.bounds ?? .zero
                call.resolve(["shown": true])
                return
            }

            guard let webView = self.bridge?.webView,
                  let parentView = webView.superview else {
                call.reject("Cannot find parent view")
                return
            }

            let frame = CGRect(
                x: CGFloat(x), y: CGFloat(y),
                width: CGFloat(width), height: CGFloat(height)
            )

            // Container with transparent background
            let container = UIView(frame: frame)
            container.backgroundColor = .clear
            container.isUserInteractionEnabled = true
            container.clipsToBounds = true

            // SceneKit view
            let sv = SCNView(frame: container.bounds)
            sv.backgroundColor = .clear
            sv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            sv.allowsCameraControl = true
            sv.antialiasingMode = .multisampling2X
            sv.preferredFramesPerSecond = 60
            sv.isPlaying = true

            // Create scene
            let scene = SCNScene()
            scene.background.contents = UIColor.clear
            sv.scene = scene

            // Set up camera
            let camera = SCNCamera()
            camera.fieldOfView = 55
            camera.zNear = 0.1
            camera.zFar = 200

            let camNode = SCNNode()
            camNode.camera = camera
            camNode.position = SCNVector3(0, 1.5, 22)
            camNode.look(at: SCNVector3(0, 1.0, 0))
            scene.rootNode.addChildNode(camNode)
            sv.pointOfView = camNode
            self.cameraNode = camNode

            // Lighting
            self.setupLighting(in: scene)

            container.addSubview(sv)
            parentView.addSubview(container)
            // Place above webview but below any system overlays
            parentView.bringSubviewToFront(container)

            self.containerView = container
            self.sceneView = sv
            self.currentScene = scene

            call.resolve(["shown": true])
        }
    }

    // MARK: - Hide

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.containerView?.removeFromSuperview()
            self?.sceneView = nil
            self?.containerView = nil
            call.resolve(["hidden": true])
        }
    }

    // MARK: - Load Model

    @objc func loadModel(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url") else {
            call.reject("Missing model URL")
            return
        }

        Task { [weak self] in
            guard let self = self else { return }

            do {
                let localURL = try await self.downloadOrCacheModel(urlString: urlString)
                let asset = try GLTFAsset(url: localURL)
                let source = SCNScene.Source(asset: asset)
                let scene = try source.scene()

                await MainActor.run {
                    guard let currentScene = self.currentScene else {
                        call.reject("Viewer not shown. Call show() first.")
                        return
                    }

                    // Remove old character
                    self.characterNode?.removeFromParentNode()
                    self.currentAnimations.removeAll()
                    self.availableAnimations.removeAll()
                    self.activeAnimationKey = nil

                    // Add new character as a wrapper node
                    let wrapper = SCNNode()
                    for child in scene.rootNode.childNodes {
                        wrapper.addChildNode(child.clone())
                    }
                    currentScene.rootNode.addChildNode(wrapper)
                    self.characterNode = wrapper

                    // Extract animations
                    self.extractAnimations(from: scene)

                    // Apply idle animation by default
                    self.applyIdleAnimation()

                    call.resolve([
                        "loaded": true,
                        "animations": self.availableAnimations
                    ])
                }
            } catch {
                call.reject("Failed to load model: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Play Animation

    @objc func playAnimation(_ call: CAPPluginCall) {
        guard let name = call.getString("name") else {
            call.reject("Missing animation name")
            return
        }

        let loop = call.getBool("loop") ?? false
        let returnToIdle = call.getBool("returnToIdle") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Stop current animation
            if let activeKey = self.activeAnimationKey,
               let player = self.currentAnimations[activeKey] {
                player.stop(withBlendOutDuration: 0.3)
            }

            // Find the requested animation (case-insensitive partial match)
            let matchedKey = self.findAnimationKey(for: name)

            guard let key = matchedKey, let player = self.currentAnimations[key] else {
                call.reject("Animation '\(name)' not found. Available: \(self.availableAnimations.joined(separator: ", "))")
                return
            }

            let animation = player.animation
            animation.repeatCount = loop ? .greatestFiniteMagnitude : 1
            animation.blendInDuration = 0.3
            animation.blendOutDuration = 0.3
            animation.isRemovedOnCompletion = !loop

            player.play()
            self.activeAnimationKey = key

            if !loop && returnToIdle {
                // Return to idle after animation completes
                let duration = animation.duration
                DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.1) { [weak self] in
                    guard self?.activeAnimationKey == key else { return }
                    self?.applyIdleAnimation()
                }
            }

            call.resolve([
                "playing": true,
                "animation": key,
                "duration": player.animation.duration
            ])
        }
    }

    // MARK: - Stop Animation

    @objc func stopAnimation(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if let activeKey = self.activeAnimationKey,
               let player = self.currentAnimations[activeKey] {
                player.stop(withBlendOutDuration: 0.3)
            }
            self.activeAnimationKey = nil

            call.resolve(["stopped": true])
        }
    }

    // MARK: - Set Camera

    @objc func setCamera(_ call: CAPPluginCall) {
        let orbit = call.getString("orbit") // e.g. "0deg 85deg 22m"
        let fov = call.getFloat("fieldOfView")

        DispatchQueue.main.async { [weak self] in
            guard let self = self, let camNode = self.cameraNode else {
                call.reject("Camera not initialized")
                return
            }

            if let orbit = orbit {
                let parsed = self.parseOrbit(orbit)
                let theta = parsed.theta * .pi / 180
                let phi = parsed.phi * .pi / 180
                let dist = parsed.distance

                let x = dist * sin(phi) * sin(theta)
                let y = dist * cos(phi)
                let z = dist * sin(phi) * cos(theta)

                SCNTransaction.begin()
                SCNTransaction.animationDuration = 0.3
                camNode.position = SCNVector3(x, y, z)
                camNode.look(at: SCNVector3(0, 1.0, 0))
                SCNTransaction.commit()
            }

            if let fov = fov {
                SCNTransaction.begin()
                SCNTransaction.animationDuration = 0.3
                camNode.camera?.fieldOfView = CGFloat(fov)
                SCNTransaction.commit()
            }

            call.resolve(["updated": true])
        }
    }

    // MARK: - Dispose

    @objc func dispose(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.characterNode?.removeFromParentNode()
            self.characterNode = nil
            self.currentAnimations.removeAll()
            self.availableAnimations.removeAll()
            self.activeAnimationKey = nil
            self.lightNodes.forEach { $0.removeFromParentNode() }
            self.lightNodes.removeAll()
            self.cameraNode?.removeFromParentNode()
            self.cameraNode = nil
            self.currentScene = nil
            self.containerView?.removeFromSuperview()
            self.sceneView = nil
            self.containerView = nil

            call.resolve(["disposed": true])
        }
    }

    // MARK: - Private Helpers

    private func setupLighting(in scene: SCNScene) {
        lightNodes.forEach { $0.removeFromParentNode() }
        lightNodes.removeAll()

        // Key light (warm, from front-right)
        let keyLight = SCNLight()
        keyLight.type = .directional
        keyLight.intensity = 800
        keyLight.color = UIColor(white: 1.0, alpha: 1.0)
        keyLight.castsShadow = false
        let keyNode = SCNNode()
        keyNode.light = keyLight
        keyNode.eulerAngles = SCNVector3(-Float.pi / 4, Float.pi / 6, 0)
        scene.rootNode.addChildNode(keyNode)
        lightNodes.append(keyNode)

        // Fill light (softer, from left)
        let fillLight = SCNLight()
        fillLight.type = .directional
        fillLight.intensity = 400
        fillLight.color = UIColor(red: 0.9, green: 0.95, blue: 1.0, alpha: 1.0)
        let fillNode = SCNNode()
        fillNode.light = fillLight
        fillNode.eulerAngles = SCNVector3(-Float.pi / 6, -Float.pi / 4, 0)
        scene.rootNode.addChildNode(fillNode)
        lightNodes.append(fillNode)

        // Ambient light
        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 300
        ambient.color = UIColor(white: 0.9, alpha: 1.0)
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)
        lightNodes.append(ambientNode)
    }

    private func extractAnimations(from scene: SCNScene) {
        // GLTFKit2 attaches animations to nodes; collect them all
        scene.rootNode.enumerateChildNodes { node, _ in
            for key in node.animationKeys {
                if let player = node.animationPlayer(forKey: key) {
                    let animName = key.components(separatedBy: "/").last ?? key
                    let cleanName = animName
                        .replacingOccurrences(of: "Animation-", with: "")
                        .replacingOccurrences(of: "_", with: "_")
                        .trimmingCharacters(in: .whitespaces)

                    if !cleanName.isEmpty {
                        self.currentAnimations[cleanName] = player
                        self.availableAnimations.append(cleanName)

                        // Also add to the character node so animations work on cloned nodes
                        self.characterNode?.addAnimationPlayer(player, forKey: cleanName)
                    }
                }
            }
        }

        // Also check scene-level animation sources
        if let animationKeys = currentScene?.rootNode.animationKeys {
            for key in animationKeys {
                if let player = currentScene?.rootNode.animationPlayer(forKey: key),
                   !currentAnimations.keys.contains(key) {
                    currentAnimations[key] = player
                    availableAnimations.append(key)
                }
            }
        }
    }

    private func findAnimationKey(for name: String) -> String? {
        let lower = name.lowercased()

        // Exact match first
        if currentAnimations[name] != nil { return name }

        // Case-insensitive exact match
        if let key = currentAnimations.keys.first(where: { $0.lowercased() == lower }) {
            return key
        }

        // Contains match
        if let key = currentAnimations.keys.first(where: { $0.lowercased().contains(lower) }) {
            return key
        }

        return nil
    }

    private func applyIdleAnimation() {
        // Match the JS priority order: idle → stand → stand_hands_on_hips → arms_up_still → fold_arms → first available
        let priorityOrder = ["idle", "stand", "stand_hands_on_hips", "arms_up_still", "fold_arms"]

        for name in priorityOrder {
            if let key = findAnimationKey(for: name), let player = currentAnimations[key] {
                let animation = player.animation
                animation.repeatCount = .greatestFiniteMagnitude
                animation.blendInDuration = 0.3
                animation.isRemovedOnCompletion = false
                player.play()
                activeAnimationKey = key
                return
            }
        }

        // Fallback: play first available animation
        if let firstKey = currentAnimations.keys.first, let player = currentAnimations[firstKey] {
            let animation = player.animation
            animation.repeatCount = .greatestFiniteMagnitude
            animation.blendInDuration = 0.3
            animation.isRemovedOnCompletion = false
            player.play()
            activeAnimationKey = firstKey
        }
    }

    private func parseOrbit(_ orbit: String) -> (theta: Float, phi: Float, distance: Float) {
        // Parse "0deg 85deg 22m" format
        let parts = orbit.components(separatedBy: " ")
        var theta: Float = 0
        var phi: Float = 85
        var distance: Float = 22

        if parts.count >= 1 {
            theta = Float(parts[0].replacingOccurrences(of: "deg", with: "")) ?? 0
        }
        if parts.count >= 2 {
            phi = Float(parts[1].replacingOccurrences(of: "deg", with: "")) ?? 85
        }
        if parts.count >= 3 {
            distance = Float(parts[2].replacingOccurrences(of: "m", with: "")) ?? 22
        }

        return (theta, phi, distance)
    }

    // MARK: - Model Download & Cache

    private func downloadOrCacheModel(urlString: String) async throws -> URL {
        // Check memory cache
        if let cached = modelCache[urlString], FileManager.default.fileExists(atPath: cached.path) {
            return cached
        }

        // Check disk cache
        let filename = urlString.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? UUID().uuidString
        let localPath = cacheDir.appendingPathComponent(filename + ".glb")

        if FileManager.default.fileExists(atPath: localPath.path) {
            modelCache[urlString] = localPath
            return localPath
        }

        // Download
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "NativeCharacterViewer", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(urlString)"])
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NativeCharacterViewer", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "HTTP error downloading model"])
        }

        try data.write(to: localPath)
        modelCache[urlString] = localPath

        return localPath
    }
}
