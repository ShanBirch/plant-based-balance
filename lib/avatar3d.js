/**
 * 3D Avatar System using Three.js
 * Professional-quality character rendering with GLTF model support
 *
 * ============================================================
 * HOW TO GET WOW-QUALITY 3D CHARACTERS:
 * ============================================================
 *
 * 1. MIXAMO (FREE) - https://www.mixamo.com/
 *    - Sign in with Adobe account
 *    - Choose a character (Y-Bot, X-Bot, or upload your own)
 *    - Download animations (Idle, Walking, Running, Dancing, etc.)
 *    - Export as FBX, then convert to GLB using Blender or online tools
 *    - Recommended: Download "Mixamo Character Pack" with multiple animations
 *
 * 2. READY PLAYER ME (FREE) - https://readyplayer.me/
 *    - Create customizable full-body avatars
 *    - Export as GLB with animations
 *    - Great for personalized avatars
 *
 * 3. SKETCHFAB (FREE/PAID) - https://sketchfab.com/
 *    - Search for "character animated" with CC0 or CC-BY license
 *    - Download GLB format directly
 *    - Many game-quality characters available
 *
 * 4. QUATERNIUS (FREE) - https://quaternius.com/
 *    - Free low-poly animated character packs
 *    - Perfect for stylized fitness characters
 *    - Already in GLB format
 *
 * 5. KENNEY (FREE) - https://kenney.nl/assets
 *    - Free game assets including animated characters
 *
 * USAGE:
 *   Place your .glb file in /assets/models/ and set modelUrl:
 *   new Avatar3D('container', { modelUrl: '/assets/models/character.glb' })
 *
 * ============================================================
 */

/**
 * Avatar3D - Professional 3D character renderer
 */
