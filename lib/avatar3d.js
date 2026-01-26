/**
 * 3D Avatar System using Three.js
 * Renders a customizable 3D fitness character with animations
 */

// Import maps for ES modules (loaded via script tags)
const THREE_CDN = 'https://unpkg.com/three@0.160.0';

/**
 * Avatar3D - 3D character renderer using Three.js
 */
class Avatar3D {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      width: options.width || 200,
      height: options.height || 300,
      showRoom: options.showRoom !== false,
      interactive: options.interactive || false,
      modelUrl: options.modelUrl || null,
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

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.character = null;
    this.mixer = null;
    this.animations = {};
    this.currentAnimation = null;
    this.clock = null;
    this.lights = {};
    this.environment = null;

    // Animation state
    this.isAnimating = false;
    this.animationId = null;

    // Initialize when Three.js is ready
    this.initPromise = this.waitForThree().then(() => this.init());
  }

  /**
   * Wait for Three.js to be loaded
   */
  async waitForThree() {
    return new Promise((resolve) => {
      if (window.THREE) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (window.THREE) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.error('Three.js failed to load');
        resolve();
      }, 10000);
    });
  }

  /**
   * Initialize Three.js scene
   */
  async init() {
    if (!window.THREE) {
      console.error('Three.js not loaded');
      this.renderFallback();
      return;
    }

    const { width, height } = this.options;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue default

    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1, 3);
    this.camera.lookAt(0, 0.8, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    // Create clock for animations
    this.clock = new THREE.Clock();

    // Setup scene
    this.setupLighting();
    this.setupEnvironment();
    await this.createCharacter();

    // Mount renderer
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.borderRadius = '16px';

    // Add overlay UI
    this.addOverlayUI();

    // Start animation loop
    this.animate();

    // Handle resize
    this.setupResizeHandler();
  }

  /**
   * Setup scene lighting
   */
  setupLighting() {
    // Ambient light for overall illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    this.lights.ambient = ambient;

    // Main directional light (sun)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -5;
    mainLight.shadow.camera.right = 5;
    mainLight.shadow.camera.top = 5;
    mainLight.shadow.camera.bottom = -5;
    this.scene.add(mainLight);
    this.lights.main = mainLight;

    // Fill light from the side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
    this.lights.fill = fillLight;

    // Rim light for character pop
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
    this.lights.rim = rimLight;
  }

  /**
   * Setup environment/room based on state
   */
  setupEnvironment() {
    const backgrounds = {
      gym: { skyColor: 0xD2B48C, floorColor: 0x8B7355 },
      park: { skyColor: 0x87CEEB, floorColor: 0x90EE90 },
      home: { skyColor: 0xF5F5DC, floorColor: 0xDEB887 },
      beach: { skyColor: 0x87CEEB, floorColor: 0xF4A460 },
      mountain: { skyColor: 0xB0C4DE, floorColor: 0x808080 }
    };

    const bg = backgrounds[this.state.roomBackground] || backgrounds.gym;

    // Update scene background
    this.scene.background = new THREE.Color(bg.skyColor);

    // Create floor
    if (this.environment?.floor) {
      this.scene.remove(this.environment.floor);
    }

    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: bg.floorColor,
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.environment = { floor, ...bg };
  }

  /**
   * Create the 3D character
   */
  async createCharacter() {
    // If a model URL is provided, try to load it
    if (this.options.modelUrl) {
      try {
        await this.loadGLTFModel(this.options.modelUrl);
        return;
      } catch (err) {
        console.warn('Failed to load model, using procedural character:', err);
      }
    }

    // Create a procedural stylized character
    this.createProceduralCharacter();
  }

  /**
   * Load a GLTF/GLB model
   */
  async loadGLTFModel(url) {
    return new Promise((resolve, reject) => {
      if (!window.GLTFLoader) {
        reject(new Error('GLTFLoader not available'));
        return;
      }

      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          this.character = gltf.scene;
          this.character.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // Scale and position
          this.character.scale.set(1, 1, 1);
          this.character.position.set(0, 0, 0);

          // Setup animations if available
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.character);
            gltf.animations.forEach((clip) => {
              this.animations[clip.name] = this.mixer.clipAction(clip);
            });
            // Play idle animation
            this.playAnimation('idle');
          }

          this.scene.add(this.character);
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Create a procedural 3D character (stylized low-poly)
   */
  createProceduralCharacter() {
    const skinColors = {
      light: 0xFFE4C4,
      medium: 0xDEB887,
      tan: 0xCD853F,
      dark: 0x8B4513
    };

    const outfitColors = {
      green: 0x7BA883,
      blue: 0x4A90D9,
      pink: 0xD98B9C,
      purple: 0x9B59B6,
      orange: 0xE67E22,
      black: 0x2C3E50
    };

    const hairColors = {
      black: 0x1a1a1a,
      brown: 0x4a3728,
      blonde: 0xd4a574,
      red: 0xa0522d,
      gray: 0x808080,
      pink: 0xff69b4,
      blue: 0x4169e1
    };

    const skinColor = skinColors[this.state.skinTone] || skinColors.medium;
    const outfitColor = outfitColors[this.state.outfitColor] || outfitColors.green;
    const hairColor = hairColors[this.state.hairColor] || hairColors.brown;

    // Character group
    this.character = new THREE.Group();

    // Materials
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.7,
      metalness: 0.0
    });
    const outfitMaterial = new THREE.MeshStandardMaterial({
      color: outfitColor,
      roughness: 0.6,
      metalness: 0.1
    });
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.8,
      metalness: 0.0
    });
    const shortsMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7
    });
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.5
    });
    const sholeSoleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6
    });

    // === HEAD (larger for stylized look) ===
    const headGroup = new THREE.Group();

    // Main head shape
    const headGeometry = new THREE.SphereGeometry(0.22, 32, 32);
    headGeometry.scale(1, 1.1, 0.95);
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.castShadow = true;
    headGroup.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });

    // Left eye
    const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.07, 0.02, 0.18);
    leftEyeWhite.scale.set(1, 1.2, 0.5);
    headGroup.add(leftEyeWhite);

    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), pupilMaterial);
    leftPupil.position.set(-0.07, 0.02, 0.21);
    headGroup.add(leftPupil);

    // Right eye
    const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    rightEyeWhite.position.set(0.07, 0.02, 0.18);
    rightEyeWhite.scale.set(1, 1.2, 0.5);
    headGroup.add(rightEyeWhite);

    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), pupilMaterial);
    rightPupil.position.set(0.07, 0.02, 0.21);
    headGroup.add(rightPupil);

    // Simple smile
    const smileGeometry = new THREE.TorusGeometry(0.06, 0.01, 8, 16, Math.PI);
    const smileMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.06, 0.18);
    smile.rotation.x = Math.PI;
    headGroup.add(smile);

    // Hair
    this.createHair(headGroup, hairMaterial);

    // Ears
    const earGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    earGeometry.scale(0.5, 1, 0.7);
    const leftEar = new THREE.Mesh(earGeometry, skinMaterial);
    leftEar.position.set(-0.21, 0, 0);
    headGroup.add(leftEar);
    const rightEar = new THREE.Mesh(earGeometry, skinMaterial);
    rightEar.position.set(0.21, 0, 0);
    headGroup.add(rightEar);

    headGroup.position.y = 1.5;
    this.character.add(headGroup);
    this.character.headGroup = headGroup;

    // === NECK ===
    const neckGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 16);
    const neck = new THREE.Mesh(neckGeometry, skinMaterial);
    neck.position.y = 1.32;
    neck.castShadow = true;
    this.character.add(neck);

    // === TORSO (T-shirt) ===
    const torsoGroup = new THREE.Group();

    const torsoGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.45, 16);
    const torso = new THREE.Mesh(torsoGeometry, outfitMaterial);
    torso.position.y = 1.05;
    torso.castShadow = true;
    torsoGroup.add(torso);

    // Collar
    const collarGeometry = new THREE.TorusGeometry(0.1, 0.02, 8, 16);
    const collar = new THREE.Mesh(collarGeometry, new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitColor).multiplyScalar(0.8)
    }));
    collar.position.y = 1.25;
    collar.rotation.x = Math.PI / 2;
    torsoGroup.add(collar);

    this.character.add(torsoGroup);
    this.character.torsoGroup = torsoGroup;

    // === ARMS ===
    const armGeometry = new THREE.CapsuleGeometry(0.045, 0.25, 8, 16);

    // Left arm
    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
    leftArm.castShadow = true;
    leftArmGroup.add(leftArm);
    leftArmGroup.position.set(-0.22, 1.05, 0);
    leftArmGroup.rotation.z = 0.2;
    this.character.add(leftArmGroup);
    this.character.leftArm = leftArmGroup;

    // Right arm
    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
    rightArm.castShadow = true;
    rightArmGroup.add(rightArm);
    rightArmGroup.position.set(0.22, 1.05, 0);
    rightArmGroup.rotation.z = -0.2;
    this.character.add(rightArmGroup);
    this.character.rightArm = rightArmGroup;

    // Hands
    const handGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
    leftHand.position.set(-0.26, 0.85, 0);
    leftHand.castShadow = true;
    this.character.add(leftHand);

    const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
    rightHand.position.set(0.26, 0.85, 0);
    rightHand.castShadow = true;
    this.character.add(rightHand);

    // === SHORTS ===
    const shortsGeometry = new THREE.CylinderGeometry(0.17, 0.2, 0.2, 16);
    const shorts = new THREE.Mesh(shortsGeometry, shortsMaterial);
    shorts.position.y = 0.72;
    shorts.castShadow = true;
    this.character.add(shorts);

    // === LEGS ===
    const legGeometry = new THREE.CapsuleGeometry(0.055, 0.35, 8, 16);

    // Left leg
    const leftLegGroup = new THREE.Group();
    const leftLeg = new THREE.Mesh(legGeometry, skinMaterial);
    leftLeg.castShadow = true;
    leftLegGroup.add(leftLeg);
    leftLegGroup.position.set(-0.08, 0.4, 0);
    this.character.add(leftLegGroup);
    this.character.leftLeg = leftLegGroup;

    // Right leg
    const rightLegGroup = new THREE.Group();
    const rightLeg = new THREE.Mesh(legGeometry, skinMaterial);
    rightLeg.castShadow = true;
    rightLegGroup.add(rightLeg);
    rightLegGroup.position.set(0.08, 0.4, 0);
    this.character.add(rightLegGroup);
    this.character.rightLeg = rightLegGroup;

    // === SHOES ===
    const shoeGeometry = new THREE.BoxGeometry(0.1, 0.06, 0.15);
    shoeGeometry.translate(0, 0, 0.02);

    const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    leftShoe.position.set(-0.08, 0.03, 0);
    leftShoe.castShadow = true;
    this.character.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    rightShoe.position.set(0.08, 0.03, 0);
    rightShoe.castShadow = true;
    this.character.add(rightShoe);

    // Shoe soles (white)
    const soleGeometry = new THREE.BoxGeometry(0.1, 0.02, 0.16);
    soleGeometry.translate(0, -0.02, 0.02);

    const leftSole = new THREE.Mesh(soleGeometry, sholeSoleMaterial);
    leftSole.position.set(-0.08, 0.03, 0);
    this.character.add(leftSole);

    const rightSole = new THREE.Mesh(soleGeometry, sholeSoleMaterial);
    rightSole.position.set(0.08, 0.03, 0);
    this.character.add(rightSole);

    // Add accessory
    this.addAccessory();

    // Add character to scene
    this.scene.add(this.character);

    // Start procedural animation
    this.startProceduralAnimation();
  }

  /**
   * Create hair based on style
   */
  createHair(headGroup, hairMaterial) {
    const style = this.state.hairStyle;

    // Remove existing hair
    if (headGroup.hair) {
      headGroup.remove(headGroup.hair);
    }

    const hairGroup = new THREE.Group();

    switch (style) {
      case 'short':
        const shortHair = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
          hairMaterial
        );
        shortHair.position.y = 0.05;
        shortHair.scale.set(1, 0.8, 0.95);
        hairGroup.add(shortHair);
        break;

      case 'medium':
        const mediumTop = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6),
          hairMaterial
        );
        mediumTop.position.y = 0.05;
        hairGroup.add(mediumTop);

        // Side hair
        const leftSide = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.05, 0.15, 8, 16),
          hairMaterial
        );
        leftSide.position.set(-0.2, -0.05, 0);
        hairGroup.add(leftSide);

        const rightSide = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.05, 0.15, 8, 16),
          hairMaterial
        );
        rightSide.position.set(0.2, -0.05, 0);
        hairGroup.add(rightSide);
        break;

      case 'long':
        const longTop = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6),
          hairMaterial
        );
        longTop.position.y = 0.05;
        hairGroup.add(longTop);

        // Long flowing sides
        const leftLong = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.06, 0.35, 8, 16),
          hairMaterial
        );
        leftLong.position.set(-0.18, -0.15, -0.02);
        hairGroup.add(leftLong);

        const rightLong = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.06, 0.35, 8, 16),
          hairMaterial
        );
        rightLong.position.set(0.18, -0.15, -0.02);
        hairGroup.add(rightLong);

        // Back hair
        const backHair = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.12, 0.3, 8, 16),
          hairMaterial
        );
        backHair.position.set(0, -0.15, -0.1);
        hairGroup.add(backHair);
        break;

      case 'ponytail':
        const ponyBase = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
          hairMaterial
        );
        ponyBase.position.y = 0.05;
        hairGroup.add(ponyBase);

        const ponytail = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.05, 0.25, 8, 16),
          hairMaterial
        );
        ponytail.position.set(0, 0, -0.18);
        ponytail.rotation.x = 0.5;
        hairGroup.add(ponytail);
        break;

      case 'bun':
        const bunBase = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
          hairMaterial
        );
        bunBase.position.y = 0.05;
        hairGroup.add(bunBase);

        const bun = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 16, 16),
          hairMaterial
        );
        bun.position.set(0, 0.2, -0.05);
        hairGroup.add(bun);
        break;

      case 'bald':
      default:
        // No hair
        break;
    }

    headGroup.add(hairGroup);
    headGroup.hair = hairGroup;
  }

  /**
   * Add accessory based on state
   */
  addAccessory() {
    // Remove existing accessory
    if (this.character.accessory) {
      this.character.remove(this.character.accessory);
    }

    const accessory = this.state.accessory;
    let accessoryMesh = null;

    switch (accessory) {
      case 'cap':
        const capGroup = new THREE.Group();

        // Cap crown
        const capCrown = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
        );
        capCrown.position.y = 1.55;
        capCrown.scale.set(1, 0.5, 1);
        capGroup.add(capCrown);

        // Cap brim (backward)
        const brimGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.02, 32, 1, false, Math.PI * 0.7, Math.PI * 0.6);
        const brim = new THREE.Mesh(
          brimGeometry,
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
        );
        brim.position.set(0, 1.52, -0.12);
        brim.rotation.x = -0.3;
        capGroup.add(brim);

        accessoryMesh = capGroup;
        break;

      case 'headband':
        const headband = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.02, 8, 32),
          new THREE.MeshStandardMaterial({
            color: AVATAR_CONFIG?.outfitColors?.[this.state.outfitColor] || 0x7BA883,
            roughness: 0.5
          })
        );
        headband.position.y = 1.58;
        headband.rotation.x = Math.PI / 2;
        accessoryMesh = headband;
        break;

      case 'glasses':
        const glassesGroup = new THREE.Group();
        const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });

        // Left frame
        const leftFrame = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.005, 8, 16),
          glassMaterial
        );
        leftFrame.position.set(-0.07, 1.52, 0.2);
        glassesGroup.add(leftFrame);

        // Right frame
        const rightFrame = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.005, 8, 16),
          glassMaterial
        );
        rightFrame.position.set(0.07, 1.52, 0.2);
        glassesGroup.add(rightFrame);

        // Bridge
        const bridge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, 0.06, 8),
          glassMaterial
        );
        bridge.position.set(0, 1.52, 0.2);
        bridge.rotation.z = Math.PI / 2;
        glassesGroup.add(bridge);

        accessoryMesh = glassesGroup;
        break;

      case 'wristband':
        // Wristbands are on the arms - handled separately
        const wristbandMaterial = new THREE.MeshStandardMaterial({
          color: AVATAR_CONFIG?.outfitColors?.[this.state.outfitColor] || 0x7BA883,
          roughness: 0.5
        });

        const leftWristband = new THREE.Mesh(
          new THREE.TorusGeometry(0.05, 0.015, 8, 16),
          wristbandMaterial
        );
        leftWristband.position.set(-0.26, 0.9, 0);
        leftWristband.rotation.x = Math.PI / 2;

        const rightWristband = new THREE.Mesh(
          new THREE.TorusGeometry(0.05, 0.015, 8, 16),
          wristbandMaterial
        );
        rightWristband.position.set(0.26, 0.9, 0);
        rightWristband.rotation.x = Math.PI / 2;

        const wristbandGroup = new THREE.Group();
        wristbandGroup.add(leftWristband);
        wristbandGroup.add(rightWristband);
        accessoryMesh = wristbandGroup;
        break;
    }

    if (accessoryMesh) {
      this.character.add(accessoryMesh);
      this.character.accessory = accessoryMesh;
    }
  }

  /**
   * Start procedural animation based on mood/energy
   */
  startProceduralAnimation() {
    this.isAnimating = true;
  }

  /**
   * Animation loop
   */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update animation mixer if using loaded model
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Procedural animation for generated character
    if (this.character && this.isAnimating && !this.mixer) {
      this.updateProceduralAnimation(time);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update procedural animation based on energy/mood
   */
  updateProceduralAnimation(time) {
    const energy = this.state.energyLevel;
    const mood = this.state.mood;

    // Animation intensity based on energy
    const intensity = 0.5 + (energy / 100) * 1.5;
    const speed = 1 + (energy / 100) * 2;

    // Idle bounce
    const bounceAmount = 0.02 * intensity;
    const bounce = Math.sin(time * speed * 2) * bounceAmount;
    this.character.position.y = bounce;

    // Head bob
    if (this.character.headGroup) {
      this.character.headGroup.rotation.z = Math.sin(time * speed) * 0.05 * intensity;
      this.character.headGroup.rotation.x = Math.sin(time * speed * 0.5) * 0.03;
    }

    // Arm swing
    if (this.character.leftArm && this.character.rightArm) {
      const armSwing = Math.sin(time * speed * 2) * 0.15 * intensity;
      this.character.leftArm.rotation.x = armSwing;
      this.character.rightArm.rotation.x = -armSwing;
    }

    // Leg movement (subtle)
    if (this.character.leftLeg && this.character.rightLeg) {
      const legMove = Math.sin(time * speed * 2) * 0.08 * intensity;
      this.character.leftLeg.rotation.x = legMove;
      this.character.rightLeg.rotation.x = -legMove;
    }

    // Mood-specific animations
    if (mood === 'champion' || mood === 'energetic') {
      // More energetic movement
      this.character.rotation.y = Math.sin(time * 0.5) * 0.1;
    } else if (mood === 'tired' || mood === 'sad') {
      // Slower, droopier movement
      this.character.position.y = bounce * 0.3;
      if (this.character.headGroup) {
        this.character.headGroup.rotation.x = 0.1; // Looking down
      }
    }
  }

  /**
   * Play a specific animation (for loaded models)
   */
  playAnimation(name) {
    if (!this.animations[name]) return;

    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(0.3);
    }

    this.currentAnimation = this.animations[name];
    this.currentAnimation.reset().fadeIn(0.3).play();
  }

  /**
   * Add overlay UI (mood indicator, stats)
   */
  addOverlayUI() {
    const moodEmojis = {
      sad: '😢',
      tired: '😴',
      neutral: '😐',
      happy: '😊',
      energetic: '💪',
      champion: '🏆'
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
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">${moodEmojis[this.state.mood] || '😐'}</div>
      <div class="avatar3d-stats" style="
        position: absolute;
        bottom: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        gap: 8px;
      ">
        <div style="flex:1;background:rgba(255,255,255,0.9);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>💪 Fitness</span>
            <span>${this.state.fitnessLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.fitnessLevel}%;background:linear-gradient(90deg,#7BA883,#4CAF50);border-radius:2px;"></div>
          </div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.9);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>⚡ Energy</span>
            <span>${this.state.energyLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.energyLevel}%;background:linear-gradient(90deg,#FFD700,#FFA500);border-radius:2px;"></div>
          </div>
        </div>
      </div>
    `;
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.container.style.position = 'relative';
    this.container.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Update overlay UI
   */
  updateOverlayUI() {
    if (!this.overlay) return;

    const moodEmojis = {
      sad: '😢',
      tired: '😴',
      neutral: '😐',
      happy: '😊',
      energetic: '💪',
      champion: '🏆'
    };

    const moodEl = this.overlay.querySelector('.avatar3d-mood');
    if (moodEl) {
      moodEl.textContent = moodEmojis[this.state.mood] || '😐';
    }

    // Update stats bars
    const statsEl = this.overlay.querySelector('.avatar3d-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div style="flex:1;background:rgba(255,255,255,0.9);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>💪 Fitness</span>
            <span>${this.state.fitnessLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.fitnessLevel}%;background:linear-gradient(90deg,#7BA883,#4CAF50);border-radius:2px;"></div>
          </div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.9);border-radius:8px;padding:4px 8px;font-size:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>⚡ Energy</span>
            <span>${this.state.energyLevel}%</span>
          </div>
          <div style="height:4px;background:#eee;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${this.state.energyLevel}%;background:linear-gradient(90deg,#FFD700,#FFA500);border-radius:2px;"></div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Handle window resize
   */
  setupResizeHandler() {
    // Only handle if container size changes, not window
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
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
   * Render fallback if Three.js fails
   */
  renderFallback() {
    this.container.innerHTML = `
      <div style="
        width: ${this.options.width}px;
        height: ${this.options.height}px;
        background: linear-gradient(180deg, #87CEEB 0%, #87CEEB 60%, #8B7355 60%);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 14px;
        text-align: center;
        padding: 20px;
      ">
        <div>
          <div style="font-size: 48px; margin-bottom: 10px;">🏃</div>
          <div>3D Avatar Loading...</div>
          <div style="font-size: 12px; margin-top: 5px;">Please wait or refresh</div>
        </div>
      </div>
    `;
  }

  /**
   * Update avatar state
   */
  setOption(key, value) {
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = value;
      this.updateCharacter();
      this.updateOverlayUI();
    }
  }

  /**
   * Update character appearance based on state
   */
  updateCharacter() {
    if (!this.character) return;

    // Rebuild character with new options
    this.scene.remove(this.character);
    this.createProceduralCharacter();
    this.setupEnvironment();
  }

  /**
   * Render method (for compatibility with existing system)
   */
  render() {
    this.updateOverlayUI();
    if (this.character) {
      this.updateCharacter();
    }
  }

  /**
   * Load avatar state from database (same API as Avatar class)
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
        this.updateCharacter();
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
        this.updateOverlayUI();
      }

      return data;
    } catch (err) {
      console.error('Error updating avatar fitness:', err);
      return null;
    }
  }

  /**
   * Destroy the avatar
   */
  destroy() {
    this.isAnimating = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export for use
window.Avatar3D = Avatar3D;
