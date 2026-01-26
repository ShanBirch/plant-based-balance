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
          bottom: 20%;
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
   * Render room decorations based on background type
   */
  renderRoomProps(type) {
    const props = {
      gym: `
        <div style="position:absolute;right:10%;bottom:42%;width:30px;height:60px;background:#666;border-radius:4px;"></div>
        <div style="position:absolute;right:12%;bottom:42%;width:40px;height:8px;background:#333;border-radius:2px;"></div>
        <div style="position:absolute;left:10%;bottom:42%;width:25px;height:25px;background:#444;border-radius:50%;border:3px solid #333;"></div>
      `,
      park: `
        <div style="position:absolute;left:10%;bottom:40%;width:20px;height:80px;background:#8B4513;"></div>
        <div style="position:absolute;left:5%;bottom:70%;width:50px;height:50px;background:#228B22;border-radius:50%;"></div>
        <div style="position:absolute;right:15%;bottom:42%;font-size:24px;">🌸</div>
      `,
      home: `
        <div style="position:absolute;right:10%;bottom:45%;width:40px;height:50px;background:#DEB887;border:2px solid #8B4513;"></div>
        <div style="position:absolute;left:10%;bottom:70%;width:30px;height:40px;background:#87CEEB;border:3px solid #fff;"></div>
      `,
      beach: `
        <div style="position:absolute;right:15%;bottom:42%;font-size:30px;">🌴</div>
        <div style="position:absolute;left:20%;bottom:42%;font-size:20px;">🐚</div>
      `,
      mountain: `
        <div style="position:absolute;right:5%;bottom:40%;width:0;height:0;border-left:40px solid transparent;border-right:40px solid transparent;border-bottom:80px solid #696969;"></div>
        <div style="position:absolute;right:15%;bottom:80%;width:0;height:0;border-left:15px solid transparent;border-right:15px solid transparent;border-bottom:20px solid #fff;"></div>
      `
    };
    return props[type] || '';
  }

  /**
   * Render the character SVG
   */
  renderCharacter() {
    const skin = AVATAR_CONFIG.skinTones[this.state.skinTone];
    const hair = AVATAR_CONFIG.hairColors[this.state.hairColor];
    const outfit = AVATAR_CONFIG.outfitColors[this.state.outfitColor];
    const fitness = this.state.fitnessLevel;
    const mood = this.state.mood;

    // Calculate body proportions based on fitness
    const muscleScale = 0.8 + (fitness / 100) * 0.4; // 0.8 to 1.2
    const bodyWidth = 30 * muscleScale;
    const shoulderWidth = 35 * muscleScale;

    // Get expression based on mood
    const expression = this.getExpression(mood);

    // Animation class based on energy
    const animClass = this.getAnimationClass();

    return `
      <svg width="80" height="140" viewBox="0 0 80 140" class="avatar-svg ${animClass}">
        <!-- Head -->
        <ellipse cx="40" cy="25" rx="18" ry="20" fill="${skin}"/>

        <!-- Hair -->
        ${this.renderHair(hair)}

        <!-- Face Expression -->
        ${expression}

        <!-- Accessory -->
        ${this.renderAccessory()}

        <!-- Neck -->
        <rect x="35" y="43" width="10" height="8" fill="${skin}"/>

        <!-- Body/Torso -->
        <path d="M${40-shoulderWidth/2} 51
                 Q${40-shoulderWidth/2-5} 60 ${40-bodyWidth/2} 85
                 L${40+bodyWidth/2} 85
                 Q${40+shoulderWidth/2+5} 60 ${40+shoulderWidth/2} 51
                 Z"
              fill="${outfit}"/>

        <!-- Arms -->
        <ellipse cx="${40-shoulderWidth/2-5}" cy="65" rx="${5*muscleScale}" ry="20" fill="${skin}" class="arm-left"/>
        <ellipse cx="${40+shoulderWidth/2+5}" cy="65" rx="${5*muscleScale}" ry="20" fill="${skin}" class="arm-right"/>

        <!-- Shorts -->
        <rect x="${40-bodyWidth/2}" y="85" width="${bodyWidth}" height="20" fill="#333"/>

        <!-- Legs -->
        <rect x="${40-bodyWidth/4-5}" y="105" width="${8*muscleScale}" height="30" fill="${skin}" class="leg-left"/>
        <rect x="${40+bodyWidth/4-3}" y="105" width="${8*muscleScale}" height="30" fill="${skin}" class="leg-right"/>

        <!-- Shoes -->
        <ellipse cx="${40-bodyWidth/4-1}" cy="137" rx="8" ry="4" fill="#fff"/>
        <ellipse cx="${40+bodyWidth/4+1}" cy="137" rx="8" ry="4" fill="#fff"/>
      </svg>
    `;
  }

  /**
   * Render hair based on style
   */
  renderHair(color) {
    const styles = {
      short: `<path d="M22 20 Q25 5 40 5 Q55 5 58 20 Q58 15 55 12 Q50 8 40 8 Q30 8 25 12 Q22 15 22 20" fill="${color}"/>`,
      medium: `<path d="M20 25 Q22 5 40 3 Q58 5 60 25 Q58 15 55 10 Q50 5 40 5 Q30 5 25 10 Q22 15 20 25" fill="${color}"/>
               <path d="M20 25 Q18 35 20 40" stroke="${color}" stroke-width="8" fill="none"/>
               <path d="M60 25 Q62 35 60 40" stroke="${color}" stroke-width="8" fill="none"/>`,
      long: `<path d="M18 25 Q20 3 40 2 Q60 3 62 25 Q60 15 55 8 Q50 3 40 3 Q30 3 25 8 Q20 15 18 25" fill="${color}"/>
             <path d="M18 25 Q15 50 18 70" stroke="${color}" stroke-width="10" fill="none"/>
             <path d="M62 25 Q65 50 62 70" stroke="${color}" stroke-width="10" fill="none"/>`,
      bald: '',
      ponytail: `<path d="M22 20 Q25 5 40 5 Q55 5 58 20" fill="${color}"/>
                 <ellipse cx="55" cy="10" rx="8" ry="6" fill="${color}"/>
                 <path d="M60 12 Q70 15 68 35" stroke="${color}" stroke-width="6" fill="none"/>`,
      bun: `<path d="M22 20 Q25 5 40 5 Q55 5 58 20" fill="${color}"/>
            <circle cx="40" cy="3" r="10" fill="${color}"/>`
    };
    return styles[this.state.hairStyle] || styles.short;
  }

  /**
   * Get facial expression based on mood
   */
  getExpression(mood) {
    const expressions = {
      sad: `
        <ellipse cx="33" cy="22" rx="3" ry="2" fill="#333"/>
        <ellipse cx="47" cy="22" rx="3" ry="2" fill="#333"/>
        <path d="M33 33 Q40 30 47 33" stroke="#333" stroke-width="2" fill="none"/>
      `,
      tired: `
        <line x1="30" y1="22" x2="36" y2="23" stroke="#333" stroke-width="2"/>
        <line x1="44" y1="23" x2="50" y2="22" stroke="#333" stroke-width="2"/>
        <ellipse cx="40" cy="34" rx="4" ry="2" fill="#333"/>
      `,
      neutral: `
        <ellipse cx="33" cy="22" rx="3" ry="3" fill="#333"/>
        <ellipse cx="47" cy="22" rx="3" ry="3" fill="#333"/>
        <line x1="35" y1="33" x2="45" y2="33" stroke="#333" stroke-width="2"/>
      `,
      happy: `
        <ellipse cx="33" cy="22" rx="3" ry="3" fill="#333"/>
        <ellipse cx="47" cy="22" rx="3" ry="3" fill="#333"/>
        <path d="M33 32 Q40 38 47 32" stroke="#333" stroke-width="2" fill="none"/>
      `,
      energetic: `
        <ellipse cx="33" cy="22" rx="3" ry="4" fill="#333"/>
        <ellipse cx="47" cy="22" rx="3" ry="4" fill="#333"/>
        <path d="M32 31 Q40 40 48 31" stroke="#333" stroke-width="2" fill="none"/>
        <circle cx="28" cy="28" rx="4" ry="2" fill="#FFB6C1" opacity="0.6"/>
        <circle cx="52" cy="28" rx="4" ry="2" fill="#FFB6C1" opacity="0.6"/>
      `,
      champion: `
        <path d="M30 20 L33 24 L36 20" stroke="#333" stroke-width="2" fill="none"/>
        <path d="M44 20 L47 24 L50 20" stroke="#333" stroke-width="2" fill="none"/>
        <path d="M30 31 Q40 42 50 31" stroke="#333" stroke-width="2.5" fill="none"/>
        <text x="40" y="8" text-anchor="middle" font-size="10">✨</text>
      `
    };
    return expressions[mood] || expressions.neutral;
  }

  /**
   * Render accessory
   */
  renderAccessory() {
    const accessories = {
      none: '',
      headband: `<rect x="22" y="12" width="36" height="4" rx="2" fill="#ff4444"/>`,
      glasses: `
        <rect x="26" y="19" width="12" height="8" rx="2" fill="none" stroke="#333" stroke-width="1.5"/>
        <rect x="42" y="19" width="12" height="8" rx="2" fill="none" stroke="#333" stroke-width="1.5"/>
        <line x1="38" y1="23" x2="42" y2="23" stroke="#333" stroke-width="1.5"/>
      `,
      cap: `
        <path d="M20 18 Q25 8 40 8 Q55 8 60 18 L58 20 Q55 12 40 12 Q25 12 22 20 Z" fill="#333"/>
        <rect x="55" y="16" width="12" height="3" rx="1" fill="#333"/>
      `,
      wristband: `
        <rect x="${40-25}" y="75" width="8" height="4" rx="1" fill="#ff4444"/>
        <rect x="${40+17}" y="75" width="8" height="4" rx="1" fill="#ff4444"/>
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
