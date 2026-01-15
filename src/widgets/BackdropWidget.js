class BackdropWidget extends StartWidget {
  constructor() {
    super();

    // Define 8 aesthetically pleasing background color pairs (light/dark mode hex values)
    // These are more muted and suitable for backgrounds
    this.backgroundColorPairs = [
      {
        name: 'Default',
        light: null,
        dark: null
      },
      {
        name: 'Slate',
        light: '#f1f5f9',
        dark: '#1e293b'
      },
      {
        name: 'Zinc',
        light: '#fafafa',
        dark: '#18181b'
      },
      {
        name: 'Stone',
        light: '#fafaf9',
        dark: '#292524'
      },
      {
        name: 'Warm',
        light: '#fef3c7',
        dark: '#451a03'
      },
      {
        name: 'Sky',
        light: '#e0f2fe',
        dark: '#0c4a6e'
      },
      {
        name: 'Sage',
        light: '#f0fdf4',
        dark: '#14532d'
      },
      {
        name: 'Lavender',
        light: '#faf5ff',
        dark: '#3b0764'
      }
    ];

    // Define 8 aesthetically pleasing gradient pairs (light/dark mode)
    // Format: { name, light: [color1, color2], dark: [color1, color2] }
    this.gradientPairs = [
      {
        name: 'Ocean',
        light: ['#e0f2fe', '#dbeafe'],
        dark: ['#0c4a6e', '#1e3a8a']
      },
      {
        name: 'Sunset',
        light: ['#fee2e2', '#fef3c7'],
        dark: ['#7c2d12', '#78350f']
      },
      {
        name: 'Forest',
        light: ['#d1fae5', '#dbeafe'],
        dark: ['#064e3b', '#1e3a8a']
      },
      {
        name: 'Lavender',
        light: ['#fae8ff', '#ede9fe'],
        dark: ['#581c87', '#4c1d95']
      },
      {
        name: 'Rose',
        light: ['#ffe4e6', '#fce7f3'],
        dark: ['#881337', '#831843']
      },
      {
        name: 'Mint',
        light: ['#d1fae5', '#ecfdf5'],
        dark: ['#064e3b', '#022c22']
      },
      {
        name: 'Peach',
        light: ['#ffedd5', '#fef3c7'],
        dark: ['#7c2d12', '#78350f']
      },
      {
        name: 'Twilight',
        light: ['#dbeafe', '#e0e7ff'],
        dark: ['#1e3a8a', '#312e81']
      }
    ];
  }

  getId() {
    return 'backdrop';
  }

  getName() {
    return 'Backdrop';
  }

  registerConfig(config) {
    // Register backdropMode field (backdrop.mode)
    this.registerStringField(config, 'backdropMode', 'mode', 'solid');
    // Register backdropColor field (backdrop.color)
    this.registerStringField(config, 'backdropColor', 'color', 'Default');
    // Register backdropGradient field (backdrop.gradient)
    this.registerStringField(config, 'backdropGradient', 'gradient', 'Ocean');
    // Register backdropAngle field (backdrop.angle)
    const angleKey = this.getConfigKey('angle');
    Object.defineProperty(config, 'backdropAngle', {
      get: function() { return this._get(angleKey, 135); }
    });
    Object.defineProperty(config, 'setBackdropAngle', {
      value: async function(value) { await this._set(angleKey, Number(value)); }
    });
    // Register backdropImage field (backdrop.image) - stores file path or data URL
    this.registerStringField(config, 'backdropImage', 'image', '');
    // Register backdropImageRepeat field (backdrop.imageRepeat)
    const repeatKey = this.getConfigKey('imageRepeat');
    Object.defineProperty(config, 'backdropImageRepeat', {
      get: function() { return this._get(repeatKey, false); }
    });
    Object.defineProperty(config, 'setBackdropImageRepeat', {
      value: async function(value) { await this._set(repeatKey, Boolean(value)); }
    });
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';

    // Define available images
    const repeatImages = [
      'backdrop/repeat/seamless-pool-water-surface-1699261204xl0.jpg',
      'backdrop/repeat/stone_texture_AGF81.jpg',
      'backdrop/repeat/wood_texture_10ravens.jpeg'
    ];

    const fitImages = [
     'backdrop/pexels-photo-449011.jpeg',
     'backdrop/flower-garden-blue-sky-hokkaido-japan-60628.jpeg',
     'backdrop/ssha-kolorado-gory-plato-ultra-hd-panorama-4k-5k.jpg',
     'backdrop/G9w1XUpWoAAomGc.jpeg',
     'backdrop/G9w1XUqXwAAP4CB.jpeg',
     'backdrop/G9w1XUrXAAEKoX4.jpeg',
     'backdrop/G9w1XUvXUAAQT1B.jpeg',
 
    ];

    // Generate background color option buttons
    const backgroundColorOptions = this.backgroundColorPairs.map(color => `
      <label class="cursor-pointer">
        <input type="radio" name="backdropColor" value="${color.name}" class="hidden peer" />
        <div class="w-full p-3 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors flex items-center gap-2">
          <div class="w-6 h-6 rounded-full" style="background: ${color.light || '#e5e7eb'}"></div>
          <span class="text-sm font-medium">${color.name}</span>
        </div>
      </label>
    `).join('');

    // Generate gradient option buttons
    const gradientOptions = this.gradientPairs.map(gradient => `
      <label class="cursor-pointer">
        <input type="radio" name="backdropGradient" value="${gradient.name}" class="hidden peer" />
        <div class="w-full p-3 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors flex items-center gap-2">
          <div class="w-6 h-6 rounded-full" style="background: linear-gradient(135deg, ${gradient.light[0]}, ${gradient.light[1]})"></div>
          <span class="text-sm font-medium">${gradient.name}</span>
        </div>
      </label>
    `).join('');

    // Generate repeat image options with thumbnails
    const repeatImageOptions = repeatImages.map(imgPath => `
      <label class="cursor-pointer">
        <input type="radio" name="backdropImage" value="${imgPath}" data-repeat="true" class="hidden peer" />
        <div class="w-full p-2 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors">
          <img src="img/${imgPath}" alt="Tiled backdrop" class="w-full h-16 object-cover rounded" />
        </div>
      </label>
    `).join('');

    // Add custom tiled image upload option
    const customTiledOption = `
      <label class="cursor-pointer">
        <input type="radio" name="backdropImage" value="custom-tiled" data-repeat="true" data-custom="true" class="hidden peer" />
        <div class="w-full p-2 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors">
          <div id="customTiledPreview" class="w-full h-16 rounded bg-base-300 flex items-center justify-center text-4xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
      </label>
    `;

    // Generate fit image options with thumbnails
    const fitImageOptions = fitImages.map(imgPath => `
      <label class="cursor-pointer">
        <input type="radio" name="backdropImage" value="${imgPath}" data-repeat="false" class="hidden peer" />
        <div class="w-full p-2 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors">
          <img src="img/${imgPath}" alt="Fitted backdrop" class="w-full h-16 object-cover rounded" />
        </div>
      </label>
    `).join('');

    // Add custom fitted image upload option
    const customFittedOption = `
      <label class="cursor-pointer">
        <input type="radio" name="backdropImage" value="custom-fitted" data-repeat="false" data-custom="true" class="hidden peer" />
        <div class="w-full p-2 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors">
          <div id="customFittedPreview" class="w-full h-16 rounded bg-base-300 flex items-center justify-center text-4xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
      </label>
    `;

    section.innerHTML = `
      <h3 class="text-sm font-semibold mb-3">Backdrop</h3>
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Backdrop Mode</span>
        </label>
        <div class="space-y-2">
          <label class="flex items-center cursor-pointer">
            <input type="radio" name="backdropMode" value="solid" class="radio radio-primary" />
            <span class="ml-2">Solid</span>
          </label>
          <label class="flex items-center cursor-pointer">
            <input type="radio" name="backdropMode" value="gradient" class="radio radio-primary" />
            <span class="ml-2">Gradient</span>
          </label>
          <label class="flex items-center cursor-pointer">
            <input type="radio" name="backdropMode" value="image" class="radio radio-primary" />
            <span class="ml-2">Image</span>
          </label>
        </div>
      </div>

      <!-- Color selection (shown only when solid mode is selected) -->
      <div id="backdropColorSection" class="form-control hidden">
        <label class="label">
          <span class="label-text">Background Color</span>
        </label>
        <div class="space-y-2">
          ${backgroundColorOptions}
        </div>
      </div>

      <!-- Gradient selection (shown only when gradient mode is selected) -->
      <div id="backdropGradientSection" class="form-control hidden">
        <label class="label">
          <span class="label-text">Gradient</span>
        </label>
        <div class="space-y-2 mb-4">
          ${gradientOptions}
        </div>
        <label class="label">
          <span class="label-text">Gradient Angle: <span id="backdropAngleValue">135</span>°</span>
        </label>
        <input type="range" id="backdropAngleSlider" min="0" max="360" value="135" class="range range-primary" step="15" />
        <div class="w-full flex justify-between text-xs px-2 mt-1">
          <span>0°</span>
          <span>90°</span>
          <span>180°</span>
          <span>270°</span>
          <span>360°</span>
        </div>
      </div>

      <!-- Image selection (shown only when image mode is selected) -->
      <div id="backdropImageSection" class="form-control hidden">
        <label class="label">
          <span class="label-text">Tiled Backgrounds</span>
        </label>
        <div class="grid grid-cols-2 gap-2 mb-4">
          ${repeatImageOptions}
          ${customTiledOption}
        </div>
        <label class="label">
          <span class="label-text">Fitted Backgrounds</span>
        </label>
        <div class="grid grid-cols-2 gap-2 mb-4">
          ${fitImageOptions}
          ${customFittedOption}
        </div>

        <!-- Hidden file inputs for custom image uploads -->
        <input type="file" id="customTiledInput" accept="image/*" class="hidden" />
        <input type="file" id="customFittedInput" accept="image/*" class="hidden" />
      </div>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    const modeRadios = document.querySelectorAll('input[name="backdropMode"]');
    const colorRadios = document.querySelectorAll('input[name="backdropColor"]');
    const gradientRadios = document.querySelectorAll('input[name="backdropGradient"]');
    const imageRadios = document.querySelectorAll('input[name="backdropImage"]');
    const colorSection = document.getElementById('backdropColorSection');
    const gradientSection = document.getElementById('backdropGradientSection');
    const imageSection = document.getElementById('backdropImageSection');
    const angleSlider = document.getElementById('backdropAngleSlider');
    const angleValue = document.getElementById('backdropAngleValue');

    // Widget initialization on main page
    this.currentMode = config.backdropMode;

    // Apply background based on mode
    if (config.backdropMode === 'solid') {
      this.applyBackgroundColor(config.backdropColor);
    } else if (config.backdropMode === 'gradient') {
      this.applyGradient(config.backdropGradient, config.backdropAngle);
    } else if (config.backdropMode === 'image') {
      this.applyBackgroundImage(config.backdropImage, config.backdropImageRepeat);
    }

    // Function to show/hide sections based on mode
    const updateSectionVisibility = (mode) => {
      if (mode === 'solid') {
        colorSection.classList.remove('hidden');
        gradientSection.classList.add('hidden');
        imageSection.classList.add('hidden');
      } else if (mode === 'gradient') {
        colorSection.classList.add('hidden');
        gradientSection.classList.remove('hidden');
        imageSection.classList.add('hidden');
      } else if (mode === 'image') {
        colorSection.classList.add('hidden');
        gradientSection.classList.add('hidden');
        imageSection.classList.remove('hidden');
      } else {
        colorSection.classList.add('hidden');
        gradientSection.classList.add('hidden');
        imageSection.classList.add('hidden');
      }
    };

    // Initialize radio button state
    modeRadios.forEach(radio => {
      if (radio.value === config.backdropMode) {
        radio.checked = true;
      }
    });

    // Initialize section visibility
    updateSectionVisibility(config.backdropMode);

    // Initialize selected background color
    colorRadios.forEach(radio => {
      if (radio.value === config.backdropColor) {
        radio.checked = true;
      }
    });

    // Initialize selected gradient
    gradientRadios.forEach(radio => {
      if (radio.value === config.backdropGradient) {
        radio.checked = true;
      }
    });

    // Initialize selected image
    imageRadios.forEach(radio => {
      if (radio.value === config.backdropImage) {
        radio.checked = true;
      }
    });

    // Initialize angle slider
    angleSlider.value = config.backdropAngle;
    angleValue.textContent = config.backdropAngle;

    // Listen for mode changes
    modeRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newMode = e.target.value;
        await config.setBackdropMode(newMode);
        updateSectionVisibility(newMode);

        // Apply the backdrop immediately
        if (newMode === 'solid') {
          this.applyBackgroundColor(config.backdropColor);
        } else if (newMode === 'gradient') {
          this.applyGradient(config.backdropGradient, config.backdropAngle);
        } else if (newMode === 'image') {
          this.applyBackgroundImage(config.backdropImage, config.backdropImageRepeat);
        } else {
          // Clear backdrop
          this.clearBackground();
        }
      });
    });

    // Listen for color changes
    colorRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newColor = e.target.value;
        await config.setBackdropColor(newColor);
        this.applyBackgroundColor(newColor);
      });
    });

    // Listen for gradient changes
    gradientRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newGradient = e.target.value;
        await config.setBackdropGradient(newGradient);
        this.applyGradient(newGradient, config.backdropAngle);
      });
    });

    // Listen for angle changes
    angleSlider.addEventListener('input', (e) => {
      const newAngle = e.target.value;
      angleValue.textContent = newAngle;
    });

    angleSlider.addEventListener('change', async (e) => {
      const newAngle = e.target.value;
      await config.setBackdropAngle(newAngle);
      this.applyGradient(config.backdropGradient, newAngle);
    });

    // Listen for image changes
    imageRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newImage = e.target.value;
        const isRepeat = e.target.dataset.repeat === 'true';
        const isCustom = e.target.dataset.custom === 'true';

        if (isCustom) {
          // Trigger file input for custom images
          const fileInput = isRepeat
            ? document.getElementById('customTiledInput')
            : document.getElementById('customFittedInput');
          fileInput.click();
        } else {
          await config.setBackdropImage(newImage);
          await config.setBackdropImageRepeat(isRepeat);
          this.applyBackgroundImage(newImage, isRepeat);
        }
      });
    });

    // Handle custom tiled image upload
    const customTiledInput = document.getElementById('customTiledInput');
    const customTiledPreview = document.getElementById('customTiledPreview');
    const customTiledRadio = document.querySelector('input[value="custom-tiled"]');

    customTiledInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          await config.setBackdropImage(dataUrl);
          await config.setBackdropImageRepeat(true);

          // Apply the image
          this.applyBackgroundImage(dataUrl, true);
        };
        reader.readAsDataURL(file);
      }
    });

    // Handle custom fitted image upload
    const customFittedInput = document.getElementById('customFittedInput');
    const customFittedPreview = document.getElementById('customFittedPreview');
    const customFittedRadio = document.querySelector('input[value="custom-fitted"]');

    customFittedInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          await config.setBackdropImage(dataUrl);
          await config.setBackdropImageRepeat(false);

          // Apply the image
          this.applyBackgroundImage(dataUrl, false);
        };
        reader.readAsDataURL(file);
      }
    });

    // Initialize custom image radio selections if backdropImage contains a data URL
    if (config.backdropImage && config.backdropImage.startsWith('data:')) {
      if (config.backdropImageRepeat) {
        customTiledRadio.checked = true;
      } else {
        customFittedRadio.checked = true;
      }
    }
  }

  clearBackground() {
    // Low-level function that completely clears and resets all background properties
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundPosition = '';
  }

  applyBackgroundGradient(colors, angle = 135, weights = null) {
    // Low-level function that applies colors/gradients directly to CSS
    if (!colors || colors.length === 0) {
      // Clear background completely
      this.clearBackground();
      return;
    }

    // Clear all background properties first
    this.clearBackground();

    if (colors.length === 1) {
      // Single color - solid background
      document.body.style.backgroundColor = colors[0] || '';
      return;
    }

    // Multiple colors - create gradient
    // Calculate color stops based on weights
    let stops = [];

    if (weights && weights.length === colors.length) {
      // Normalize weights to sum to 1
      const total = weights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = weights.map(w => w / total);

      // Calculate cumulative positions for color stops
      let cumulative = 0;
      stops = colors.map((color, i) => {
        if (i === 0) {
          return `${color} 0%`;
        }
        cumulative += normalizedWeights[i - 1];
        const pos = Math.round(cumulative * 100);
        if (i === colors.length - 1) {
          return `${color} 100%`;
        }
        return `${color} ${pos}%`;
      });
    } else {
      // Equal distribution - evenly space colors
      stops = colors.map((color, i) => {
        const pos = Math.round((i / (colors.length - 1)) * 100);
        return `${color} ${pos}%`;
      });
    }

    // Apply gradient (background already cleared above)
    document.body.style.backgroundImage = `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }

  applyBackgroundColor(colorName) {
    // Find the color pair
    const colorPair = this.backgroundColorPairs.find(c => c.name === colorName);
    if (!colorPair) {
      console.warn(`Background color "${colorName}" not found, using default`);
      this.clearBackground();
      return;
    }

    // If "Default" is selected, remove the background
    if (colorName === 'Default' || !colorPair.light || !colorPair.dark) {
      this.clearBackground();
      return;
    }

    // Determine if we're in dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const backgroundColor = isDark ? colorPair.dark : colorPair.light;

    // Use unified gradient function with single color
    this.applyBackgroundGradient([backgroundColor]);
  }

  applyGradient(gradientName, angle = 135) {
    // Find the gradient pair
    const gradientPair = this.gradientPairs.find(g => g.name === gradientName);
    if (!gradientPair) {
      console.warn(`Gradient "${gradientName}" not found, using default`);
      this.clearBackground();
      return;
    }

    // Determine if we're in dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = isDark ? gradientPair.dark : gradientPair.light;

    // Use unified gradient function
    this.applyBackgroundGradient(colors, angle);
  }

  applyBackgroundImage(src, tiled = false) {
    if (!src) {
      // Clear all backgrounds
      this.clearBackground();
      return;
    }

    // Clear all backgrounds first
    this.clearBackground();

    // Determine if src is a data URL or a file path
    const imageUrl = src.startsWith('data:') ? src : `img/${src}`;
    document.body.style.backgroundImage = `url('${imageUrl}')`;

    if (tiled) {
      // Tiled mode
      document.body.style.backgroundRepeat = 'repeat';
      document.body.style.backgroundSize = 'auto';
      document.body.style.backgroundPosition = 'top left';
    } else {
      // Fitted mode
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    }
  }


  show() {
    // Skeleton - implement when adding actual backdrop functionality
  }

  hide() {
    // Skeleton - implement when adding actual backdrop functionality
  }
}

const backdropWidget = new BackdropWidget();
