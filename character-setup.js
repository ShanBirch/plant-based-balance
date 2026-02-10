/**
 * Character Setup Logic
 * Handles 3D model customization for onboarding.
 */

// Mapping of material parts for each level (for future proofing)
const MAPPINGS = {
    1: { skin: 'Material_tripo_part_new_0.001', hair: 'Material_tripo_part_0.001', pants: 'Material_tripo_part_8.001', shoes: 'Material_tripo_part_3.001' },
    10: { skin: 'tripo_part_5', hair: 'tripo_part_6', pants: 'tripo_part_8', shoes: 'tripo_part_new_0' },
    20: { skin: 'tripo_part_8', hair: 'tripo_part_5', pants: 'tripo_part_9', shoes: 'tripo_part_12' },
    30: { skin: 'tripo_part_13', hair: 'tripo_part_4', pants: 'tripo_part_5.001', shoes: 'tripo_part_2.001' },
    40: { skin: 'tripo_part_10', hair: 'tripo_part_5.002', pants: 'tripo_part_6.002', shoes: 'tripo_part_2.002' },
    50: { skin: 'tripo_part_11', hair: 'tripo_part_4.001', pants: 'tripo_part_new_0_3', shoes: 'tripo_part_new_0_0' },
    60: { skin: 'tripo_part_18', hair: 'tripo_part_new_0', pants: 'tripo_part_9.001', shoes: 'tripo_part_3.001' },
    70: { skin: 'tripo_part_0.001', hair: 'tripo_part_new_0.001', pants: 'tripo_part_7.001', shoes: 'tripo_part_2.003' },
    80: { skin: 'tripo_part_12.001', hair: 'tripo_part_new_0.002', pants: 'tripo_part_15.001', shoes: 'tripo_part_3.002' },
    90: { skin: 'tripo_part_11.001', hair: 'tripo_part_new_0.003', pants: 'tripo_part_7.002', shoes: 'tripo_part_2.004' },
    99: { skin: 'tripo_part_13.001', hair: 'tripo_part_17', pants: 'tripo_part_15.002', shoes: 'tripo_part_25' }
};

// Current State
let currentState = {
    hairColor: '#FFD700', // Default Blonde
    pantsColor: '#DC2626', // Default Red
    shoesColor: '#FFFFFF' // Default White
};

// DOM Elements
const modelViewer = document.getElementById('character-viewer');
const saveBtn = document.getElementById('save-btn');

/**
 * Updates the material color on the 3D model.
 */
function updateMaterial(type, hexColor) {
    if (!modelViewer || !modelViewer.model) return;

    const rgb = hexToRgb(hexColor);
    const colorArray = [rgb.r/255, rgb.g/255, rgb.b/255, 1];

    // We assume Level 1 for setup
    const mapping = MAPPINGS[1]; 
    const targetName = mapping[type]; // e.g., 'tripo_part_5' for hair

    modelViewer.model.materials.forEach(mat => {
        if (mat.name === targetName) {
            mat.pbrMetallicRoughness.setBaseColorFactor(colorArray);
            mat.pbrMetallicRoughness.baseColorTexture = null; // Remove texture to apply solid color
        }
    });

    // Update State
    if (type === 'hair') currentState.hairColor = hexColor;
    if (type === 'pants') currentState.pantsColor = hexColor;
    if (type === 'shoes') currentState.shoesColor = hexColor;
}

/**
 * Utility: HEX to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// Ensure model is loaded before applying defaults
modelViewer.addEventListener('load', () => {
    // Apply initial defaults
    updateMaterial('hair', currentState.hairColor);
    updateMaterial('pants', currentState.pantsColor);
    updateMaterial('shoes', currentState.shoesColor);
});

// Event Listeners for Color Buttons
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = btn.dataset.type;
        const color = btn.dataset.color;
        
        // Visual Selection
        document.querySelectorAll(`.color-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Apply Color
        updateMaterial(type, color);
    });
});

// Save & Continue
saveBtn.addEventListener('click', () => {
    // Save to LocalStorage
    localStorage.setItem('pbb_character_config', JSON.stringify(currentState));

    // Suppress weigh-in popup on dashboard — user already entered weight during quiz
    localStorage.setItem('lastWeighInPromptDate', new Date().toDateString());

    // Show app download prompt if not already installed as PWA
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const overlay = document.getElementById('download-app-overlay');

    if (!isInstalled && overlay) {
        overlay.style.display = 'flex';
    } else {
        // Already installed or overlay missing — go straight to next page
        window.location.href = 'plantbasedswitch.html';
    }
});
