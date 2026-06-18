/**
 * Sneaker Viewer Module
 * GLTF loader, orbit controls, animations, and hotspot handling
 */

window.SneakerViewer = window.SneakerViewer || {};

(function() {
  'use strict';

  /**
   * SneakerViewer Class
   * Manages 3D sneaker display with interactions
   */
  class SneakerViewer {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.options = Object.assign({
        glbUrl: '',
        envUrl: '',
        autoRotate: true,
        autoRotateSpeed: 0.5,
        enableZoom: true,
        hotspots: [],
        onModelLoad: null,
        onError: null
      }, options || {});

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.model = null;
      this.hotspots = [];
      this.animationId = null;
      this.clock = new THREE.Clock();
      this.isInteracting = false;
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();

      this.init();
    }

    /**
     * Initialize the viewer
     */
    init() {
      this.setupScene();
      this.setupRenderer();
      this.setupLights();
      this.setupControls();
      this.setupEnvironment();
      this.loadModel();
      this.setupEventListeners();
      this.animate();
    }

    /**
     * Setup Three.js scene
     */
    setupScene() {
      this.scene = new THREE.Scene();
      
      const aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
      this.camera.position.set(0, 0, 5);
    }

    /**
     * Setup WebGL renderer
     */
    setupRenderer() {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true
      });

      this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    /**
     * Setup scene lighting
     */
    setupLights() {
      // Ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      this.scene.add(ambientLight);

      // Directional light
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      this.scene.add(directionalLight);
    }

    /**
     * Setup orbit controls
     */
    setupControls() {
      if (typeof OrbitControls === 'undefined') return;

      this.controls = new THREE.OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 2;
      this.controls.maxDistance = 8;
      this.controls.maxPolarAngle = Math.PI / 2;
      this.controls.autoRotate = this.options.autoRotate;
      this.controls.autoRotateSpeed = this.options.autoRotateSpeed;
      this.controls.enableZoom = this.options.enableZoom;
    }

    /**
     * Setup environment map
     */
    setupEnvironment() {
      if (this.options.envUrl && typeof THREE.PMREMGenerator !== 'undefined') {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        new THREE.TextureLoader().load(this.options.envUrl, (texture) => {
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          this.scene.environment = envMap;
          pmremGenerator.dispose();
        });
      } else {
        // Fallback gradient
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
        this.scene.background = new THREE.Color(0x0a0a0a);
      }
    }

    /**
     * Load 3D model
     */
    loadModel() {
      const loader = new THREE.GLTFLoader();
      
      // Setup DRACO loader
      if (typeof THREE.DRACOLoader !== 'undefined') {
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
        loader.setDRACOLoader(dracoLoader);
      }

      if (this.options.glbUrl) {
        loader.load(
          this.options.glbUrl,
          (gltf) => this.onModelLoaded(gltf),
          (progress) => this.onModelProgress(progress),
          (error) => this.onModelError(error)
        );
      } else {
        // Use procedural fallback
        const proceduralModel = ThreeConfig.createProceduralSneaker();
        ThreeConfig.centerModel(proceduralModel, 0.5);
        this.model = proceduralModel;
        this.scene.add(this.model);
        
        if (this.options.onModelLoad) {
          this.options.onModelLoad(this.model);
        }
      }
    }

    /**
     * Handle model loaded
     * @param {GLTF} gltf 
     */
    onModelLoaded(gltf) {
      this.model = gltf.scene;
      ThreeConfig.centerModel(this.model, 0.5);
      this.scene.add(this.model);

      // Create hotspots if defined
      if (this.options.hotspots.length > 0) {
        this.createHotspots();
      }

      if (this.options.onModelLoad) {
        this.options.onModelLoad(this.model);
      }
    }

    /**
     * Handle model loading progress
     * @param {ProgressEvent} progress 
     */
    onModelProgress(progress) {
      const percent = (progress.loaded / progress.total) * 100;
      console.log(`Loading: ${percent.toFixed(0)}%`);
    }

    /**
     * Handle model loading error
     * @param {Error} error 
     */
    onModelError(error) {
      console.warn('GLB load failed, using procedural fallback:', error);
      
      const proceduralModel = ThreeConfig.createProceduralSneaker();
      ThreeConfig.centerModel(proceduralModel, 0.5);
      this.model = proceduralModel;
      this.scene.add(this.model);

      if (this.options.onError) {
        this.options.onError(error);
      }
    }

    /**
     * Create interactive hotspots on model
     */
    createHotspots() {
      this.options.hotspots.forEach((hotspotConfig) => {
        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff3366,
          transparent: true,
          opacity: 0.8
        });
        
        const hotspot = new THREE.Mesh(geometry, material);
        hotspot.position.set(
          hotspotConfig.x || 0,
          hotspotConfig.y || 0,
          hotspotConfig.z || 0
        );
        hotspot.userData = {
          isHotspot: true,
          label: hotspotConfig.label || '',
          description: hotspotConfig.description || ''
        };
        
        if (this.model) {
          this.model.add(hotspot);
          this.hotspots.push(hotspot);
        }
      });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Resize handler
      window.addEventListener('resize', () => this.onResize());

      // Mouse move for raycasting
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('click', (e) => this.onClick(e));

      // Touch support
      this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });

      // Interaction state
      if (this.controls) {
        this.controls.addEventListener('start', () => {
          this.isInteracting = true;
          this.controls.autoRotate = false;
        });

        this.controls.addEventListener('end', () => {
          setTimeout(() => {
            this.isInteracting = false;
            this.controls.autoRotate = this.options.autoRotate;
          }, 2000);
        });
      }

      // Scroll zoom
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * 0.01;
        this.camera.position.z += delta;
        this.camera.position.z = Math.max(
          this.controls.minDistance,
          Math.min(this.controls.maxDistance, this.camera.position.z)
        );
      }, { passive: false });
    }

    /**
     * Handle resize
     */
    onResize() {
      if (!this.canvas || !this.camera || !this.renderer) return;

      const width = this.canvas.offsetWidth;
      const height = this.canvas.offsetHeight;

      if (width === 0 || height === 0) return;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    /**
     * Handle mouse move for raycasting
     * @param {MouseEvent} e 
     */
    onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.checkHotspotHover();
    }

    /**
     * Handle click for hotspot interaction
     * @param {MouseEvent} e 
     */
    onClick(e) {
      this.raycastHotspots();
    }

    /**
     * Handle touch start
     * @param {TouchEvent} e 
     */
    onTouchStart(e) {
      if (e.touches.length === 1) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
      }
    }

    /**
     * Handle touch move
     * @param {TouchEvent} e 
     */
    onTouchMove(e) {
      // Pinch to zoom
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        // Simple zoom based on pinch distance
        const zoomDelta = (distance - (this.lastPinchDistance || distance)) * 0.01;
        this.camera.position.z -= zoomDelta;
        this.camera.position.z = Math.max(
          this.controls.minDistance,
          Math.min(this.controls.maxDistance, this.camera.position.z)
        );
        
        this.lastPinchDistance = distance;
      }
    }

    /**
     * Check hotspot hover
     */
    checkHotspotHover() {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.hotspots);

      this.canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'default';

      // Show/hide tooltips
      this.hotspots.forEach((hotspot, index) => {
        const element = document.getElementById(`hotspot-${index}`);
        if (element) {
          element.style.opacity = intersects.some(i => i.object === hotspot) ? '1' : '0';
        }
      });
    }

    /**
     * Raycast for hotspot clicks
     */
    raycastHotspots() {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.hotspots);

      if (intersects.length > 0) {
        const hotspot = intersects[0].object;
        if (hotspot.userData.isHotspot) {
          this.onHotspotClick(hotspot.userData);
        }
      }
    }

    /**
     * Handle hotspot click
     * @param {Object} data 
     */
    onHotspotClick(data) {
      console.log('Hotspot clicked:', data);
      
      // Dispatch custom event
      const event = new CustomEvent('hotspot:click', {
        detail: data
      });
      window.dispatchEvent(event);
    }

    /**
     * Update model color
     * @param {string} colorHex 
     */
    setModelColor(colorHex) {
      if (!this.model) return;

      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.color.set(colorHex);
            });
          } else {
            child.material.color.set(colorHex);
          }
        }
      });
    }

    /**
     * Animation loop
     */
    animate() {
      this.animationId = requestAnimationFrame(() => this.animate());

      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Cap at 60fps
      if (delta > 1 / 60) return;

      // Idle float animation
      if (this.model && !this.isInteracting) {
        this.model.position.y = Math.sin(elapsed * 1.5) * 0.02;
      }

      if (this.controls) {
        this.controls.update();
      }

      this.renderer.render(this.scene, this.camera);
    }

    /**
     * Pause rendering
     */
    pause() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }

    /**
     * Resume rendering
     */
    resume() {
      this.clock.start();
      this.animate();
    }

    /**
     * Cleanup resources
     */
    dispose() {
      this.pause();

      if (this.controls) {
        this.controls.dispose();
      }

      if (this.model) {
        ThreeConfig.disposeObject(this.model);
        this.scene.remove(this.model);
      }

      if (this.renderer) {
        this.renderer.dispose();
      }

      if (this.scene) {
        while (this.scene.children.length > 0) {
          this.scene.remove(this.scene.children[0]);
        }
      }
    }
  }

  // Export
  window.SneakerViewer = SneakerViewer;
})();
