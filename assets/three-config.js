/**
 * Three.js Configuration Module
 * Centralized scene setup, lighting, and environment configuration
 */

window.ThreeConfig = window.ThreeConfig || {};

(function() {
  'use strict';

  /**
   * Default configuration options
   */
  const DEFAULT_CONFIG = {
    camera: {
      fov: 45,
      near: 0.1,
      far: 100,
      position: { x: 0, y: 0, z: 5 }
    },
    renderer: {
      antialias: true,
      alpha: true,
      toneMapping: 'ACESFilmic',
      exposure: 1.2,
      shadowMap: true,
      shadowMapType: 'PCFSoftShadowMap'
    },
    lighting: {
      ambient: {
        color: 0xffffff,
        intensity: 0.4
      },
      directional: {
        color: 0xffffff,
        intensity: 1.0,
        position: { x: 5, y: 10, z: 7 },
        castShadow: true,
        shadowMapSize: 2048
      }
    },
    controls: {
      enableDamping: true,
      dampingFactor: 0.05,
      minDistance: 2,
      maxDistance: 8,
      maxPolarAngle: Math.PI / 2,
      autoRotate: false,
      autoRotateSpeed: 0.5,
      enableZoom: true,
      enablePan: false
    },
    environment: {
      usePMREM: true,
      fallbackGradient: true
    }
  };

  /**
   * Create a Three.js scene with default configuration
   * @param {Object} overrides - Override default config options
   * @returns {Object} Scene components { scene, camera, renderer, controls, lights }
   */
  function createScene(overrides) {
    const config = deepMerge(DEFAULT_CONFIG, overrides || {});

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      config.camera.aspect || (window.innerWidth / window.innerHeight),
      config.camera.near,
      config.camera.far
    );
    camera.position.set(
      config.camera.position.x,
      config.camera.position.y,
      config.camera.position.z
    );

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.renderer.antialias,
      alpha: config.renderer.alpha
    });

    if (config.size) {
      renderer.setSize(config.size.width, config.size.height);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Tone mapping
    if (config.renderer.toneMapping === 'ACESFilmic') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else if (config.renderer.toneMapping === 'Reinhard') {
      renderer.toneMapping = THREE.ReinhardToneMapping;
    } else if (config.renderer.toneMapping === 'Cineon') {
      renderer.toneMapping = THREE.CineonToneMapping;
    }

    renderer.toneMappingExposure = config.renderer.exposure;

    // Shadow map
    if (config.renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      if (config.renderer.shadowMapType === 'PCFSoftShadowMap') {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      } else if (config.renderer.shadowMapType === 'PCFShadowMap') {
        renderer.shadowMap.type = THREE.PCFShadowMap;
      } else if (config.renderer.shadowMapType === 'BasicShadowMap') {
        renderer.shadowMap.type = THREE.BasicShadowMap;
      }
    }

    // Lighting
    const lights = {};

    // Ambient light
    lights.ambient = new THREE.AmbientLight(
      config.lighting.ambient.color,
      config.lighting.ambient.intensity
    );
    scene.add(lights.ambient);

    // Directional light
    lights.directional = new THREE.DirectionalLight(
      config.lighting.directional.color,
      config.lighting.directional.intensity
    );
    lights.directional.position.set(
      config.lighting.directional.position.x,
      config.lighting.directional.position.y,
      config.lighting.directional.position.z
    );

    if (config.lighting.directional.castShadow) {
      lights.directional.castShadow = true;
      lights.directional.shadow.mapSize.width = config.lighting.directional.shadowMapSize;
      lights.directional.shadow.mapSize.height = config.lighting.directional.shadowMapSize;
    }

    scene.add(lights.directional);

    // Controls
    let controls = null;
    if (config.canvas && typeof OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, config.canvas);
      controls.enableDamping = config.controls.enableDamping;
      controls.dampingFactor = config.controls.dampingFactor;
      controls.minDistance = config.controls.minDistance;
      controls.maxDistance = config.controls.maxDistance;
      controls.maxPolarAngle = config.controls.maxPolarAngle;
      controls.autoRotate = config.controls.autoRotate;
      controls.autoRotateSpeed = config.controls.autoRotateSpeed;
      controls.enableZoom = config.controls.enableZoom;
      controls.enablePan = config.controls.enablePan;
    }

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      lights: lights,
      config: config
    };
  }

  /**
   * Setup environment map for realistic reflections
   * @param {THREE.Scene} scene 
   * @param {THREE.WebGLRenderer} renderer 
   * @param {string} envUrl - URL to HDR/EXR environment map
   */
  function setupEnvironment(scene, renderer, envUrl) {
    if (!envUrl) {
      // Fallback gradient environment
      if (DEFAULT_CONFIG.environment.fallbackGradient) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 512, 256);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = new THREE.Color(0x0a0a0a);
      }
      return;
    }

    // Load HDR environment map with PMREM
    if (DEFAULT_CONFIG.environment.usePMREM && typeof THREE.PMREMGenerator !== 'undefined') {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      new THREE.TextureLoader().load(envUrl, function(texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        pmremGenerator.dispose();
      });
    }
  }

  /**
   * Create procedural sneaker model as fallback
   * @returns {THREE.Group}
   */
  function createProceduralSneaker() {
    const group = new THREE.Group();

    // Main body
    const bodyGeo = new THREE.BoxGeometry(1.5, 0.5, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x333333, 
      roughness: 0.3, 
      metalness: 0.1 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Sole
    const soleGeo = new THREE.BoxGeometry(1.6, 0.2, 3.2);
    const soleMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      roughness: 0.8 
    });
    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.y = -0.35;
    sole.castShadow = true;
    group.add(sole);

    // Toe cap
    const toeGeo = new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const toeMat = new THREE.MeshStandardMaterial({ 
      color: 0x222222, 
      roughness: 0.2 
    });
    const toe = new THREE.Mesh(toeGeo, toeMat);
    toe.position.set(0, 0, 1.5);
    toe.rotation.x = Math.PI;
    toe.scale.z = 0.5;
    toe.castShadow = true;
    group.add(toe);

    // Heel
    const heelGeo = new THREE.CylinderGeometry(0.6, 0.8, 0.5, 32);
    const heelMat = new THREE.MeshStandardMaterial({ 
      color: 0x444444, 
      roughness: 0.3 
    });
    const heel = new THREE.Mesh(heelGeo, heelMat);
    heel.position.set(0, 0, -1.5);
    heel.castShadow = true;
    group.add(heel);

    return group;
  }

  /**
   * Auto-center and position a model
   * @param {THREE.Object3D} model 
   * @param {number} scale - Uniform scale factor
   */
  function centerModel(model, scale) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    
    model.position.sub(center);
    model.position.y = box.min.y * -1;
    
    if (scale) {
      model.scale.set(scale, scale, scale);
    }

    // Enable shadows on all meshes
    model.traverse(function(child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Setup DRACO loader for compressed GLTF models
   * @param {THREE.GLTFLoader} loader
   */
  function setupDRACOLoader(loader) {
    if (typeof THREE.DRACOLoader !== 'undefined') {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      loader.setDRACOLoader(dracoLoader);
    }
  }

  /**
   * Deep merge objects
   * @param {Object} target 
   * @param {Object} source 
   * @returns {Object}
   */
  function deepMerge(target, source) {
    const output = Object.assign({}, target);
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(function(key) {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is an object
   * @param {*} value 
   * @returns {boolean}
   */
  function isObject(value) {
    return value && typeof value === 'object' && value.constructor === Object;
  }

  /**
   * Dispose Three.js resources to prevent memory leaks
   * @param {THREE.Object3D} object 
   */
  function disposeObject(object) {
    if (!object) return;
    
    object.traverse(function(child) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(mat) {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    });
  }

  /**
   * Dispose material and its textures
   * @param {THREE.Material} material 
   */
  function disposeMaterial(material) {
    if (!material) return;
    
    Object.keys(material).forEach(function(key) {
      const value = material[key];
      if (value && typeof value === 'object' && value.type) {
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
    });
    material.dispose();
  }

  // Export public API
  window.ThreeConfig = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    createScene: createScene,
    setupEnvironment: setupEnvironment,
    createProceduralSneaker: createProceduralSneaker,
    centerModel: centerModel,
    setupDRACOLoader: setupDRACOLoader,
    disposeObject: disposeObject,
    disposeMaterial: disposeMaterial
  };
})();
