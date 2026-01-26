/**
 * User Avatar System - Tamagotchi-style fitness companion
 * Renders an animated avatar that adapts to user's training activity
 */

// Avatar configuration options
const AVATAR_CONFIG = {
  bodyTypes: ['slim', 'neutral', 'curvy', 'muscular'],
  skinTones: {
    light: '#FFE4C4',
    medium: '#DEB887',
    tan: '#CD853F',
    dark: '#8B4513'
  },
  hairStyles: ['short', 'medium', 'long', 'bald', 'ponytail', 'bun'],
  hairColors: {
    black: '#1a1a1a',
    brown: '#4a3728',
    blonde: '#d4a574',
    red: '#a0522d',
    gray: '#808080',
    pink: '#ff69b4',
    blue: '#4169e1'
  },
  outfitColors: {
    green: '#7BA883',
    blue: '#4A90D9',
    pink: '#D98B9C',
    purple: '#9B59B6',
    orange: '#E67E22',
    black: '#2C3E50'
  },
  accessories: ['none', 'headband', 'glasses', 'cap', 'wristband'],
  backgrounds: {
    gym: { floor: '#8B7355', wall: '#D2B48C', props: 'gym' },
    park: { floor: '#90EE90', wall: '#87CEEB', props: 'park' },
    home: { floor: '#DEB887', wall: '#F5F5DC', props: 'home' },
    beach: { floor: '#F4A460', wall: '#87CEEB', props: 'beach' },
    mountain: { floor: '#808080', wall: '#B0C4DE', props: 'mountain' }
  },
  moods: {
    sad: { expression: 'frown', animation: 'slouch' },
    tired: { expression: 'droopy', animation: 'slow' },
    neutral: { expression: 'neutral', animation: 'normal' },
    happy: { expression: 'smile', animation: 'bouncy' },
    energetic: { expression: 'grin', animation: 'energetic' },
    champion: { expression: 'champion', animation: 'power' }
  }
};

/**
 * Avatar class - manages avatar state and rendering
 */