class Avatar3D {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      width: options.width || 200,
      height: options.height || 300,
      showRoom: options.showRoom !== false,
      interactive: options.interactive || false,
      autoRotate: options.autoRotate || false,
      modelUrl: options.modelUrl || null,
      // Default model - replace with your own GLB file
      // Example: '/assets/models/fitness-character.glb'
      ...options
    };

    // State (compatible with existing Avatar system)
    this.state = {
      bodyType: 'neutral',
      skinTone: 'medium',
      hairStyle: 'short',
      hairColor: 'brown',
      outfitColor: 'green',
      accessory: 'none',
      fitnessLevel: 50,
      energyLevel: 50,
      mood: 'neutral',
      daysSinceWorkout: 0,
      weeklyWorkoutCount: 0,
      roomBackground: 'gym',
      isCustomized: false
    };

    // Three.js core objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = null;

    // Character and animations
    this.character = null;
    this.mixer = null;
    this.animations = new Map();
    this.currentAction = null;
    this.previousAction = null;

    // Scene objects
    this.lights = {};
    this.environment = null;
    this.ground = null;

    // Animation state
    this.isAnimating = false;
    this.animationId = null;
    this.modelLoaded = false;

    // Initialize
    this.initPromise = this.waitForThree().then(() => this.init());
  }

  /**
   * Wait for Three.js to be loaded
   */
  async waitForThree() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.THREE && window.GLTFLoader) {
          resolve();
          return true;
        }
        return false;
      };

      if (check()) return;

      const interval = setInterval(() => {
        if (check()) clearInterval(interval);
      }, 100);

      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(interval);
        console.warn('Three.js or GLTFLoader not fully loaded');
        resolve();
      }, 15000);
    });
  }

  /**
   * Initialize Three.js scene
   */
  async init() {
    if (!window.THREE) {
      console.error('Three.js not loaded');
      this.renderFallback('Three.js library not loaded');
      return;
    }

    const { width, height } = this.options;

    // Create scene with gradient background
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.2, 3.5);
    this.camera.lookAt(0, 1, 0);

    // Create high-quality renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Clock for animations
    this.clock = new THREE.Clock();

    // Setup scene
    this.setupLighting();
    this.setupEnvironment();

    // Mount renderer
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.renderer.domElement.style.borderRadius = '16px';
    this.container.appendChild(this.renderer.domElement);

    // Load character model
    await this.loadCharacter();

    // Add UI overlay
    this.addOverlayUI();

    // Setup controls if interactive
    if (this.options.interactive) {
      this.setupControls();
    }

    // Start render loop
    this.animate();

    // Handle resize
    this.setupResizeHandler();
  }

  /**
   * Setup professional lighting rig
   */
  setupLighting() {
    // Ambient light - soft overall illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);
    this.lights.ambient = ambient;

    // Key light - main directional light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 10, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0001;
    this.scene.add(keyLight);
    this.lights.key = keyLight;

    // Fill light - softer light from opposite side
    const fillLight = new THREE.DirectionalLight(0x9bb8ff, 0.6);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
    this.lights.fill = fillLight;

    // Rim/back light - creates depth separation
    const rimLight = new THREE.DirectionalLight(0xffffee, 0.8);
    rimLight.position.set(0, 8, -10);
    this.scene.add(rimLight);
    this.lights.rim = rimLight;

    // Ground bounce light
    const bounceLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.3);
    this.scene.add(bounceLight);
    this.lights.bounce = bounceLight;
  }

  /**
   * Setup environment based on room setting
   */
  setupEnvironment() {
    // Simple dark background - no floor or fancy environment
    this.scene.background = new THREE.Color(0x0a1628);

    // No fog
    this.scene.fog = null;

    // Update ambient light for good visibility
    if (this.lights.ambient) {
      this.lights.ambient.intensity = 0.6;
    }

    // Remove any existing ground plane
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground = null;
    }
  }

  /**
   * Load 3D character model
   */
  async loadCharacter() {
    // If a model URL is provided, load it
    if (this.options.modelUrl) {
      try {
        await this.loadGLTFModel(this.options.modelUrl);
        this.modelLoaded = true;
        return;
      } catch (err) {
        console.error('Failed to load model:', err);
      }
    }

    // Try to load default model from assets
    const defaultModelPaths = [
      '/assets/models/fitness-character.glb',
      '/assets/models/character.glb',
      '/models/character.glb'
    ];

    for (const path of defaultModelPaths) {
      try {
        await this.loadGLTFModel(path);
        this.modelLoaded = true;
        console.log('Loaded model from:', path);
        return;
      } catch (err) {
        // Try next path
      }
    }

    // No model found - show placeholder with instructions
    console.log('No 3D model found. Creating placeholder character.');
    this.createPlaceholderCharacter();
  }

  /**
   * Load GLTF/GLB model with animations
   */
  async loadGLTFModel(url) {
    return new Promise((resolve, reject) => {
      if (!window.GLTFLoader) {
        // Try to use THREE.GLTFLoader if available
        if (window.THREE && window.THREE.GLTFLoader) {
          window.GLTFLoader = window.THREE.GLTFLoader;
        } else {
          reject(new Error('GLTFLoader not available'));
          return;
        }
      }

      const loader = new GLTFLoader();

      // Add DRACOLoader for compressed models if available
      if (window.DRACOLoader) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(dracoLoader);
      }

      loader.load(
        url,
        (gltf) => {
          // Remove existing character
          if (this.character) {
            this.scene.remove(this.character);
          }

          this.character = gltf.scene;

          // Setup model properties
          this.character.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Improve material quality
              if (node.material) {
                node.material.envMapIntensity = 0.5;
              }
            }
          });

          // Calculate bounding box and center/scale model
          const box = new THREE.Box3().setFromObject(this.character);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Scale to fit ~2 units tall
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          this.character.scale.setScalar(scale);

          // Center horizontally, place feet on ground
          this.character.position.x = -center.x * scale;
          this.character.position.y = -box.min.y * scale;
          this.character.position.z = -center.z * scale;

          // Setup animations
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.character);

            gltf.animations.forEach((clip) => {
              const action = this.mixer.clipAction(clip);
              this.animations.set(clip.name.toLowerCase(), action);
              console.log('Loaded animation:', clip.name);
            });

            // Play idle animation by default
            this.playAnimation('idle') ||
            this.playAnimation('breathing idle') ||
            this.playAnimation('standing') ||
            this.playFirstAnimation();
          }

          this.scene.add(this.character);
          this.modelLoaded = true;
          resolve(gltf);
        },
        (progress) => {
          // Loading progress
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log(`Loading model: ${percent}%`);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Create a placeholder character when no model is available
   */
  createPlaceholderCharacter() {
    this.character = new THREE.Group();

    // Create a simple stylized character as placeholder
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x7BA883,
      roughness: 0.7,
      metalness: 0.1
    });

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xDEB887,
      roughness: 0.8,
      metalness: 0.0
    });

    // Body (capsule shape)
    const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.6, 8, 16);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.0;
    body.castShadow = true;
    this.character.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.y = 1.6;
    head.castShadow = true;
    this.character.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.07, 1.62, 0.17);
    this.character.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.07, 1.62, 0.17);
    this.character.add(rightEye);

    // Smile
    const smileGeometry = new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI);
    const smile = new THREE.Mesh(smileGeometry, eyeMaterial);
    smile.position.set(0, 1.52, 0.17);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    this.character.add(smile);

    // Legs
    const legGeometry = new THREE.CapsuleGeometry(0.08, 0.4, 8, 16);

    const leftLeg = new THREE.Mesh(legGeometry, skinMaterial);
    leftLeg.position.set(-0.12, 0.35, 0);
    leftLeg.castShadow = true;
    this.character.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, skinMaterial);
    rightLeg.position.set(0.12, 0.35, 0);
    rightLeg.castShadow = true;
    this.character.add(rightLeg);

    // Arms
    const armGeometry = new THREE.CapsuleGeometry(0.05, 0.35, 8, 16);

    const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
    leftArm.position.set(-0.35, 1.0, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    this.character.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
    rightArm.position.set(0.35, 1.0, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    this.character.add(rightArm);

    // Feet
    const footGeometry = new THREE.BoxGeometry(0.12, 0.05, 0.18);
    const footMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.12, 0.025, 0.03);
    leftFoot.castShadow = true;
    this.character.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.12, 0.025, 0.03);
    rightFoot.castShadow = true;
    this.character.add(rightFoot);

    this.scene.add(this.character);

    // Start idle animation for placeholder
    this.startPlaceholderAnimation();
  }

  /**
   * Simple idle animation for placeholder character
   */
  startPlaceholderAnimation() {
    // Placeholder uses procedural animation in the animate loop
    this.isAnimating = true;
  }

  /**
   * Play animation by name
   */
  playAnimation(name, fadeTime = 0.5) {
    const action = this.animations.get(name.toLowerCase());
    if (!action) return false;

    if (this.currentAction === action) return true;

    this.previousAction = this.currentAction;
    this.currentAction = action;

    if (this.previousAction) {
      this.previousAction.fadeOut(fadeTime);
    }

    this.currentAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(fadeTime)
      .play();

    return true;
  }

  /**
   * Play the first available animation
   */
  playFirstAnimation() {
    const firstAnim = this.animations.keys().next().value;
    if (firstAnim) {
      this.playAnimation(firstAnim);
    }
  }

  /**
   * Update animation based on mood/energy
   */
  updateAnimationForMood() {
    if (!this.mixer || this.animations.size === 0) return;

    const mood = this.state.mood;
    const energy = this.state.energyLevel;

    // Map moods to animation names (adjust based on your model's animations)
    const moodAnimations = {
      champion: ['victory', 'celebrate', 'cheer', 'dancing', 'happy'],
      energetic: ['dancing', 'jumping', 'running', 'excited'],
      happy: ['happy idle', 'waving', 'idle'],
      neutral: ['idle', 'breathing idle', 'standing'],
      tired: ['tired', 'exhausted', 'sad idle', 'idle'],
      sad: ['sad', 'disappointed', 'idle']
    };

    const preferredAnims = moodAnimations[mood] || moodAnimations.neutral;

    for (const animName of preferredAnims) {
      if (this.playAnimation(animName)) {
        break;
      }
    }

    // Adjust animation speed based on energy
    if (this.currentAction) {
      const speedMultiplier = 0.5 + (energy / 100) * 1.0; // 0.5 to 1.5
      this.currentAction.setEffectiveTimeScale(speedMultiplier);
    }
  }

  /**
   * Setup orbit controls for interactive viewing
   */
  setupControls() {
    if (window.OrbitControls || (window.THREE && window.THREE.OrbitControls)) {
      const OrbitControls = window.OrbitControls || window.THREE.OrbitControls;
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 8;
      this.controls.minPolarAngle = Math.PI * 0.2;
      this.controls.maxPolarAngle = Math.PI * 0.6;
      this.controls.target.set(0, 1, 0);
      this.controls.autoRotate = this.options.autoRotate;
      this.controls.autoRotateSpeed = 1.0;
    }
  }

  /**
   * Animation loop
   */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Update controls
    if (this.controls) {
      this.controls.update();
    }

    // Placeholder character animation
    if (this.character && !this.modelLoaded) {
      this.updatePlaceholderAnimation(time);
    }

    // Auto-rotate if no controls and autoRotate enabled
    if (!this.controls && this.options.autoRotate && this.character) {
      this.character.rotation.y += 0.005;
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update placeholder character animation
   */
  updatePlaceholderAnimation(time) {
    if (!this.character) return;

    const energy = this.state.energyLevel;
    const intensity = 0.5 + (energy / 100);
    const speed = 1 + (energy / 100);

    // Idle bounce
    this.character.position.y = Math.sin(time * speed * 2) * 0.02 * intensity;

    // Slight rotation sway
    this.character.rotation.y = Math.sin(time * 0.5) * 0.1;
    this.character.rotation.z = Math.sin(time * speed) * 0.02 * intensity;
  }

  /**
   * Add overlay UI
   */
  addOverlayUI() {
    const moodEmojis = {
      sad: '😢', tired: '😴', neutral: '😐',
      happy: '😊', energetic: '💪', champion: '🏆'
    };

    const overlay = document.createElement('div');
    overlay.className = 'avatar3d-overlay';
    overlay.innerHTML = `
      <div class="avatar3d-mood" style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: white;
        border-radius: 20px;
        padding: 5px 10px;
        font-size: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      ">${moodEmojis[this.state.mood] || '😐'}</div>
      ${!this.modelLoaded ? `
      <div class="avatar3d-notice" style="
        position: absolute;
        bottom: 50px;
        left: 8px;
        right: 8px;
        background: rgba(0,0,0,0.7);
        color: white;
        border-radius: 8px;
        padding: 8px;
        font-size: 9px;
        text-align: center;
      ">
        Add a 3D model for better graphics!<br>
        <span style="opacity:0.7">See avatar3d.js for instructions</span>
      </div>
      ` : ''}
      <div class="avatar3d-stats" style="
        position: absolute;
        bottom: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        gap: 8px;
      ">
        <div style="flex:1;background:rgba(255,255,255,0.95);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>💪 Fitness</span>
            <span>${this.state.fitnessLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.fitnessLevel}%;background:linear-gradient(90deg,#7BA883,#4CAF50);border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.95);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>⚡ Energy</span>
            <span>${this.state.energyLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.energyLevel}%;background:linear-gradient(90deg,#FFD700,#FFA500);border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>
    `;
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:16px;overflow:hidden;';
    this.container.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Update overlay UI
   */
  updateOverlayUI() {
    if (!this.overlay) return;

    const moodEmojis = {
      sad: '😢', tired: '😴', neutral: '😐',
      happy: '😊', energetic: '💪', champion: '🏆'
    };

    const moodEl = this.overlay.querySelector('.avatar3d-mood');
    if (moodEl) {
      moodEl.textContent = moodEmojis[this.state.mood] || '😐';
    }

    // Update stats
    const statsEl = this.overlay.querySelector('.avatar3d-stats');
    if (statsEl) {
      const bars = statsEl.querySelectorAll('div > div:last-child > div');
      if (bars[0]) bars[0].style.width = `${this.state.fitnessLevel}%`;
      if (bars[1]) bars[1].style.width = `${this.state.energyLevel}%`;

      const labels = statsEl.querySelectorAll('span:last-child');
      if (labels[0]) labels[0].textContent = `${this.state.fitnessLevel}%`;
      if (labels[1]) labels[1].textContent = `${this.state.energyLevel}%`;
    }
  }

  /**
   * Handle window resize
   */
  setupResizeHandler() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && this.camera && this.renderer) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(this.container);
    this.resizeObserver = resizeObserver;
  }

  /**
   * Render fallback message
   */
  renderFallback(message = 'Loading 3D Avatar...') {
    this.container.innerHTML = `
      <div style="
        width: ${this.options.width}px;
        height: ${this.options.height}px;
        background: #0a1628;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        color: #fff;
        font-size: 14px;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="font-size: 48px; margin-bottom: 15px;">🏃</div>
        <div style="font-weight:600;margin-bottom:5px;">${message}</div>
        <div style="font-size: 11px; opacity: 0.7;">Check console for details</div>
      </div>
    `;
  }

  /**
   * Update avatar state option
   */
  setOption(key, value) {
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = value;

      // Update environment if room changed
      if (key === 'roomBackground') {
        this.setupEnvironment();
      }

      // Update animation if mood changed
      if (key === 'mood' || key === 'energyLevel') {
        this.updateAnimationForMood();
      }

      this.updateOverlayUI();
    }
  }

  /**
   * Render method for compatibility
   */
  render() {
    this.updateOverlayUI();
    this.updateAnimationForMood();
  }

  /**
   * Load avatar state from database
   */
  async load(userId) {
    try {
      const { data, error } = await window.supabaseClient.rpc('get_user_avatar', {
        p_user_id: userId
      });

      if (error) throw error;

      if (data) {
        this.state = {
          bodyType: data.body_type || 'neutral',
          skinTone: data.skin_tone || 'medium',
          hairStyle: data.hair_style || 'short',
          hairColor: data.hair_color || 'brown',
          outfitColor: data.outfit_color || 'green',
          accessory: data.accessory || 'none',
          fitnessLevel: data.fitness_level || 50,
          energyLevel: data.energy_level || 50,
          mood: data.mood || 'neutral',
          daysSinceWorkout: data.days_since_workout || 0,
          weeklyWorkoutCount: data.weekly_workout_count || 0,
          roomBackground: data.room_background || 'gym',
          isCustomized: data.is_customized || false
        };

        await this.initPromise;
        this.setupEnvironment();
        this.updateAnimationForMood();
        this.updateOverlayUI();
      }

      return this.state;
    } catch (err) {
      console.error('Error loading avatar:', err);
      return this.state;
    }
  }

  /**
   * Save avatar state to database
   */
  async save(userId) {
    try {
      const { error } = await window.supabaseClient
        .from('user_avatars')
        .upsert({
          user_id: userId,
          body_type: this.state.bodyType,
          skin_tone: this.state.skinTone,
          hair_style: this.state.hairStyle,
          hair_color: this.state.hairColor,
          outfit_color: this.state.outfitColor,
          accessory: this.state.accessory,
          room_background: this.state.roomBackground,
          is_customized: true
        }, { onConflict: 'user_id' });

      if (error) throw error;

      this.state.isCustomized = true;
      return true;
    } catch (err) {
      console.error('Error saving avatar:', err);
      return false;
    }
  }

  /**
   * Update fitness after workout
   */
  async updateFitness(userId, workoutLogged = true) {
    try {
      const { data, error } = await window.supabaseClient.rpc('update_avatar_fitness', {
        p_user_id: userId,
        p_workout_logged: workoutLogged
      });

      if (error) throw error;

      if (data) {
        this.state.fitnessLevel = data.fitness_level;
        this.state.energyLevel = data.energy_level;
        this.state.mood = data.mood;
        this.state.daysSinceWorkout = data.days_since_workout;
        this.state.weeklyWorkoutCount = data.weekly_workout_count;

        this.updateAnimationForMood();
        this.updateOverlayUI();
      }

      return data;
    } catch (err) {
      console.error('Error updating avatar fitness:', err);
      return null;
    }
  }

  /**
   * Load a new model at runtime
   */
  async loadModel(url) {
    try {
      await this.loadGLTFModel(url);
      this.modelLoaded = true;

      // Remove "add model" notice
      const notice = this.overlay?.querySelector('.avatar3d-notice');
      if (notice) notice.remove();

      return true;
    } catch (err) {
      console.error('Error loading model:', err);
      return false;
    }
  }

  /**
   * Get list of available animations
   */
  getAnimationList() {
    return Array.from(this.animations.keys());
  }

  /**
   * Destroy the avatar
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export
window.Avatar3D = Avatar3D;

// Log instructions on load
console.log(`
╔══════════════════════════════════════════════════════════════╗
║              3D AVATAR SYSTEM - SETUP GUIDE                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  To get WoW-quality 3D characters:                          ║
║                                                              ║
║  1. Download character from Mixamo (free):                   ║
║     https://www.mixamo.com/                                  ║
║                                                              ║
║  2. Convert to GLB format (use Blender or online converter)  ║
║                                                              ║
║  3. Place file at: /assets/models/fitness-character.glb      ║
║                                                              ║
║  4. Or specify custom path:                                  ║
║     new Avatar3D('container', {                              ║
║       modelUrl: '/path/to/your/model.glb'                    ║
║     });                                                      ║
║                                                              ║
║  See avatar3d.js header for more free model sources!         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
