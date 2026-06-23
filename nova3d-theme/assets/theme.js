/* ============================================
   NOVA3D Theme - Main JavaScript
   Premium 3D Clothing Brand Theme
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const config = {
    particles: {
      enabled: true,
      count: 200,
      color: '#00f5ff',
      lineColor: 'rgba(0, 245, 255, 0.2)',
      connectionDistance: 150,
      mouseRadius: 200
    },
    threeD: {
      enabled: true
    },
    cursor: {
      enabled: true
    },
    cart: {
      drawerEnabled: true
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================
  // CUSTOM CURSOR
  // ============================================
  class CustomCursor {
    constructor() {
      if (prefersReducedMotion || !config.cursor.enabled || 'ontouchstart' in window) {
        document.body.classList.add('cursor-default');
        return;
      }

      this.cursor = document.createElement('div');
      this.cursor.className = 'custom-cursor';
      
      this.dot = document.createElement('div');
      this.dot.className = 'custom-cursor-dot';
      
      document.body.appendChild(this.cursor);
      document.body.appendChild(this.dot);

      this.mouseX = 0;
      this.mouseY = 0;
      this.cursorX = 0;
      this.cursorY = 0;
      this.dotX = 0;
      this.dotY = 0;

      this.init();
    }

    init() {
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });

      // Hover effect on interactive elements
      const hoverElements = document.querySelectorAll('a, button, input, textarea, .product-card, [role="button"]');
      hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => this.cursor.classList.add('hovered'));
        el.addEventListener('mouseleave', () => this.cursor.classList.remove('hovered'));
      });

      this.animate();
    }

    animate() {
      // Smooth follow with lerp
      this.cursorX += (this.mouseX - this.cursorX) * 0.15;
      this.cursorY += (this.mouseY - this.cursorY) * 0.15;
      this.dotX += (this.mouseX - this.dotX) * 0.3;
      this.dotY += (this.mouseY - this.dotY) * 0.3;

      this.cursor.style.left = this.cursorX + 'px';
      this.cursor.style.top = this.cursorY + 'px';
      this.dot.style.left = this.dotX + 'px';
      this.dot.style.top = this.dotY + 'px';

      requestAnimationFrame(() => this.animate());
    }
  }

  // ============================================
  // PARTICLE SYSTEM
  // ============================================
  class ParticleSystem {
    constructor() {
      if (prefersReducedMotion || !config.particles.enabled) return;

      this.canvas = document.getElementById('particles-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.mouseX = 0;
      this.mouseY = 0;

      this.resize();
      this.init();
      this.animate();

      window.addEventListener('resize', () => this.resize());
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    init() {
      for (let i = 0; i < config.particles.count; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1
        });
      }
    }

    animate() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Update and draw particles
      this.particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

        // Mouse interaction
        const dx = this.mouseX - p.x;
        const dy = this.mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < config.particles.mouseRadius) {
          const force = (config.particles.mouseRadius - dist) / config.particles.mouseRadius;
          p.vx -= (dx / dist) * force * 0.02;
          p.vy -= (dy / dist) * force * 0.02;
        }

        // Draw particle
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = config.particles.color;
        this.ctx.fill();

        // Draw connections
        for (let j = i + 1; j < this.particles.length; j++) {
          const p2 = this.particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < config.particles.connectionDistance) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.strokeStyle = config.particles.lineColor;
            this.ctx.lineWidth = 1 - dist2 / config.particles.connectionDistance;
            this.ctx.stroke();
          }
        }
      });

      requestAnimationFrame(() => this.animate());
    }
  }

  // ============================================
  // THREE.JS HERO ANIMATION
  // ============================================
  class HeroThreeJS {
    constructor() {
      if (prefersReducedMotion || !config.threeD.enabled) return;

      this.container = document.querySelector('.hero__canvas');
      if (!this.container) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.mesh = null;
      this.time = 0;

      this.init();
      this.animate();

      window.addEventListener('resize', () => this.onResize());
    }

    init() {
      // Scene
      this.scene = new THREE.Scene();

      // Camera
      this.camera = new THREE.PerspectiveCamera(
        75,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        1000
      );
      this.camera.position.z = 5;

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true 
      });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);

      // Create cloth-like mesh using PlaneGeometry with custom shader
      const geometry = new THREE.PlaneGeometry(8, 6, 64, 64);
      
      // Store original positions for animation
      this.originalPositions = geometry.attributes.position.array.slice();

      const material = new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });

      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0x00f5ff, 1);
      pointLight1.position.set(5, 5, 5);
      this.scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xbf00ff, 1);
      pointLight2.position.set(-5, -5, 5);
      this.scene.add(pointLight2);

      // Mouse tracking for light movement
      document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        pointLight1.position.x = x * 5;
        pointLight1.position.y = y * 5;
      });
    }

    animate() {
      requestAnimationFrame(() => this.animate());

      this.time += 0.01;

      if (this.mesh) {
        // Rotate mesh
        this.mesh.rotation.z += 0.002;

        // Wave animation on vertices
        const positions = this.mesh.geometry.attributes.position;
        const originals = this.originalPositions;

        for (let i = 0; i < positions.count; i++) {
          const x = originals[i * 3];
          const y = originals[i * 3 + 1];
          
          // Create wave effect
          const z = Math.sin(x * 2 + this.time) * Math.cos(y * 2 + this.time) * 0.5;
          
          positions.setZ(i, z);
        }

        positions.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);
    }

    onResize() {
      if (!this.camera || !this.renderer) return;

      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  // ============================================
  // 3D PRODUCT SHOWCASE
  // ============================================
  class ProductShowcase3D {
    constructor() {
      if (prefersReducedMotion || !config.threeD.enabled) return;

      this.container = document.querySelector('.product-showcase__canvas');
      if (!this.container) return;

      this.init();
      this.animate();

      window.addEventListener('resize', () => this.onResize());
    }

    init() {
      this.scene = new THREE.Scene();
      
      this.camera = new THREE.PerspectiveCamera(
        75,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        1000
      );
      this.camera.position.z = 8;

      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true 
      });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);

      // Create orbiting clothing items (represented as geometric shapes)
      this.items = [];
      
      const geometries = [
        new THREE.TorusKnotGeometry(1, 0.3, 128, 32),
        new THREE.IcosahedronGeometry(1.2, 1),
        new THREE.OctahedronGeometry(1.2, 1)
      ];

      const colors = [0x00f5ff, 0xbf00ff, 0xff0080];

      geometries.forEach((geo, i) => {
        const material = new THREE.MeshStandardMaterial({
          color: colors[i],
          metalness: 0.8,
          roughness: 0.2,
          wireframe: true
        });

        const mesh = new THREE.Mesh(geo, material);
        mesh.angle = (i / geometries.length) * Math.PI * 2;
        mesh.radius = 3;
        mesh.speed = 0.5 + i * 0.2;
        
        this.items.push(mesh);
        this.scene.add(mesh);
      });

      // Central glow
      const glowGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.8
      });
      this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
      this.scene.add(this.glow);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(ambientLight);

      this.pointLight = new THREE.PointLight(0xffffff, 1);
      this.pointLight.position.set(5, 5, 5);
      this.scene.add(this.pointLight);

      // Mouse tracking
      document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 10 - 5;
        const y = -(e.clientY / window.innerHeight) * 10 + 5;
        this.pointLight.position.x = x;
        this.pointLight.position.y = y;
      });
    }

    animate() {
      requestAnimationFrame(() => this.animate());

      const time = Date.now() * 0.001;

      this.items.forEach((item, i) => {
        item.angle += item.speed * 0.01;
        item.position.x = Math.cos(item.angle) * item.radius;
        item.position.z = Math.sin(item.angle) * item.radius;
        item.position.y = Math.sin(time + i) * 0.5;
        
        item.rotation.x += 0.01;
        item.rotation.y += 0.01;
      });

      this.glow.rotation.y += 0.02;

      this.renderer.render(this.scene, this.camera);
    }

    onResize() {
      if (!this.camera || !this.renderer) return;

      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  // ============================================
  // 3D TILT EFFECT ON CARDS
  // ============================================
  class TiltEffect {
    constructor() {
      if (prefersReducedMotion || !config.threeD.enabled || 'ontouchstart' in window) return;

      this.cards = document.querySelectorAll('.tilt-card, .product-card');
      this.cards.forEach(card => this.initCard(card));
    }

    initCard(card) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.setProperty('--tilt-x', rotateY + 'deg');
        card.style.setProperty('--tilt-y', rotateX + 'deg');
      });

      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    }
  }

  // ============================================
  // CART DRAWER
  // ============================================
  class CartDrawer {
    constructor() {
      this.drawer = document.querySelector('.cart-drawer');
      this.overlay = document.querySelector('.cart-overlay');
      this.openBtns = document.querySelectorAll('[data-cart-open]');
      this.closeBtn = document.querySelector('[data-cart-close]');

      if (!this.drawer) return;

      this.init();
    }

    init() {
      this.openBtns.forEach(btn => {
        btn.addEventListener('click', () => this.open());
      });

      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }

      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.close());
      }

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });
    }

    open() {
      this.drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // MOBILE MENU
  // ============================================
  class MobileMenu {
    constructor() {
      this.toggle = document.querySelector('.menu-toggle');
      this.menu = document.querySelector('.mobile-menu');
      this.overlay = document.querySelector('.mobile-menu__overlay');
      this.links = document.querySelectorAll('.mobile-menu__link');

      if (!this.toggle) return;

      this.init();
    }

    init() {
      this.toggle.addEventListener('click', () => this.toggleMenu());

      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.close());
      }

      this.links.forEach(link => {
        link.addEventListener('click', () => this.close());
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });
    }

    toggleMenu() {
      this.toggle.classList.toggle('active');
      this.menu.classList.toggle('active');
      document.body.style.overflow = this.menu.classList.contains('active') ? 'hidden' : '';
    }

    close() {
      this.toggle.classList.remove('active');
      this.menu.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // STICKY HEADER
  // ============================================
  class StickyHeader {
    constructor() {
      this.header = document.querySelector('.header');
      if (!this.header) return;

      this.lastScroll = 0;
      this.init();
    }

    init() {
      window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
          this.header.classList.add('header--scrolled');
        } else {
          this.header.classList.remove('header--scrolled');
        }

        this.lastScroll = currentScroll;
      });
    }
  }

  // ============================================
  // BACK TO TOP BUTTON
  // ============================================
  class BackToTop {
    constructor() {
      this.button = document.querySelector('.back-to-top');
      if (!this.button) return;

      this.init();
    }

    init() {
      window.addEventListener('scroll', () => {
        if (window.pageYOffset > 500) {
          this.button.classList.add('visible');
        } else {
          this.button.classList.remove('visible');
        }
      });

      this.button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // ============================================
  // ANNOUNCEMENT BAR MARQUEE
  // ============================================
  class AnnouncementBar {
    constructor() {
      this.bar = document.querySelector('.announcement-bar');
      if (!this.bar) return;

      this.content = this.bar.querySelector('.announcement-bar__content');
      if (!this.content) return;

      // Duplicate content for seamless loop
      this.content.innerHTML += this.content.innerHTML;
    }
  }

  // ============================================
  // LAZY LOADING IMAGES
  // ============================================
  class LazyLoad {
    constructor() {
      this.images = document.querySelectorAll('img[data-src], img[srcset]');
      if (!this.images.length) return;

      this.init();
    }

    init() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '100px' });

      this.images.forEach(img => observer.observe(img));
    }

    loadImage(img) {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      
      img.addEventListener('load', () => {
        img.classList.add('loaded');
      });
    }
  }

  // ============================================
  // COLOR SWATCH SWITCHER
  // ============================================
  class ColorSwatches {
    constructor() {
      this.swatches = document.querySelectorAll('.color-swatch, .product-card__swatch');
      this.swatches.forEach(swatch => this.initSwatch(swatch));
    }

    initSwatch(swatch) {
      swatch.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active from siblings
        const parent = swatch.parentElement;
        parent.querySelectorAll('.color-swatch, .product-card__swatch').forEach(s => {
          s.classList.remove('active');
        });

        // Add active to clicked
        swatch.classList.add('active');

        // Update product image if available
        const productId = swatch.dataset.productId;
        const color = swatch.dataset.color;
        const imageId = swatch.dataset.imageId;

        if (imageId) {
          const mainImage = document.querySelector(`#product-image-${productId}`);
          if (mainImage) {
            mainImage.src = imageId;
          }
        }
      });
    }
  }

  // ============================================
  // SIZE GUIDE MODAL
  // ============================================
  class SizeGuideModal {
    constructor() {
      this.modal = document.querySelector('.modal--size-guide');
      if (!this.modal) return;

      this.triggers = document.querySelectorAll('[data-size-guide]');
      this.closeBtn = this.modal.querySelector('.modal__close');

      this.init();
    }

    init() {
      this.triggers.forEach(trigger => {
        trigger.addEventListener('click', () => this.open());
      });

      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }

      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });
    }

    open() {
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // AJAX ADD TO CART
  // ============================================
  class AjaxCart {
    constructor() {
      this.forms = document.querySelectorAll('[data-add-to-cart]');
      this.forms.forEach(form => this.initForm(form));
    }

    initForm(form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            // Success animation
            this.createParticleBurst(submitBtn);
            
            // Update cart count
            this.updateCartCount();
            
            // Open cart drawer
            const cartDrawer = new CartDrawer();
            cartDrawer.open();

            submitBtn.textContent = 'Added!';
          } else {
            throw new Error('Failed to add to cart');
          }
        } catch (error) {
          console.error('Add to cart error:', error);
          submitBtn.textContent = 'Error - Try Again';
        }

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }, 2000);
      });
    }

    createParticleBurst(element) {
      const rect = element.getBoundingClientRect();
      const burst = document.createElement('div');
      burst.className = 'particle-burst';
      burst.style.left = rect.left + rect.width / 2 + 'px';
      burst.style.top = rect.top + rect.height / 2 + 'px';
      
      document.body.appendChild(burst);

      // Create particles
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle-burst__particle';
        
        const angle = (i / 12) * Math.PI * 2;
        const distance = 50;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        burst.appendChild(particle);
      }

      setTimeout(() => burst.remove(), 600);
    }

    updateCartCount() {
      fetch('/cart.js')
        .then(res => res.json())
        .then(cart => {
          const counts = document.querySelectorAll('.header__cart-count');
          counts.forEach(count => {
            count.textContent = cart.item_count;
            count.style.transform = 'scale(1.3)';
            setTimeout(() => count.style.transform = 'scale(1)', 200);
          });
        });
    }
  }

  // ============================================
  // ACCORDION
  // ============================================
  class Accordion {
    constructor() {
      this.accordions = document.querySelectorAll('.accordion');
      this.accordions.forEach(accordion => this.initAccordion(accordion));
    }

    initAccordion(accordion) {
      const triggers = accordion.querySelectorAll('.accordion__trigger');
      
      triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
          const expanded = trigger.getAttribute('aria-expanded') === 'true';
          
          // Close all siblings
          triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
          
          // Toggle current
          trigger.setAttribute('aria-expanded', !expanded);
        });
      });
    }
  }

  // ============================================
  // COUNTDOWN TIMER
  // ============================================
  class CountdownTimer {
    constructor() {
      this.timers = document.querySelectorAll('[data-countdown]');
      this.timers.forEach(timer => this.initTimer(timer));
    }

    initTimer(timer) {
      const endDate = new Date(timer.dataset.countdown).getTime();

      const update = () => {
        const now = new Date().getTime();
        const distance = endDate - now;

        if (distance < 0) {
          timer.innerHTML = '<span class="countdown__label">Expired</span>';
          return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timer.innerHTML = `
          <div class="countdown__item">
            <div class="countdown__value">${String(days).padStart(2, '0')}</div>
            <div class="countdown__label">Days</div>
          </div>
          <div class="countdown__item">
            <div class="countdown__value">${String(hours).padStart(2, '0')}</div>
            <div class="countdown__label">Hours</div>
          </div>
          <div class="countdown__item">
            <div class="countdown__value">${String(minutes).padStart(2, '0')}</div>
            <div class="countdown__label">Mins</div>
          </div>
          <div class="countdown__item">
            <div class="countdown__value">${String(seconds).padStart(2, '0')}</div>
            <div class="countdown__label">Secs</div>
          </div>
        `;
      };

      update();
      setInterval(update, 1000);
    }
  }

  // ============================================
  // SCROLL ANIMATIONS (GSAP ScrollTrigger)
  // ============================================
  class ScrollAnimations {
    constructor() {
      if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
      if (prefersReducedMotion) return;

      this.init();
    }

    init() {
      gsap.registerPlugin(ScrollTrigger);

      // Fade up animations for sections
      const sections = document.querySelectorAll('.section, .hero__content, .product-card');
      
      sections.forEach(section => {
        gsap.fromTo(section, 
          { 
            opacity: 0, 
            y: 60 
          },
          {
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
              toggleActions: 'play none none reverse'
            },
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out'
          }
        );
      });

      // Stagger animations for grids
      const grids = document.querySelectorAll('.product-grid, .grid--cols-3, .grid--cols-4');
      
      grids.forEach(grid => {
        const children = grid.children;
        
        gsap.fromTo(children,
          {
            opacity: 0,
            y: 40
          },
          {
            scrollTrigger: {
              trigger: grid,
              start: 'top 80%'
            },
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out'
          }
        );
      });
    }
  }

  // ============================================
  // SORT DROPDOWN
  // ============================================
  class SortDropdown {
    constructor() {
      this.dropdowns = document.querySelectorAll('.sort-dropdown');
      this.dropdowns.forEach(dropdown => this.initDropdown(dropdown));
    }

    initDropdown(dropdown) {
      const trigger = dropdown.querySelector('.sort-dropdown__trigger');
      
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAll();
        dropdown.classList.toggle('active');
      });

      const options = dropdown.querySelectorAll('.sort-dropdown__option');
      options.forEach(option => {
        option.addEventListener('click', () => {
          const value = option.dataset.value;
          const url = new URL(window.location.href);
          url.searchParams.set('sort_by', value);
          window.location.href = url.toString();
        });
      });

      document.addEventListener('click', () => this.closeAll());
    }

    closeAll() {
      this.dropdowns.forEach(d => d.classList.remove('active'));
    }
  }

  // ============================================
  // PREDICTIVE SEARCH
  // ============================================
  class PredictiveSearch {
    constructor() {
      this.input = document.querySelector('[data-predictive-search]');
      if (!this.input) return;

      this.results = this.input.parentElement.querySelector('.predictive-search');
      this.timeout = null;

      this.init();
    }

    init() {
      this.input.addEventListener('input', (e) => {
        clearTimeout(this.timeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
          this.hide();
          return;
        }

        this.timeout = setTimeout(() => this.search(query), 300);
      });

      this.input.addEventListener('focus', () => {
        if (this.input.value.trim().length >= 2) {
          this.show();
        }
      });

      document.addEventListener('click', (e) => {
        if (!this.input.parentElement.contains(e.target)) {
          this.hide();
        }
      });
    }

    async search(query) {
      try {
        const response = await fetch(`/search/suggest?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=4`);
        const data = await response.json();
        
        this.render(data);
        this.show();
      } catch (error) {
        console.error('Search error:', error);
      }
    }

    render(data) {
      if (!this.results || !data.resources || !data.resources.results) return;

      const products = data.resources.results.products || [];
      
      if (products.length === 0) {
        this.results.innerHTML = '<div class="predictive-search__group"><p>No products found</p></div>';
        return;
      }

      let html = '<div class="predictive-search__results">';
      html += '<div class="predictive-search__group">';
      html += '<div class="predictive-search__group-title">Products</div>';
      
      products.forEach(product => {
        html += `
          <a href="${product.url}" class="predictive-search__item">
            <img src="${product.featured_media?.preview_image?.url || '//via.placeholder.com/50'}" 
                 alt="${product.title}" 
                 class="predictive-search__item-image">
            <div class="predictive-search__item-info">
              <div class="predictive-search__item-title">${product.title}</div>
              <div class="predictive-search__item-price">${product.price}</div>
            </div>
          </a>
        `;
      });
      
      html += '</div>';
      html += `<a href="/search?q=${encodeURIComponent(this.input.value)}" class="predictive-search__view-all">View all results</a>`;
      html += '</div>';

      this.results.innerHTML = html;
    }

    show() {
      if (this.results) this.results.classList.add('active');
    }

    hide() {
      if (this.results) this.results.classList.remove('active');
    }
  }

  // ============================================
  // INITIALIZE ALL MODULES
  // ============================================
  function init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Initialize all modules
    new CustomCursor();
    new ParticleSystem();
    new HeroThreeJS();
    new ProductShowcase3D();
    new TiltEffect();
    new CartDrawer();
    new MobileMenu();
    new StickyHeader();
    new BackToTop();
    new AnnouncementBar();
    new LazyLoad();
    new ColorSwatches();
    new SizeGuideModal();
    new AjaxCart();
    new Accordion();
    new CountdownTimer();
    new ScrollAnimations();
    new SortDropdown();
    new PredictiveSearch();

    // Page load animation
    if (!prefersReducedMotion && typeof gsap !== 'undefined') {
      gsap.from('body', {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    }
  }

  init();
})();