class Avatar {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      width: options.width || 200,
      height: options.height || 300,
      showRoom: options.showRoom !== false,
      interactive: options.interactive || false,
      ...options
    };

    // Default avatar state
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

    this.animationFrame = null;
    this.position = { x: 50, y: 0 };
    this.direction = 1; // 1 = right, -1 = left
    this.walkCycle = 0;
  }

  /**
   * Load avatar data from database
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
          isCustomized: data.is_customized || false,
          unlockedAccessories: data.unlocked_accessories || [],
          unlockedOutfits: data.unlocked_outfits || [],
          unlockedBackgrounds: data.unlocked_backgrounds || []
        };
      }

      return this.state;
    } catch (err) {
      console.error('Error loading avatar:', err);
      return this.state;
    }
  }

  /**
   * Save avatar customization to database
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
   * Update avatar state (called after workout logged)
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
        this.render();
      }

      return data;
    } catch (err) {
      console.error('Error updating avatar fitness:', err);
      return null;
    }
  }

  /**
   * Render the avatar with room
   */
  render() {
    if (!this.container) return;

    const { width, height, showRoom } = this.options;
    const bg = AVATAR_CONFIG.backgrounds[this.state.roomBackground];

    this.container.innerHTML = `
      <div class="avatar-room" style="
        width: ${width}px;
        height: ${height}px;
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      ">
        ${showRoom ? this.renderRoom(bg) : ''}
        <div class="avatar-character" id="avatar-character-${this.container.id}" style="
          position: absolute;
          bottom: 15%;
          left: ${this.position.x}%;
          transform: translateX(-50%) scaleX(${this.direction});
          transition: left 0.1s linear;
        ">
          ${this.renderCharacter()}
        </div>
        ${this.renderMoodIndicator()}
        ${this.renderStatsBar()}
      </div>
    `;

    // Start walking animation if energy is above threshold
    if (this.state.energyLevel > 20) {
      this.startWalking();
    }
  }

  /**
   * Render the room background
   */
  renderRoom(bg) {
    return `
      <div class="avatar-room-bg" style="
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, ${bg.wall} 0%, ${bg.wall} 60%, ${bg.floor} 60%, ${bg.floor} 100%);
      ">
        ${this.renderRoomProps(bg.props)}
      </div>
    `;
  }

  /**
   * Render room decorations based on background type - Detailed stylized props
   */
  renderRoomProps(type) {
    const props = {
      gym: `
        <!-- Dumbbell rack -->
        <div style="position:absolute;right:8%;bottom:42%;width:35px;height:50px;background:linear-gradient(180deg,#555 0%,#444 100%);border-radius:4px;box-shadow:2px 2px 8px rgba(0,0,0,0.3);"></div>
        <!-- Dumbbells on rack -->
        <div style="position:absolute;right:6%;bottom:58%;width:45px;height:8px;background:#222;border-radius:3px;"></div>
        <div style="position:absolute;right:4%;bottom:57%;width:10px;height:10px;background:#333;border-radius:2px;"></div>
        <div style="position:absolute;right:18%;bottom:57%;width:10px;height:10px;background:#333;border-radius:2px;"></div>
        <div style="position:absolute;right:6%;bottom:52%;width:45px;height:8px;background:#222;border-radius:3px;"></div>
        <!-- Kettlebell -->
        <div style="position:absolute;left:8%;bottom:42%;width:22px;height:22px;background:linear-gradient(135deg,#555 0%,#333 100%);border-radius:50%;box-shadow:2px 2px 6px rgba(0,0,0,0.4);"></div>
        <div style="position:absolute;left:11%;bottom:52%;width:10px;height:8px;background:#333;border-radius:8px 8px 0 0;"></div>
        <!-- Gym mirror -->
        <div style="position:absolute;left:20%;bottom:50%;width:35px;height:45px;background:linear-gradient(180deg,rgba(255,255,255,0.9) 0%,rgba(200,200,200,0.8) 100%);border:3px solid #666;border-radius:2px;box-shadow:inset 0 0 10px rgba(0,0,0,0.1);"></div>
      `,
      park: `
        <!-- Tree -->
        <div style="position:absolute;left:8%;bottom:40%;width:18px;height:70px;background:linear-gradient(90deg,#6B4423 0%,#8B5A2B 50%,#6B4423 100%);border-radius:3px;"></div>
        <div style="position:absolute;left:3%;bottom:65%;width:50px;height:45px;background:radial-gradient(ellipse at center,#32CD32 0%,#228B22 60%,#1B5E20 100%);border-radius:50%;"></div>
        <div style="position:absolute;left:0%;bottom:72%;width:35px;height:30px;background:radial-gradient(ellipse at center,#3CB371 0%,#228B22 70%);border-radius:50%;"></div>
        <!-- Flowers -->
        <div style="position:absolute;right:12%;bottom:42%;font-size:20px;">🌸</div>
        <div style="position:absolute;right:22%;bottom:43%;font-size:16px;">🌷</div>
        <!-- Butterfly -->
        <div style="position:absolute;right:30%;bottom:60%;font-size:14px;animation:flutter 2s ease-in-out infinite;">🦋</div>
        <!-- Sun -->
        <div style="position:absolute;right:10%;top:15%;font-size:28px;">☀️</div>
        <!-- Grass patches -->
        <div style="position:absolute;left:30%;bottom:40%;width:20px;height:15px;background:linear-gradient(0deg,#228B22,transparent);clip-path:polygon(0% 100%,10% 0%,20% 100%,30% 20%,40% 100%,50% 0%,60% 100%,70% 30%,80% 100%,90% 10%,100% 100%);"></div>
      `,
      home: `
        <!-- Cozy couch -->
        <div style="position:absolute;right:5%;bottom:42%;width:55px;height:35px;background:linear-gradient(180deg,#8B6914 0%,#6B4914 100%);border-radius:5px 5px 3px 3px;box-shadow:2px 3px 8px rgba(0,0,0,0.3);"></div>
        <div style="position:absolute;right:5%;bottom:52%;width:55px;height:15px;background:linear-gradient(180deg,#9B7924 0%,#8B6914 100%);border-radius:3px;"></div>
        <!-- Cushion -->
        <div style="position:absolute;right:8%;bottom:48%;width:18px;height:18px;background:linear-gradient(135deg,#E57373 0%,#C62828 100%);border-radius:3px;transform:rotate(-10deg);"></div>
        <!-- Window with curtains -->
        <div style="position:absolute;left:8%;bottom:55%;width:40px;height:50px;background:linear-gradient(180deg,#87CEEB 0%,#B0E0E6 100%);border:4px solid #F5F5DC;border-radius:3px;box-shadow:inset 0 0 15px rgba(255,255,255,0.5);"></div>
        <div style="position:absolute;left:5%;bottom:55%;width:8px;height:55px;background:linear-gradient(90deg,#DEB887 0%,#D2B48C 100%);"></div>
        <div style="position:absolute;left:44%;bottom:55%;width:8px;height:55px;background:linear-gradient(90deg,#D2B48C 0%,#DEB887 100%);"></div>
        <!-- Plant -->
        <div style="position:absolute;left:55%;bottom:42%;font-size:24px;">🪴</div>
        <!-- Rug -->
        <div style="position:absolute;left:35%;bottom:40%;width:50px;height:15px;background:linear-gradient(90deg,#CD853F,#DEB887,#CD853F);border-radius:2px;opacity:0.8;"></div>
      `,
      beach: `
        <!-- Palm tree -->
        <div style="position:absolute;right:10%;bottom:40%;width:12px;height:80px;background:linear-gradient(90deg,#8B4513 0%,#A0522D 50%,#8B4513 100%);transform:rotate(5deg);"></div>
        <div style="position:absolute;right:5%;bottom:75%;font-size:40px;transform:scaleX(-1);">🌴</div>
        <!-- Ocean waves -->
        <div style="position:absolute;left:0;right:0;bottom:38%;height:8px;background:linear-gradient(90deg,rgba(0,119,190,0.6),rgba(0,180,216,0.6),rgba(0,119,190,0.6));animation:wave 2s ease-in-out infinite;"></div>
        <!-- Beach umbrella -->
        <div style="position:absolute;left:15%;bottom:42%;width:6px;height:50px;background:linear-gradient(90deg,#8B4513,#A0522D);"></div>
        <div style="position:absolute;left:5%;bottom:62%;width:45px;height:25px;background:linear-gradient(180deg,#FF6B6B 0%,#FF6B6B 50%,#FFE66D 50%,#FFE66D 100%);border-radius:50px 50px 0 0;"></div>
        <!-- Shells and starfish -->
        <div style="position:absolute;left:35%;bottom:41%;font-size:14px;">🐚</div>
        <div style="position:absolute;left:50%;bottom:42%;font-size:16px;">⭐</div>
        <!-- Beach ball -->
        <div style="position:absolute;right:35%;bottom:44%;font-size:18px;">🏐</div>
        <!-- Sun -->
        <div style="position:absolute;left:15%;top:12%;font-size:32px;">🌅</div>
      `,
      mountain: `
        <!-- Mountain range background -->
        <div style="position:absolute;right:0%;bottom:40%;width:0;height:0;border-left:50px solid transparent;border-right:50px solid transparent;border-bottom:90px solid #5D6D7E;"></div>
        <div style="position:absolute;right:5%;bottom:75%;width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:25px solid #F0F0F0;"></div>
        <div style="position:absolute;right:25%;bottom:40%;width:0;height:0;border-left:40px solid transparent;border-right:40px solid transparent;border-bottom:70px solid #7D8B99;"></div>
        <div style="position:absolute;right:27%;bottom:68%;width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:18px solid #F8F8F8;"></div>
        <!-- Pine trees -->
        <div style="position:absolute;left:8%;bottom:40%;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:30px solid #2E7D32;"></div>
        <div style="position:absolute;left:6%;bottom:48%;width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:25px solid #388E3C;"></div>
        <div style="position:absolute;left:10%;bottom:40%;width:4px;height:15px;background:#5D4037;"></div>
        <!-- Eagle -->
        <div style="position:absolute;right:40%;top:20%;font-size:18px;animation:soar 4s ease-in-out infinite;">🦅</div>
        <!-- Clouds -->
        <div style="position:absolute;left:20%;top:15%;font-size:20px;opacity:0.8;">☁️</div>
        <div style="position:absolute;right:30%;top:10%;font-size:16px;opacity:0.6;">☁️</div>
      `
    };
    return props[type] || '';
  }

  /**
   * Render the character SVG - Stylized cartoon/chibi character
   */
  renderCharacter() {
    const skin = AVATAR_CONFIG.skinTones[this.state.skinTone];
    const skinDark = this.darkenColor(skin, 15);
    const skinLight = this.lightenColor(skin, 10);
    const hair = AVATAR_CONFIG.hairColors[this.state.hairColor];
    const hairDark = this.darkenColor(hair, 20);
    const outfit = AVATAR_CONFIG.outfitColors[this.state.outfitColor];
    const outfitDark = this.darkenColor(outfit, 20);
    const outfitLight = this.lightenColor(outfit, 15);
    const fitness = this.state.fitnessLevel;
    const mood = this.state.mood;

    // Calculate body proportions based on fitness (chibi-style: big head, compact body)
    const muscleScale = 0.85 + (fitness / 100) * 0.3; // 0.85 to 1.15
    const bodyWidth = 44 * muscleScale;
    const shoulderWidth = 50 * muscleScale;

    // Get expression based on mood
    const expression = this.getExpression(mood);

    // Animation class based on energy
    const animClass = this.getAnimationClass();

    // Check if wearing cap (affects hair rendering)
    const wearingCap = this.state.accessory === 'cap';

    return `
      <svg width="100" height="160" viewBox="0 0 100 160" class="avatar-svg ${animClass}">
        <defs>
          <!-- Gradients for depth -->
          <linearGradient id="skinGrad-${this.container.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${skinLight}"/>
            <stop offset="100%" style="stop-color:${skin}"/>
          </linearGradient>
          <linearGradient id="shirtGrad-${this.container.id}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${outfitLight}"/>
            <stop offset="100%" style="stop-color:${outfit}"/>
          </linearGradient>
          <linearGradient id="hairGrad-${this.container.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${hair}"/>
            <stop offset="100%" style="stop-color:${hairDark}"/>
          </linearGradient>
          <!-- Shadow filter -->
          <filter id="shadow-${this.container.id}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" flood-opacity="0.15"/>
          </filter>
        </defs>

        <!-- ===== LEGS (behind body) ===== -->
        <g class="legs" filter="url(#shadow-${this.container.id})">
          <!-- Left Leg -->
          <g class="leg-left">
            <!-- Thigh/Upper leg (skin showing below shorts) -->
            <path d="M32 98 L32 108 Q32 110 34 110 L42 110 Q44 110 44 108 L44 98 Z" fill="url(#skinGrad-${this.container.id})"/>
            <!-- Lower leg with athletic sock -->
            <path d="M32 110 L32 135 Q32 138 35 138 L41 138 Q44 138 44 135 L44 110 Z" fill="#1a1a1a"/>
            <!-- Sock stripe -->
            <rect x="32" y="130" width="12" height="2" fill="#333"/>
          </g>
          <!-- Right Leg -->
          <g class="leg-right">
            <!-- Thigh/Upper leg -->
            <path d="M56 98 L56 108 Q56 110 58 110 L66 110 Q68 110 68 108 L68 98 Z" fill="url(#skinGrad-${this.container.id})"/>
            <!-- Lower leg with athletic sock -->
            <path d="M56 110 L56 135 Q56 138 59 138 L65 138 Q68 138 68 135 L68 110 Z" fill="#1a1a1a"/>
            <!-- Sock stripe -->
            <rect x="56" y="130" width="12" height="2" fill="#333"/>
          </g>
        </g>

        <!-- ===== SNEAKERS ===== -->
        <g class="shoes" filter="url(#shadow-${this.container.id})">
          <!-- Left Sneaker -->
          <g class="shoe-left">
            <path d="M26 138 Q26 145 32 148 L44 148 Q50 145 50 138 L50 140 Q50 135 44 135 L32 135 Q26 135 26 140 Z" fill="#2a2a2a"/>
            <path d="M27 141 Q27 146 32 148 L44 148 Q49 146 49 141 Z" fill="#f5f5f5"/>
            <path d="M30 143 L32 141 L35 143 L37 141 L40 143" stroke="#ccc" stroke-width="1" fill="none"/>
            <ellipse cx="38" cy="140" rx="3" ry="1.5" fill="#e0e0e0"/>
          </g>
          <!-- Right Sneaker -->
          <g class="shoe-right">
            <path d="M50 138 Q50 145 56 148 L68 148 Q74 145 74 138 L74 140 Q74 135 68 135 L56 135 Q50 135 50 140 Z" fill="#2a2a2a"/>
            <path d="M51 141 Q51 146 56 148 L68 148 Q73 146 73 141 Z" fill="#f5f5f5"/>
            <path d="M54 143 L56 141 L59 143 L61 141 L64 143" stroke="#ccc" stroke-width="1" fill="none"/>
            <ellipse cx="62" cy="140" rx="3" ry="1.5" fill="#e0e0e0"/>
          </g>
        </g>

        <!-- ===== BODY/TORSO ===== -->
        <g class="torso" filter="url(#shadow-${this.container.id})">
          <!-- T-shirt body -->
          <path d="M30 58
                   Q25 60 24 65 L22 82 Q22 98 35 98
                   L65 98 Q78 98 78 82 L76 65 Q75 60 70 58
                   L70 55 Q70 52 65 50 L50 48 L35 50 Q30 52 30 55 Z"
                fill="url(#shirtGrad-${this.container.id})"/>
          <!-- T-shirt collar -->
          <path d="M40 48 Q50 46 60 48 Q55 52 50 52 Q45 52 40 48" fill="${outfitDark}"/>
          <!-- T-shirt logo/design -->
          <g class="shirt-logo">
            <text x="50" y="75" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="14" font-weight="bold" fill="${outfitDark}" opacity="0.8">FIT</text>
          </g>
          <!-- Shirt sleeve folds -->
          <path d="M28 65 Q30 70 28 75" stroke="${outfitDark}" stroke-width="1" fill="none" opacity="0.3"/>
          <path d="M72 65 Q70 70 72 75" stroke="${outfitDark}" stroke-width="1" fill="none" opacity="0.3"/>
        </g>

        <!-- ===== SHORTS ===== -->
        <g class="shorts">
          <path d="M30 92 L30 105 Q30 108 33 108 L45 108 L45 98 L55 98 L55 108 L67 108 Q70 108 70 105 L70 92 Q70 90 68 90 L32 90 Q30 90 30 92 Z" fill="#1a1a1a"/>
          <!-- Shorts detail/stripe -->
          <line x1="35" y1="92" x2="35" y2="105" stroke="#333" stroke-width="2"/>
          <line x1="65" y1="92" x2="65" y2="105" stroke="#333" stroke-width="2"/>
          <!-- Drawstring -->
          <path d="M45 91 Q50 93 55 91" stroke="#444" stroke-width="1" fill="none"/>
        </g>

        <!-- ===== ARMS ===== -->
        <g class="arms">
          <!-- Left Arm -->
          <g class="arm-left">
            <!-- Upper arm (sleeve covers) -->
            <ellipse cx="22" cy="62" rx="${6*muscleScale}" ry="8" fill="url(#shirtGrad-${this.container.id})"/>
            <!-- Forearm (skin) -->
            <path d="M16 65 Q14 75 16 85 Q18 88 22 88 Q26 88 28 85 Q30 75 28 65 Z" fill="url(#skinGrad-${this.container.id})"/>
            <!-- Hand -->
            <ellipse cx="22" cy="90" rx="5" ry="4" fill="${skin}"/>
            <!-- Fingers hint -->
            <path d="M18 91 Q17 94 18 96 M20 92 Q19 95 20 97 M24 92 Q25 95 24 97 M26 91 Q27 94 26 96" stroke="${skinDark}" stroke-width="0.8" fill="none"/>
          </g>
          <!-- Right Arm -->
          <g class="arm-right">
            <!-- Upper arm (sleeve covers) -->
            <ellipse cx="78" cy="62" rx="${6*muscleScale}" ry="8" fill="url(#shirtGrad-${this.container.id})"/>
            <!-- Forearm (skin) -->
            <path d="M72 65 Q70 75 72 85 Q74 88 78 88 Q82 88 84 85 Q86 75 84 65 Z" fill="url(#skinGrad-${this.container.id})"/>
            <!-- Hand -->
            <ellipse cx="78" cy="90" rx="5" ry="4" fill="${skin}"/>
            <!-- Fingers hint -->
            <path d="M74 91 Q73 94 74 96 M76 92 Q75 95 76 97 M80 92 Q81 95 80 97 M82 91 Q83 94 82 96" stroke="${skinDark}" stroke-width="0.8" fill="none"/>
          </g>
        </g>

        <!-- ===== NECK ===== -->
        <path d="M42 44 L42 50 Q42 52 45 52 L55 52 Q58 52 58 50 L58 44" fill="url(#skinGrad-${this.container.id})"/>

        <!-- ===== HEAD ===== -->
        <g class="head" filter="url(#shadow-${this.container.id})">
          <!-- Head shape (chibi-style larger head) -->
          <ellipse cx="50" cy="28" rx="26" ry="24" fill="url(#skinGrad-${this.container.id})"/>

          <!-- Ear left -->
          <ellipse cx="24" cy="30" rx="4" ry="6" fill="${skin}"/>
          <ellipse cx="24" cy="30" rx="2" ry="4" fill="${skinDark}" opacity="0.3"/>

          <!-- Ear right -->
          <ellipse cx="76" cy="30" rx="4" ry="6" fill="${skin}"/>
          <ellipse cx="76" cy="30" rx="2" ry="4" fill="${skinDark}" opacity="0.3"/>

          <!-- Hair (render based on style, behind face if no cap) -->
          ${wearingCap ? '' : this.renderHair(hair)}

          <!-- Face Expression -->
          ${expression}

          <!-- Nose hint -->
          <ellipse cx="50" cy="30" rx="2" ry="1.5" fill="${skinDark}" opacity="0.2"/>
        </g>

        <!-- ===== ACCESSORY (on top) ===== -->
        ${this.renderAccessory(hair)}

        <!-- ===== FITNESS INDICATOR ===== -->
        ${fitness >= 70 ? this.renderFitnessGlow() : ''}
      </svg>
    `;
  }

  /**
   * Render fitness glow effect for high fitness levels
   */
  renderFitnessGlow() {
    return `
      <circle cx="50" cy="80" r="45" fill="none" stroke="rgba(123, 168, 131, 0.3)" stroke-width="2" class="fitness-glow">
        <animate attributeName="r" values="40;50;40" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
    `;
  }

  /**
   * Helper: Darken a color
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * Helper: Lighten a color
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min((num >> 16) + amt, 255);
    const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
    const B = Math.min((num & 0x0000FF) + amt, 255);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * Render hair based on style - Stylized cartoon hair
   */
  renderHair(color) {
    const hairDark = this.darkenColor(color, 20);
    const hairLight = this.lightenColor(color, 15);

    const styles = {
      short: `
        <!-- Short styled hair with volume -->
        <g class="hair-short">
          <path d="M24 22 Q24 5 50 3 Q76 5 76 22 Q76 15 70 10 Q60 4 50 4 Q40 4 30 10 Q24 15 24 22"
                fill="url(#hairGrad-${this.container.id})"/>
          <!-- Hair texture/spikes -->
          <path d="M30 8 Q32 2 38 6 Q42 1 48 5 Q52 0 58 4 Q64 1 68 8"
                fill="${color}"/>
          <!-- Side hair -->
          <path d="M24 22 Q22 28 24 35" stroke="${hairDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M76 22 Q78 28 76 35" stroke="${hairDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
          <!-- Highlight -->
          <path d="M35 10 Q40 8 45 10" stroke="${hairLight}" stroke-width="2" fill="none" opacity="0.5"/>
        </g>
      `,
      medium: `
        <!-- Medium length flowing hair -->
        <g class="hair-medium">
          <path d="M22 25 Q22 3 50 2 Q78 3 78 25 Q78 15 70 8 Q58 2 50 2 Q42 2 30 8 Q22 15 22 25"
                fill="url(#hairGrad-${this.container.id})"/>
          <!-- Side flowing hair -->
          <path d="M22 25 Q18 40 22 52" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>
          <path d="M78 25 Q82 40 78 52" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>
          <!-- Inner hair strands -->
          <path d="M25 28 Q22 40 25 50" stroke="${hairDark}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M75 28 Q78 40 75 50" stroke="${hairDark}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- Top texture -->
          <path d="M32 6 Q38 2 44 5 Q50 1 56 4 Q62 2 68 6" fill="${color}"/>
          <!-- Highlight -->
          <path d="M38 12 Q45 10 52 12" stroke="${hairLight}" stroke-width="2" fill="none" opacity="0.5"/>
        </g>
      `,
      long: `
        <!-- Long flowing hair -->
        <g class="hair-long">
          <path d="M20 28 Q20 2 50 1 Q80 2 80 28 Q80 15 70 6 Q58 0 50 0 Q42 0 30 6 Q20 15 20 28"
                fill="url(#hairGrad-${this.container.id})"/>
          <!-- Long flowing sides -->
          <path d="M20 28 Q14 55 20 75" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round"/>
          <path d="M80 28 Q86 55 80 75" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round"/>
          <!-- Hair strands for depth -->
          <path d="M23 30 Q18 55 22 72" stroke="${hairDark}" stroke-width="4" fill="none"/>
          <path d="M77 30 Q82 55 78 72" stroke="${hairDark}" stroke-width="4" fill="none"/>
          <!-- Back hair visible -->
          <path d="M35 48 Q40 60 38 75" stroke="${hairDark}" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M65 48 Q60 60 62 75" stroke="${hairDark}" stroke-width="6" fill="none" stroke-linecap="round"/>
          <!-- Highlight -->
          <path d="M40 12 Q50 8 60 12" stroke="${hairLight}" stroke-width="3" fill="none" opacity="0.5"/>
        </g>
      `,
      bald: `
        <!-- Bald with slight shine -->
        <ellipse cx="50" cy="15" rx="8" ry="4" fill="white" opacity="0.2"/>
      `,
      ponytail: `
        <!-- Ponytail style -->
        <g class="hair-ponytail">
          <path d="M24 22 Q24 5 50 4 Q76 5 76 22 Q76 15 70 10 Q60 4 50 4 Q40 4 30 10 Q24 15 24 22"
                fill="url(#hairGrad-${this.container.id})"/>
          <!-- Ponytail base/scrunchie -->
          <ellipse cx="70" cy="12" rx="6" ry="5" fill="${this.state.outfitColor === 'black' ? '#e74c3c' : AVATAR_CONFIG.outfitColors[this.state.outfitColor]}"/>
          <!-- Ponytail flowing -->
          <path d="M70 15 Q85 20 82 40 Q80 55 75 60" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round"/>
          <path d="M72 18 Q84 22 82 38" stroke="${hairDark}" stroke-width="4" fill="none"/>
          <!-- Side wisps -->
          <path d="M24 22 Q22 28 24 35" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>
          <!-- Highlight -->
          <path d="M35 10 Q45 7 55 10" stroke="${hairLight}" stroke-width="2" fill="none" opacity="0.5"/>
        </g>
      `,
      bun: `
        <!-- Top bun style -->
        <g class="hair-bun">
          <path d="M24 22 Q24 6 50 5 Q76 6 76 22 Q76 15 70 10 Q60 5 50 5 Q40 5 30 10 Q24 15 24 22"
                fill="url(#hairGrad-${this.container.id})"/>
          <!-- Bun -->
          <ellipse cx="50" cy="2" rx="12" ry="10" fill="${color}"/>
          <ellipse cx="50" cy="0" rx="8" ry="6" fill="${hairDark}" opacity="0.3"/>
          <!-- Hair band -->
          <ellipse cx="50" cy="8" rx="10" ry="3" fill="${this.state.outfitColor === 'black' ? '#e74c3c' : AVATAR_CONFIG.outfitColors[this.state.outfitColor]}"/>
          <!-- Side hair -->
          <path d="M24 22 Q22 28 24 35" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M76 22 Q78 28 76 35" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>
          <!-- Highlight -->
          <path d="M45 -2 Q50 -4 55 -2" stroke="${hairLight}" stroke-width="2" fill="none" opacity="0.5"/>
        </g>
      `
    };
    return styles[this.state.hairStyle] || styles.short;
  }

  /**
   * Get facial expression based on mood - Large expressive cartoon eyes
   */
  getExpression(mood) {
    const skin = AVATAR_CONFIG.skinTones[this.state.skinTone];

    // Base eye structure for all expressions
    const eyeBase = (leftX, rightX, yPos, pupilOffsetY = 0, eyeHeight = 8) => `
      <!-- Eye whites -->
      <ellipse cx="${leftX}" cy="${yPos}" rx="7" ry="${eyeHeight}" fill="white"/>
      <ellipse cx="${rightX}" cy="${yPos}" rx="7" ry="${eyeHeight}" fill="white"/>
      <!-- Eye outline -->
      <ellipse cx="${leftX}" cy="${yPos}" rx="7" ry="${eyeHeight}" fill="none" stroke="#2c2c2c" stroke-width="1"/>
      <ellipse cx="${rightX}" cy="${yPos}" rx="7" ry="${eyeHeight}" fill="none" stroke="#2c2c2c" stroke-width="1"/>
    `;

    const expressions = {
      sad: `
        ${eyeBase(40, 60, 26, 0, 6)}
        <!-- Sad droopy eyelids -->
        <path d="M33 22 Q40 20 47 24" fill="${skin}" stroke="#2c2c2c" stroke-width="0.5"/>
        <path d="M53 24 Q60 20 67 22" fill="${skin}" stroke="#2c2c2c" stroke-width="0.5"/>
        <!-- Pupils looking down -->
        <ellipse cx="40" cy="28" rx="4" ry="4" fill="#2c2c2c"/>
        <ellipse cx="60" cy="28" rx="4" ry="4" fill="#2c2c2c"/>
        <!-- Eye shine -->
        <circle cx="38" cy="26" r="1.5" fill="white"/>
        <circle cx="58" cy="26" r="1.5" fill="white"/>
        <!-- Sad eyebrows -->
        <path d="M33 18 Q40 20 46 18" stroke="#3d3d3d" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M54 18 Q60 20 67 18" stroke="#3d3d3d" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Frown -->
        <path d="M42 40 Q50 36 58 40" stroke="#2c2c2c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `,
      tired: `
        <!-- Half-closed tired eyes -->
        <ellipse cx="40" cy="26" rx="7" ry="4" fill="white"/>
        <ellipse cx="60" cy="26" rx="7" ry="4" fill="white"/>
        <ellipse cx="40" cy="26" rx="7" ry="4" fill="none" stroke="#2c2c2c" stroke-width="1"/>
        <ellipse cx="60" cy="26" rx="7" ry="4" fill="none" stroke="#2c2c2c" stroke-width="1"/>
        <!-- Heavy eyelids -->
        <path d="M33 24 L47 24" fill="${skin}"/>
        <path d="M53 24 L67 24" fill="${skin}"/>
        <!-- Tiny pupils -->
        <ellipse cx="40" cy="26" rx="2" ry="2" fill="#2c2c2c"/>
        <ellipse cx="60" cy="26" rx="2" ry="2" fill="#2c2c2c"/>
        <!-- Tired eyebrows -->
        <path d="M34 19 Q40 21 46 20" stroke="#3d3d3d" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M54 20 Q60 21 66 19" stroke="#3d3d3d" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Yawning mouth -->
        <ellipse cx="50" cy="40" rx="6" ry="5" fill="#2c2c2c"/>
        <ellipse cx="50" cy="41" rx="4" ry="3" fill="#8B4513"/>
        <!-- Sleep marks -->
        <text x="72" y="20" font-size="8" fill="#666">z</text>
        <text x="76" y="16" font-size="6" fill="#888">z</text>
      `,
      neutral: `
        ${eyeBase(40, 60, 26)}
        <!-- Normal pupils -->
        <ellipse cx="40" cy="26" rx="4" ry="5" fill="#2c2c2c"/>
        <ellipse cx="60" cy="26" rx="4" ry="5" fill="#2c2c2c"/>
        <!-- Eye shine -->
        <circle cx="38" cy="24" r="2" fill="white"/>
        <circle cx="58" cy="24" r="2" fill="white"/>
        <circle cx="42" cy="28" r="1" fill="white" opacity="0.5"/>
        <circle cx="62" cy="28" r="1" fill="white" opacity="0.5"/>
        <!-- Neutral eyebrows -->
        <path d="M34 17 L46 17" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M54 17 L66 17" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Neutral mouth -->
        <line x1="44" y1="40" x2="56" y2="40" stroke="#2c2c2c" stroke-width="2.5" stroke-linecap="round"/>
      `,
      happy: `
        ${eyeBase(40, 60, 26)}
        <!-- Happy pupils -->
        <ellipse cx="40" cy="26" rx="4" ry="5" fill="#2c2c2c"/>
        <ellipse cx="60" cy="26" rx="4" ry="5" fill="#2c2c2c"/>
        <!-- Sparkly eye shine -->
        <circle cx="38" cy="23" r="2.5" fill="white"/>
        <circle cx="58" cy="23" r="2.5" fill="white"/>
        <circle cx="42" cy="28" r="1" fill="white"/>
        <circle cx="62" cy="28" r="1" fill="white"/>
        <!-- Happy arched eyebrows -->
        <path d="M34 16 Q40 14 46 16" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M54 16 Q60 14 66 16" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Happy smile -->
        <path d="M40 38 Q50 48 60 38" stroke="#2c2c2c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Blush -->
        <ellipse cx="32" cy="34" rx="5" ry="3" fill="#FFB6C1" opacity="0.5"/>
        <ellipse cx="68" cy="34" rx="5" ry="3" fill="#FFB6C1" opacity="0.5"/>
      `,
      energetic: `
        ${eyeBase(40, 60, 26, 0, 9)}
        <!-- Excited wide pupils with sparkle -->
        <ellipse cx="40" cy="26" rx="5" ry="6" fill="#2c2c2c"/>
        <ellipse cx="60" cy="26" rx="5" ry="6" fill="#2c2c2c"/>
        <!-- Multiple eye shines for excitement -->
        <circle cx="37" cy="23" r="3" fill="white"/>
        <circle cx="57" cy="23" r="3" fill="white"/>
        <circle cx="42" cy="28" r="1.5" fill="white"/>
        <circle cx="62" cy="28" r="1.5" fill="white"/>
        <!-- Excited eyebrows raised -->
        <path d="M33 14 Q40 11 47 14" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M53 14 Q60 11 67 14" stroke="#3d3d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Big excited grin -->
        <path d="M38 37 Q50 50 62 37" stroke="#2c2c2c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M40 39 Q50 46 60 39" fill="white"/>
        <!-- Strong blush -->
        <ellipse cx="30" cy="34" rx="6" ry="4" fill="#FF9999" opacity="0.6"/>
        <ellipse cx="70" cy="34" rx="6" ry="4" fill="#FF9999" opacity="0.6"/>
        <!-- Energy sparkles -->
        <text x="22" y="15" font-size="8">✨</text>
        <text x="72" y="15" font-size="8">✨</text>
      `,
      champion: `
        <!-- Champion star eyes! -->
        <g class="champion-eyes">
          <!-- Star-shaped eye whites -->
          <polygon points="40,18 42,24 48,24 43,28 45,34 40,30 35,34 37,28 32,24 38,24" fill="#FFD700" stroke="#2c2c2c" stroke-width="1"/>
          <polygon points="60,18 62,24 68,24 63,28 65,34 60,30 55,34 57,28 52,24 58,24" fill="#FFD700" stroke="#2c2c2c" stroke-width="1"/>
          <!-- Inner star shine -->
          <circle cx="40" cy="26" r="3" fill="white" opacity="0.8"/>
          <circle cx="60" cy="26" r="3" fill="white" opacity="0.8"/>
        </g>
        <!-- Determined champion eyebrows -->
        <path d="M32 14 Q40 10 48 14" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M52 14 Q60 10 68 14" stroke="#3d3d3d" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Victory grin showing teeth -->
        <path d="M36 37 Q50 52 64 37" stroke="#2c2c2c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M38 39 Q50 48 62 39" fill="white"/>
        <line x1="44" y1="41" x2="44" y2="44" stroke="#ddd" stroke-width="0.5"/>
        <line x1="50" y1="42" x2="50" y2="45" stroke="#ddd" stroke-width="0.5"/>
        <line x1="56" y1="41" x2="56" y2="44" stroke="#ddd" stroke-width="0.5"/>
        <!-- Champion blush -->
        <ellipse cx="28" cy="34" rx="6" ry="4" fill="#FF9999" opacity="0.7"/>
        <ellipse cx="72" cy="34" rx="6" ry="4" fill="#FF9999" opacity="0.7"/>
        <!-- Victory sparkles -->
        <text x="15" y="10" font-size="10">⭐</text>
        <text x="78" y="10" font-size="10">⭐</text>
        <text x="50" y="5" text-anchor="middle" font-size="12">👑</text>
      `
    };
    return expressions[mood] || expressions.neutral;
  }

  /**
   * Render accessory - Detailed cartoon accessories
   */
  renderAccessory(hairColor) {
    const accentColor = this.state.outfitColor === 'black' ? '#e74c3c' : AVATAR_CONFIG.outfitColors[this.state.outfitColor];

    const accessories = {
      none: '',
      headband: `
        <!-- Athletic headband -->
        <g class="headband">
          <path d="M24 15 Q50 10 76 15 Q78 17 76 19 Q50 14 24 19 Q22 17 24 15" fill="${accentColor}"/>
          <!-- Headband logo/stripe -->
          <path d="M44 14 L56 14" stroke="white" stroke-width="2" opacity="0.7"/>
          <!-- Headband shine -->
          <path d="M30 15 Q35 13 40 15" stroke="white" stroke-width="1" opacity="0.3"/>
        </g>
      `,
      glasses: `
        <!-- Stylish sports glasses -->
        <g class="glasses">
          <!-- Frame -->
          <rect x="30" y="22" width="14" height="10" rx="3" fill="none" stroke="#1a1a1a" stroke-width="2"/>
          <rect x="56" y="22" width="14" height="10" rx="3" fill="none" stroke="#1a1a1a" stroke-width="2"/>
          <!-- Bridge -->
          <path d="M44 27 Q50 25 56 27" stroke="#1a1a1a" stroke-width="2" fill="none"/>
          <!-- Temple arms -->
          <line x1="30" y1="25" x2="24" y2="28" stroke="#1a1a1a" stroke-width="2"/>
          <line x1="70" y1="25" x2="76" y2="28" stroke="#1a1a1a" stroke-width="2"/>
          <!-- Lens tint -->
          <rect x="31" y="23" width="12" height="8" rx="2" fill="#4169E1" opacity="0.2"/>
          <rect x="57" y="23" width="12" height="8" rx="2" fill="#4169E1" opacity="0.2"/>
          <!-- Reflection -->
          <path d="M33 24 L35 26" stroke="white" stroke-width="1" opacity="0.5"/>
          <path d="M59 24 L61 26" stroke="white" stroke-width="1" opacity="0.5"/>
        </g>
      `,
      cap: `
        <!-- Backward baseball cap (like reference image) -->
        <g class="cap">
          <!-- Cap base/crown -->
          <path d="M22 20 Q22 5 50 4 Q78 5 78 20 Q78 12 68 8 Q56 4 50 4 Q44 4 32 8 Q22 12 22 20" fill="#1a1a1a"/>
          <!-- Cap panel details -->
          <path d="M30 8 L50 4 L70 8" stroke="#2a2a2a" stroke-width="1" fill="none"/>
          <path d="M40 5 L50 4 L60 5" stroke="#333" stroke-width="0.5" fill="none"/>
          <!-- Cap button on top -->
          <circle cx="50" cy="4" r="3" fill="#333"/>
          <!-- Backward bill/brim -->
          <path d="M70 18 Q85 22 85 28 Q85 32 75 30 Q68 28 65 22 Z" fill="#1a1a1a"/>
          <path d="M71 20 Q82 23 82 27" stroke="#333" stroke-width="0.5" fill="none"/>
          <!-- Cap logo text -->
          <text x="50" y="14" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="7" font-weight="bold" fill="white">FIT</text>
          <!-- Hair peeking out front (if not bald) -->
          ${this.state.hairStyle !== 'bald' ? `<path d="M28 20 Q35 18 42 22 Q48 18 55 21 Q62 18 72 20" stroke="${hairColor || AVATAR_CONFIG.hairColors[this.state.hairColor]}" stroke-width="4" fill="none" stroke-linecap="round"/>` : ''}
          <!-- Adjustment strap hint at back -->
          <rect x="72" y="25" width="6" height="2" rx="1" fill="#333"/>
        </g>
      `,
      wristband: `
        <!-- Athletic wristbands -->
        <g class="wristbands">
          <!-- Left wristband -->
          <rect x="14" y="82" width="10" height="6" rx="2" fill="${accentColor}"/>
          <line x1="16" y1="85" x2="22" y2="85" stroke="white" stroke-width="1" opacity="0.5"/>
          <!-- Right wristband -->
          <rect x="76" y="82" width="10" height="6" rx="2" fill="${accentColor}"/>
          <line x1="78" y1="85" x2="84" y2="85" stroke="white" stroke-width="1" opacity="0.5"/>
        </g>
      `
    };
    return accessories[this.state.accessory] || '';
  }

  /**
   * Get animation class based on energy level
   */
  getAnimationClass() {
    const energy = this.state.energyLevel;
    if (energy >= 80) return 'avatar-anim-power';
    if (energy >= 60) return 'avatar-anim-energetic';
    if (energy >= 40) return 'avatar-anim-bouncy';
    if (energy >= 20) return 'avatar-anim-normal';
    return 'avatar-anim-slow';
  }

  /**
   * Render mood indicator bubble
   */
  renderMoodIndicator() {
    const moodEmojis = {
      sad: '😢',
      tired: '😴',
      neutral: '😐',
      happy: '😊',
      energetic: '💪',
      champion: '🏆'
    };

    return `
      <div class="avatar-mood-bubble" style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: white;
        border-radius: 20px;
        padding: 5px 10px;
        font-size: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        ${moodEmojis[this.state.mood] || '😐'}
      </div>
    `;
  }

  /**
   * Render fitness/energy stats bar
   */
  renderStatsBar() {
    return `
      <div class="avatar-stats" style="
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
  }

  /**
   * Start walking animation
   */
  startWalking() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const speed = 0.1 + (this.state.energyLevel / 100) * 0.2; // 0.1 to 0.3 based on energy

    const animate = () => {
      this.position.x += speed * this.direction;

      // Bounce off walls
      if (this.position.x >= 80) {
        this.direction = -1;
      } else if (this.position.x <= 20) {
        this.direction = 1;
      }

      // Update character position
      const character = document.getElementById(`avatar-character-${this.container.id}`);
      if (character) {
        character.style.left = `${this.position.x}%`;
        character.style.transform = `translateX(-50%) scaleX(${this.direction})`;
      }

      this.walkCycle++;
      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop walking animation
   */
  stopWalking() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Update a single customization option
   */
  setOption(key, value) {
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = value;
      this.render();
    }
  }

  /**
   * Destroy the avatar instance
   */
  destroy() {
    this.stopWalking();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

/**
 * Avatar Customization Modal
 */
function createAvatarCustomizer(avatar, userId, onSave) {
  const modal = document.createElement('div');
  modal.className = 'avatar-customizer-modal';
  modal.innerHTML = `
    <div class="avatar-customizer-overlay" onclick="this.parentElement.remove()"></div>
    <div class="avatar-customizer-content">
      <div class="avatar-customizer-header">
        <h2>Create Your Avatar</h2>
        <button class="avatar-close-btn" onclick="this.closest('.avatar-customizer-modal').remove()">&times;</button>
      </div>

      <div class="avatar-customizer-body">
        <div class="avatar-preview-section">
          <div id="avatar-customizer-preview"></div>
        </div>

        <div class="avatar-options-section">
          <div class="avatar-option-group">
            <label>Body Type</label>
            <div class="avatar-option-buttons" data-option="bodyType">
              ${AVATAR_CONFIG.bodyTypes.map(type => `
                <button class="avatar-opt-btn ${avatar.state.bodyType === type ? 'active' : ''}" data-value="${type}">
                  ${type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Skin Tone</label>
            <div class="avatar-option-buttons color-opts" data-option="skinTone">
              ${Object.entries(AVATAR_CONFIG.skinTones).map(([key, color]) => `
                <button class="avatar-opt-btn color-btn ${avatar.state.skinTone === key ? 'active' : ''}"
                        data-value="${key}" style="background:${color}"></button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Hair Style</label>
            <div class="avatar-option-buttons" data-option="hairStyle">
              ${AVATAR_CONFIG.hairStyles.map(style => `
                <button class="avatar-opt-btn ${avatar.state.hairStyle === style ? 'active' : ''}" data-value="${style}">
                  ${style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Hair Color</label>
            <div class="avatar-option-buttons color-opts" data-option="hairColor">
              ${Object.entries(AVATAR_CONFIG.hairColors).map(([key, color]) => `
                <button class="avatar-opt-btn color-btn ${avatar.state.hairColor === key ? 'active' : ''}"
                        data-value="${key}" style="background:${color}"></button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Outfit Color</label>
            <div class="avatar-option-buttons color-opts" data-option="outfitColor">
              ${Object.entries(AVATAR_CONFIG.outfitColors).map(([key, color]) => `
                <button class="avatar-opt-btn color-btn ${avatar.state.outfitColor === key ? 'active' : ''}"
                        data-value="${key}" style="background:${color}"></button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Accessory</label>
            <div class="avatar-option-buttons" data-option="accessory">
              ${AVATAR_CONFIG.accessories.map(acc => `
                <button class="avatar-opt-btn ${avatar.state.accessory === acc ? 'active' : ''}" data-value="${acc}">
                  ${acc.charAt(0).toUpperCase() + acc.slice(1)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="avatar-option-group">
            <label>Room</label>
            <div class="avatar-option-buttons" data-option="roomBackground">
              ${Object.keys(AVATAR_CONFIG.backgrounds).map(bg => `
                <button class="avatar-opt-btn ${avatar.state.roomBackground === bg ? 'active' : ''}" data-value="${bg}">
                  ${bg.charAt(0).toUpperCase() + bg.slice(1)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="avatar-customizer-footer">
        <button class="avatar-save-btn" id="avatar-save-btn">Save Avatar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Create preview avatar
  const previewAvatar = new Avatar('avatar-customizer-preview', {
    width: 180,
    height: 260,
    showRoom: true
  });
  previewAvatar.state = { ...avatar.state };
  previewAvatar.render();

  // Handle option button clicks
  modal.querySelectorAll('.avatar-option-buttons').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.avatar-opt-btn');
      if (!btn) return;

      const option = group.dataset.option;
      const value = btn.dataset.value;

      // Update active state
      group.querySelectorAll('.avatar-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update preview
      previewAvatar.setOption(option, value);
      avatar.setOption(option, value);
    });
  });

  // Handle save
  document.getElementById('avatar-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('avatar-save-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const success = await avatar.save(userId);

    if (success) {
      modal.remove();
      if (onSave) onSave(avatar.state);
    } else {
      btn.textContent = 'Error - Try Again';
      btn.disabled = false;
    }
  });
}

// Export for use
window.Avatar = Avatar;
window.createAvatarCustomizer = createAvatarCustomizer;
window.AVATAR_CONFIG = AVATAR_CONFIG;
