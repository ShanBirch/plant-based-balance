import Foundation
import Capacitor
import SceneKit
import GLTFKit2

/// A UIView that passes through all touches to the views underneath.
/// Used as the container for the SceneKit character viewer so that
/// web content (buttons, links) behind the transparent overlay remains tappable.
class PassthroughView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        // Don't intercept any touches — let them pass to the WebView
        return nil
    }
}

/// An SCNView that passes through all touches.
class PassthroughSCNView: SCNView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        return nil
    }
}

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
    private var sceneSource: GLTFSCNSceneSource? // keep alive for animation extraction
    private var loadGeneration: Int = 0 // incremented on each loadModel call to cancel stale loads

    private let cacheDir: URL = {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("glb_models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    // Debug logging (no on-screen overlay)
    private func updateStatus(_ text: String) {
        #if DEBUG
        print("[NativeCharacterViewer] \(text)")
        #endif
    }

    private func clearStatus() { }

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
                // Already created — reposition and ensure visible
                let webOrigin = self.bridge?.webView?.frame.origin ?? .zero
                self.containerView?.frame = CGRect(
                    x: CGFloat(x) + webOrigin.x,
                    y: CGFloat(y) + webOrigin.y,
                    width: CGFloat(width), height: CGFloat(height)
                )
                self.sceneView?.frame = self.containerView?.bounds ?? .zero
                self.containerView?.isHidden = false
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

            // Container with transparent background — uses PassthroughView
            // so touches fall through to the WebView underneath.
            let container = PassthroughView(frame: frame)
            container.backgroundColor = .clear
            container.isUserInteractionEnabled = false
            container.clipsToBounds = true

            // SceneKit view — uses PassthroughSCNView so web content
            // (buttons, links) behind the transparent overlay stays tappable.
            let sv = PassthroughSCNView(frame: container.bounds)
            sv.backgroundColor = .clear
            sv.isOpaque = false
            sv.layer.isOpaque = false
            sv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            sv.allowsCameraControl = false  // disable orbit/pan — character is display-only
            sv.antialiasingMode = .none  // MSAA doubles render target memory
            sv.preferredFramesPerSecond = 30  // 30fps is plenty for a character widget
            sv.isPlaying = true
            // Cap at 2x scale even on 3x devices — saves 56% GPU fill vs 3x
            sv.contentScaleFactor = min(UIScreen.main.scale, 2.0)

            // Create scene
            let scene = SCNScene()
            scene.background.contents = UIColor.clear
            sv.scene = scene

            // Set up camera
            let camera = SCNCamera()
            camera.fieldOfView = 55
            camera.zNear = 0.01
            camera.zFar = 200
            camera.wantsHDR = false  // HDR uses float16 framebuffers — too much memory for skinned models

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
            guard let self = self else {
                call.resolve(["hidden": true])
                return
            }
            // Just hide the view — don't destroy scene/model.
            // The JS bridge calls hide() on app-background and expects to
            // re-show by just calling show() again (reposition path).
            // Destroying everything here forces a full re-download on resume.
            self.containerView?.isHidden = true
            call.resolve(["hidden": true])
        }
    }

    // MARK: - Load Model

    /// Aggressively strip geometry, materials, and skinners from a node tree
    /// so SceneKit releases the associated GPU texture/buffer allocations.
    /// Just calling removeFromParentNode() leaves lazy GPU caches alive.
    private func purgeNodeResources(_ node: SCNNode) {
        node.enumerateChildNodes { child, _ in
            child.geometry?.materials = [SCNMaterial()] // drop texture refs
            child.geometry = nil
            child.skinner = nil
            child.morpher = nil
            for key in child.animationKeys {
                child.removeAnimation(forKey: key)
            }
        }
        node.geometry = nil
        node.skinner = nil
        for key in node.animationKeys {
            node.removeAnimation(forKey: key)
        }
        node.removeFromParentNode()
    }

    @objc func loadModel(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url") else {
            call.reject("Missing model URL")
            return
        }

        let shortName = urlString.components(separatedBy: "/").last ?? urlString
        updateStatus("[load] \(shortName)")

        // Increment generation so any in-flight loadModel tasks for a previous
        // model know they've been superseded and should bail out.
        loadGeneration += 1
        let myGeneration = loadGeneration

        Task { [weak self] in
            guard let self = self else { return }

            // ── Phase 1: Release old model resources BEFORE loading new one ──
            // Must run on MainActor since SceneKit nodes are UI objects.
            // Freeing the old GLTF asset, textures, and GPU buffers before
            // allocating the new model prevents memory accumulation that
            // causes iOS Jetsam to kill the process after a few swaps.
            await MainActor.run {
                if let oldChar = self.characterNode {
                    self.purgeNodeResources(oldChar)
                }
                self.characterNode = nil
                self.currentAnimations.removeAll()
                self.availableAnimations.removeAll()
                self.activeAnimationKey = nil
                self.sceneSource = nil  // release old GLTF asset before parsing new one
            }

            do {
                self.updateStatus("[load] downloading...")
                let localURL = try await self.downloadOrCacheModel(urlString: urlString)

                // If a newer loadModel was called while we were downloading, abort.
                guard self.loadGeneration == myGeneration else {
                    self.updateStatus("[load] CANCELLED (superseded) \(shortName)")
                    call.resolve(["loaded": false, "cancelled": true])
                    return
                }

                self.updateStatus("[load] downloaded OK")

                self.updateStatus("[load] parsing GLTF...")
                let gltfAsset = try GLTFAsset(url: localURL)
                self.updateStatus("[load] GLTF parsed OK")

                // If superseded during parsing, bail
                guard self.loadGeneration == myGeneration else {
                    self.updateStatus("[load] CANCELLED (superseded after parse) \(shortName)")
                    call.resolve(["loaded": false, "cancelled": true])
                    return
                }

                // Log extensions so we know if meshopt/draco/etc are in play
                let extsUsed = gltfAsset.extensionsUsed.joined(separator: ",")
                let extsReq  = gltfAsset.extensionsRequired.joined(separator: ",")
                if !extsUsed.isEmpty { self.updateStatus("[load] ext_used: \(extsUsed)") }
                if !extsReq.isEmpty  { self.updateStatus("[load] ext_req: \(extsReq)") }

                let sceneSource = GLTFSCNSceneSource(asset: gltfAsset)
                self.sceneSource = sceneSource // keep alive for animation extraction
                guard let scene = sceneSource.defaultScene else {
                    self.updateStatus("[load] ERR: no defaultScene")
                    call.reject("Failed to convert GLTF to SceneKit scene")
                    return
                }
                self.updateStatus("[load] SceneKit scene OK, gltfAnims=\(gltfAsset.animations.count)")

                await MainActor.run {
                    // Check again after parsing — another loadModel may have arrived
                    guard self.loadGeneration == myGeneration else {
                        self.updateStatus("[load] CANCELLED (superseded before scene setup) \(shortName)")
                        call.resolve(["loaded": false, "cancelled": true])
                        return
                    }

                    guard let currentScene = self.currentScene else {
                        self.updateStatus("[load] ERR: no currentScene")
                        call.reject("Viewer not shown. Call show() first.")
                        return
                    }

                    // Clean up any character that arrived between phase 1 and now
                    if let staleChar = self.characterNode {
                        self.purgeNodeResources(staleChar)
                        self.characterNode = nil
                    }

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

                    // Extract animations - first try SceneKit node animations,
                    // then fall back to GLTFKit2 asset animations
                    self.extractAnimationsFromNode(wrapper)
                    if self.availableAnimations.isEmpty {
                        self.extractAnimationsFromSceneSource(sceneSource, targetNode: wrapper)
                    }
                    self.updateStatus("[load] anims=\(self.availableAnimations.count): \(self.availableAnimations.prefix(3).joined(separator: ","))")

                    // Apply idle animation
                    self.applyIdleAnimation()

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

            // Aggressively free GPU resources before dropping references
            if let charNode = self.characterNode {
                self.purgeNodeResources(charNode)
            }
            self.characterNode = nil
            self.currentAnimations.removeAll()
            self.availableAnimations.removeAll()
            self.activeAnimationKey = nil
            self.sceneSource = nil
            self.lightNodes.forEach { $0.removeFromParentNode() }
            self.lightNodes.removeAll()
            self.cameraNode?.removeFromParentNode()
            self.cameraNode = nil
            // Detach scene from view before nilling — forces Metal to flush
            self.sceneView?.scene = nil
            self.currentScene = nil
            self.containerView?.removeFromSuperview()
            self.sceneView = nil
            self.containerView = nil

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

        guard size.y > 0 else { return }

        // For portrait-oriented widget with humanoid models:
        // Frame based on HEIGHT (the dominant axis) to fill the container vertically.
        // Using max(x,y,z) would make tall skinny characters appear tiny.
        let fovRad = camera.fieldOfView * .pi / 180
        let distance = Float(CGFloat(size.y) / (2 * tan(fovRad / 2))) * 1.2

        // For humanoid characters: look at upper body (60% up from bottom)
        // instead of geometric center — produces more natural portrait framing.
        let lookAtY = minVec.y + size.y * 0.5

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.3
        camNode.position = SCNVector3(0, lookAtY, center.z + distance)
        camNode.look(at: SCNVector3(center.x, lookAtY, center.z))
        SCNTransaction.commit()

        updateStatus("[cam] dist=\(String(format: "%.1f", distance)) lookY=\(String(format: "%.1f", lookAtY)) h=\(String(format: "%.1f", size.y))")
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

    /// Extract animations from GLTFSCNSceneSource.animations property.
    /// GLTFKit2 doesn't attach animations to SceneKit nodes automatically;
    /// instead they're available via the sceneSource.animations array as
    /// GLTFSCNAnimation objects, each containing a name and SCNAnimationPlayer.
    private func extractAnimationsFromSceneSource(_ sceneSource: GLTFSCNSceneSource, targetNode: SCNNode) {
        let scnAnims = sceneSource.animations
        updateStatus("[anim] sceneSource.animations.count=\(scnAnims.count)")

        for scnAnim in scnAnims {
            let rawName = scnAnim.name.isEmpty ? "anim_\(availableAnimations.count)" : scnAnim.name
            let cleanName = rawName
                .replacingOccurrences(of: "Animation-", with: "")
                .trimmingCharacters(in: .whitespaces)

            guard !cleanName.isEmpty else { continue }

            let player = scnAnim.animationPlayer
            // Add the animation player to the character node so it can target bones
            targetNode.addAnimationPlayer(player, forKey: cleanName)
            player.stop()  // Don't auto-play; applyIdleAnimation() will start the right one

            currentAnimations[cleanName] = player
            availableAnimations.append(cleanName)
            updateStatus("[anim] added: \(cleanName) dur=\(String(format: "%.1f", player.animation.duration))s")
        }

        if !availableAnimations.isEmpty {
            updateStatus("[anim] \(availableAnimations.count) animations ready")
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
