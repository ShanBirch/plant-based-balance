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
    private var statusLabel: UILabel?

    private let cacheDir: URL = {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("glb_models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // MARK: - Status Label (visible diagnostic on-device without Xcode)

    private func updateStatus(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let container = self.containerView else { return }
            if self.statusLabel == nil {
                let label = UILabel()
                label.font = UIFont.monospacedSystemFont(ofSize: 10, weight: .regular)
                label.textColor = UIColor.green
                label.backgroundColor = UIColor(white: 0, alpha: 0.7)
                label.numberOfLines = 0
                label.textAlignment = .left
                label.translatesAutoresizingMaskIntoConstraints = false
                container.addSubview(label)
                NSLayoutConstraint.activate([
                    label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 4),
                    label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -4),
                    label.topAnchor.constraint(equalTo: container.topAnchor, constant: 4)
                ])
                self.statusLabel = label
            }
            self.statusLabel?.text = (self.statusLabel?.text ?? "") + "\n" + text
            // Trim to last 14 lines to avoid overflow
            if let lines = self.statusLabel?.text?.components(separatedBy: "\n"), lines.count > 14 {
                self.statusLabel?.text = lines.suffix(14).joined(separator: "\n")
            }
        }
    }

    private func clearStatus() {
        DispatchQueue.main.async { [weak self] in
            self?.statusLabel?.removeFromSuperview()
            self?.statusLabel = nil
        }
    }

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "renderer": "SceneKit",
            "device": UIDevice.current.model
        ])
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
                let webOrigin = self.bridge?.webView?.frame.origin ?? .zero
                self.containerView?.frame = CGRect(
                    x: CGFloat(x) + webOrigin.x,
                    y: CGFloat(y) + webOrigin.y,
                    width: CGFloat(width), height: CGFloat(height)
                )
                self.sceneView?.frame = self.containerView?.bounds ?? .zero
                call.resolve(["shown": true, "repositioned": true])
                return
            }

            guard let webView = self.bridge?.webView else {
                call.reject("Cannot find WebView")
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
            sv.isOpaque = false
            sv.layer.isOpaque = false
            sv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            sv.allowsCameraControl = true
            sv.antialiasingMode = .multisampling2X
            sv.preferredFramesPerSecond = 60
            sv.isPlaying = true
            sv.contentScaleFactor = UIScreen.main.scale

            // Create scene
            let scene = SCNScene()
            scene.background.contents = UIColor.clear
            sv.scene = scene

            // Set up camera
            let camera = SCNCamera()
            camera.fieldOfView = 55
            camera.zNear = 0.01
            camera.zFar = 200
            camera.wantsHDR = true

            let camNode = SCNNode()
            camNode.camera = camera
            camNode.position = SCNVector3(0, 1.0, 3.0)
            camNode.look(at: SCNVector3(0, 0.8, 0))
            scene.rootNode.addChildNode(camNode)
            sv.pointOfView = camNode
            self.cameraNode = camNode

            // Lighting
            self.setupLighting(in: scene)

            container.addSubview(sv)

            // Add a small test cube so we can verify SceneKit renders at all.
            // It will be removed once a real model loads successfully.
            let testCube = SCNBox(width: 0.3, height: 0.3, length: 0.3, chamferRadius: 0.05)
            testCube.firstMaterial?.diffuse.contents = UIColor.systemGreen
            testCube.firstMaterial?.lightingModel = .physicallyBased
            let cubeNode = SCNNode(geometry: testCube)
            cubeNode.name = "_debug_cube"
            cubeNode.position = SCNVector3(0, 0.8, 0)
            // Spin the cube so it's obvious SceneKit is alive
            let spin = CABasicAnimation(keyPath: "rotation")
            spin.toValue = NSValue(scnVector4: SCNVector4(0, 1, 0, Float.pi * 2))
            spin.duration = 3
            spin.repeatCount = .greatestFiniteMagnitude
            cubeNode.addAnimation(spin, forKey: "spin")
            scene.rootNode.addChildNode(cubeNode)

            // Position container above WebView
            if let parentView = webView.superview {
                let webOrigin = webView.frame.origin
                let nativeFrame = CGRect(
                    x: frame.origin.x + webOrigin.x,
                    y: frame.origin.y + webOrigin.y,
                    width: frame.width,
                    height: frame.height
                )
                container.frame = nativeFrame
                parentView.addSubview(container)
                parentView.bringSubviewToFront(container)
            } else {
                webView.addSubview(container)
            }

            self.containerView = container
            self.sceneView = sv
            self.currentScene = scene

            self.updateStatus("[show] frame=\(Int(x)),\(Int(y)) \(Int(width))x\(Int(height))")

            let screenScale = UIScreen.main.scale
            call.resolve([
                "shown": true,
                "frame": ["x": x, "y": y, "w": width, "h": height],
                "screenScale": Float(screenScale),
                "webViewBounds": [
                    "w": Float(webView.bounds.width),
                    "h": Float(webView.bounds.height)
                ]
            ])
        }
    }

    // MARK: - Hide

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.containerView?.removeFromSuperview()
            self?.sceneView = nil
            self?.containerView = nil
            self?.statusLabel = nil
            call.resolve(["hidden": true])
        }
    }

    // MARK: - Load Model

    @objc func loadModel(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url") else {
            call.reject("Missing model URL")
            return
        }

        let shortName = urlString.components(separatedBy: "/").last ?? urlString
        updateStatus("[load] \(shortName)")

        Task { [weak self] in
            guard let self = self else { return }

            do {
                self.updateStatus("[load] downloading...")
                let localURL = try await self.downloadOrCacheModel(urlString: urlString)
                self.updateStatus("[load] downloaded OK")

                self.updateStatus("[load] parsing GLTF...")
                let gltfAsset = try GLTFAsset(url: localURL)
                self.updateStatus("[load] GLTF parsed OK")

                // Log extensions so we know if meshopt/draco/etc are in play
                let extsUsed = (gltfAsset.extensionsUsed ?? []).joined(separator: ",")
                let extsReq  = (gltfAsset.extensionsRequired ?? []).joined(separator: ",")
                if !extsUsed.isEmpty { self.updateStatus("[load] ext_used: \(extsUsed)") }
                if !extsReq.isEmpty  { self.updateStatus("[load] ext_req: \(extsReq)") }

                let sceneSource = GLTFSCNSceneSource(asset: gltfAsset)
                guard let scene = sceneSource.defaultScene else {
                    self.updateStatus("[load] ERR: no defaultScene")
                    call.reject("Failed to convert GLTF to SceneKit scene")
                    return
                }
                self.updateStatus("[load] SceneKit scene OK")

                await MainActor.run {
                    guard let currentScene = self.currentScene else {
                        self.updateStatus("[load] ERR: no currentScene")
                        call.reject("Viewer not shown. Call show() first.")
                        return
                    }

                    // Remove old character and debug cube
                    self.characterNode?.removeFromParentNode()
                    currentScene.rootNode.childNode(withName: "_debug_cube", recursively: false)?.removeFromParentNode()
                    self.currentAnimations.removeAll()
                    self.availableAnimations.removeAll()
                    self.activeAnimationKey = nil

                    // Count nodes for diagnostics
                    var nodeCount = 0
                    scene.rootNode.enumerateChildNodes { _, _ in nodeCount += 1 }
                    self.updateStatus("[load] nodes=\(nodeCount)")

                    // Move character nodes directly (NOT clone()) to preserve
                    // skinner-to-skeleton bindings on rigged characters.
                    let wrapper = SCNNode()

                    // Capture animation players from scene root BEFORE moving children.
                    // GLTFKit2 attaches all SCNAnimationPlayers to scene.rootNode keyed by
                    // animation name. Moving only the children orphans those players —
                    // we re-attach them to the wrapper so they still drive the skeleton.
                    let rootAnimKeys = scene.rootNode.animationKeys
                    self.updateStatus("[load] rootAnimKeys=\(rootAnimKeys.count)")
                    var migratedPlayers: [(String, SCNAnimationPlayer)] = []
                    for key in rootAnimKeys {
                        if let player = scene.rootNode.animationPlayer(forKey: key) {
                            migratedPlayers.append((key, player))
                        }
                    }

                    let children = Array(scene.rootNode.childNodes)
                    for child in children {
                        child.removeFromParentNode()
                        wrapper.addChildNode(child)
                    }

                    // Re-attach the animation players to the wrapper node so that
                    // extractAnimationsFromNode can find them.
                    for (key, player) in migratedPlayers {
                        wrapper.addAnimationPlayer(player, forKey: key)
                    }

                    currentScene.rootNode.addChildNode(wrapper)
                    self.characterNode = wrapper

                    // Bounding box diagnostics
                    let (bbMin, bbMax) = wrapper.boundingBox
                    let bbSize = SCNVector3(
                        bbMax.x - bbMin.x,
                        bbMax.y - bbMin.y,
                        bbMax.z - bbMin.z
                    )
                    self.updateStatus("[load] bb=\(String(format: "%.1f", bbSize.x))x\(String(format: "%.1f", bbSize.y))x\(String(format: "%.1f", bbSize.z))")

                    // Count geometry and skinned meshes for diagnostics
                    var geoCount = 0
                    var skinCount = 0
                    var totalVertices = 0
                    wrapper.enumerateChildNodes { node, _ in
                        if node.geometry != nil { geoCount += 1 }
                        if node.skinner != nil { skinCount += 1 }
                        if let geo = node.geometry {
                            for src in geo.sources where src.semantic == .vertex {
                                totalVertices += src.vectorCount
                            }
                        }
                    }
                    self.updateStatus("[load] geo=\(geoCount) skin=\(skinCount) verts=\(totalVertices)")

                    // Detect silent empty-geometry failure: GLTFKit2 parses OK but returns
                    // zero-vertex SCNGeometry objects when it can't decode the buffer
                    // extension (e.g. EXT_meshopt_compression not supported by this build).
                    // Without this check the character is invisible with no error thrown.
                    if totalVertices == 0 && geoCount > 0 {
                        self.updateStatus("[load] ERR: 0 verts — buffer ext unsupported?")
                        call.reject("Empty geometry: \(geoCount) mesh nodes but 0 vertices — check ext_req log")
                        return
                    }

                    // Auto-frame camera
                    self.frameCameraToFit(wrapper)

                    // Extract animations
                    self.extractAnimationsFromNode(wrapper)
                    self.updateStatus("[load] anims=\(self.availableAnimations.count): \(self.availableAnimations.prefix(3).joined(separator: ","))")

                    // Apply idle animation
                    self.applyIdleAnimation()

                    // Clear status after 5 seconds if model loaded successfully
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                        self?.clearStatus()
                    }

                    let camPos = self.cameraNode?.position ?? SCNVector3Zero
                    self.updateStatus("[load] OK cam=\(String(format: "%.1f,%.1f,%.1f", camPos.x, camPos.y, camPos.z))")

                    call.resolve([
                        "loaded": true,
                        "animations": self.availableAnimations,
                        "nodeCount": nodeCount,
                        "boundingBox": [
                            "min": [bbMin.x, bbMin.y, bbMin.z],
                            "max": [bbMax.x, bbMax.y, bbMax.z],
                            "size": [bbSize.x, bbSize.y, bbSize.z]
                        ],
                        "cameraPosition": [camPos.x, camPos.y, camPos.z]
                    ])
                }
            } catch {
                self.updateStatus("[load] ERR: \(error.localizedDescription)")
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

            if let activeKey = self.activeAnimationKey,
               let player = self.currentAnimations[activeKey] {
                player.stop(withBlendOutDuration: 0.3)
            }

            let matchedKey = self.findAnimationKey(for: name)

            guard let key = matchedKey, let player = self.currentAnimations[key] else {
                call.reject("Animation '\(name)' not found. Available: \(self.availableAnimations.joined(separator: ", "))")
                return
            }

            player.animation.repeatCount = loop ? .greatestFiniteMagnitude : 1
            player.animation.isRemovedOnCompletion = !loop
            player.blendFactor = 1.0
            player.play()
            self.activeAnimationKey = key

            let duration = player.animation.duration
            if !loop && returnToIdle {
                DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.1) { [weak self] in
                    guard self?.activeAnimationKey == key else { return }
                    self?.applyIdleAnimation()
                }
            }

            call.resolve([
                "playing": true,
                "animation": key,
                "duration": duration
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
        let orbit = call.getString("orbit")
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
            self.statusLabel = nil

            call.resolve(["disposed": true])
        }
    }

    // MARK: - Private Helpers

    private func frameCameraToFit(_ node: SCNNode) {
        guard let camNode = cameraNode, let camera = camNode.camera else { return }

        let (minVec, maxVec) = node.boundingBox
        let size = SCNVector3(
            maxVec.x - minVec.x,
            maxVec.y - minVec.y,
            maxVec.z - minVec.z
        )
        let center = SCNVector3(
            minVec.x + size.x / 2,
            minVec.y + size.y / 2,
            minVec.z + size.z / 2
        )

        let maxDim = max(size.x, size.y, size.z)
        guard maxDim > 0 else { return }

        let fovRad = camera.fieldOfView * .pi / 180
        let distance = Float(CGFloat(maxDim) / (2 * tan(fovRad / 2))) * 1.5

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.3
        camNode.position = SCNVector3(0, center.y, center.z + distance)
        camNode.look(at: center)
        SCNTransaction.commit()
    }

    private func setupLighting(in scene: SCNScene) {
        lightNodes.forEach { $0.removeFromParentNode() }
        lightNodes.removeAll()

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

        let fillLight = SCNLight()
        fillLight.type = .directional
        fillLight.intensity = 400
        fillLight.color = UIColor(red: 0.9, green: 0.95, blue: 1.0, alpha: 1.0)
        let fillNode = SCNNode()
        fillNode.light = fillLight
        fillNode.eulerAngles = SCNVector3(-Float.pi / 6, -Float.pi / 4, 0)
        scene.rootNode.addChildNode(fillNode)
        lightNodes.append(fillNode)

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 300
        ambient.color = UIColor(white: 0.9, alpha: 1.0)
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)
        lightNodes.append(ambientNode)
    }

    private func extractAnimationsFromNode(_ rootNode: SCNNode) {
        rootNode.enumerateChildNodes { node, _ in
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
                    }
                }
            }
        }

        for key in rootNode.animationKeys {
            if let player = rootNode.animationPlayer(forKey: key),
               !currentAnimations.keys.contains(key) {
                currentAnimations[key] = player
                availableAnimations.append(key)
            }
        }
    }

    private func findAnimationKey(for name: String) -> String? {
        let lower = name.lowercased()
        if currentAnimations[name] != nil { return name }
        if let key = currentAnimations.keys.first(where: { $0.lowercased() == lower }) {
            return key
        }
        if let key = currentAnimations.keys.first(where: { $0.lowercased().contains(lower) }) {
            return key
        }
        return nil
    }

    private func applyIdleAnimation() {
        let priorityOrder = ["idle", "stand", "stand_hands_on_hips", "arms_up_still", "fold_arms"]

        for name in priorityOrder {
            if let key = findAnimationKey(for: name), let player = currentAnimations[key] {
                player.animation.repeatCount = .greatestFiniteMagnitude
                player.animation.isRemovedOnCompletion = false
                player.blendFactor = 1.0
                player.play()
                activeAnimationKey = key
                return
            }
        }

        if let firstKey = currentAnimations.keys.first, let player = currentAnimations[firstKey] {
            player.animation.repeatCount = .greatestFiniteMagnitude
            player.animation.isRemovedOnCompletion = false
            player.blendFactor = 1.0
            player.play()
            activeAnimationKey = firstKey
        }
    }

    private func parseOrbit(_ orbit: String) -> (theta: Float, phi: Float, distance: Float) {
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
        if let cached = modelCache[urlString], FileManager.default.fileExists(atPath: cached.path) {
            updateStatus("[dl] cache-mem hit")
            return cached
        }

        let filename = urlString.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? UUID().uuidString
        let localPath = cacheDir.appendingPathComponent(filename + ".glb")

        if FileManager.default.fileExists(atPath: localPath.path) {
            modelCache[urlString] = localPath
            updateStatus("[dl] cache-disk hit")
            return localPath
        }

        guard let url = URL(string: urlString) else {
            throw NSError(domain: "NativeCharacterViewer", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(urlString)"])
        }

        updateStatus("[dl] fetching...")
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw NSError(domain: "NativeCharacterViewer", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "HTTP \(status) downloading model"])
        }

        updateStatus("[dl] \(data.count / 1024)KB → disk")
        try data.write(to: localPath)
        modelCache[urlString] = localPath

        return localPath
    }
}
