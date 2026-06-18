/**
 * Customizer Module
 * Colorway switcher, material toggles, and variant handling
 */

window.SneakerCustomizer = window.SneakerCustomizer || {};

(function() {
  'use strict';

  /**
   * SneakerCustomizer Class
   * Handles product customization UI and 3D model updates
   */
  class SneakerCustomizer {
    constructor(options) {
      this.options = Object.assign({
        viewer: null,
        productData: null,
        colorSwatchSelector: '.product-3d__swatch',
        sizeButtonSelector: '.product-3d__size-btn',
        addToCartForm: null,
        priceElement: null
      }, options || {});

      this.viewer = this.options.viewer;
      this.productData = this.options.productData || {};
      this.currentVariant = null;
      thiscurrentColorways = [];

      this.init();
    }

    /**
     * Initialize customizer
     */
    init() {
      this.setupColorSwatches();
      this.setupSizeSelector();
      this.setupVariantHandling();
    }

    /**
     * Setup color swatch buttons
     */
    setupColorSwatches() {
      const swatches = document.querySelectorAll(this.options.colorSwatchSelector);
      
      swatches.forEach((swatch) => {
        swatch.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Update active state
          swatches.forEach((s) => s.classList.remove('active'));
          swatch.classList.add('active');
          
          // Get color value
          const color = swatch.dataset.color || '#333333';
          const value = swatch.dataset.value;
          
          // Update 3D model
          if (this.viewer && typeof this.viewer.setModelColor === 'function') {
            this.viewer.setModelColor(color);
          }
          
          // Update variant if applicable
          this.selectVariantByOption('color', value);
        });
      });
    }

    /**
     * Setup size selector buttons
     */
    setupSizeSelector() {
      const sizeBtns = document.querySelectorAll(this.options.sizeButtonSelector);
      
      sizeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Update active state
          sizeBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Get size value
          const value = btn.dataset.value;
          
          // Update variant
          this.selectVariantByOption('size', value);
        });
      });
    }

    /**
     * Setup variant handling
     */
    setupVariantHandling() {
      if (!this.productData || !this.productData.variants) return;
      
      // Set initial variant
      this.currentVariant = this.productData.selected_or_first_available_variant;
      
      // Update price display
      this.updatePriceDisplay();
    }

    /**
     * Select variant by option
     * @param {string} optionType - 'color' or 'size'
     * @param {string} value - Option value
     */
    selectVariantByOption(optionType, value) {
      if (!this.productData || !this.productData.variants) return;
      
      // Find matching variant
      const variant = this.productData.variants.find((v) => {
        if (optionType === 'color') {
          return v.option1 === value || v.option2 === value || v.option3 === value;
        } else if (optionType === 'size') {
          return v.option1 === value || v.option2 === value || v.option3 === value;
        }
        return false;
      });
      
      if (variant) {
        this.currentVariant = variant;
        this.updateFormVariantId(variant.id);
        this.updatePriceDisplay();
        this.updateAvailability(variant.available);
        
        // Update model color from variant metafield if available
        if (variant.metafields && variant.metafields.custom && variant.metafields.custom.color_hex) {
          if (this.viewer && typeof this.viewer.setModelColor === 'function') {
            this.viewer.setModelColor(variant.metafields.custom.color_hex);
          }
        }
      }
    }

    /**
     * Update hidden form input with variant ID
     * @param {number} variantId 
     */
    updateFormVariantId(variantId) {
      const form = document.querySelector('form[action*="/cart/add"]');
      if (form) {
        const input = form.querySelector('input[name="id"]');
        if (input) {
          input.value = variantId;
        }
      }
    }

    /**
     * Update price display
     */
    updatePriceDisplay() {
      if (!this.currentVariant || !this.options.priceElement) return;
      
      const priceElement = this.options.priceElement;
      
      if (this.currentVariant.compare_at_price) {
        // On sale
        priceElement.innerHTML = `
          <span class="compare-price" style="text-decoration: line-through; opacity: 0.6;">
            ${this.formatMoney(this.currentVariant.compare_at_price)}
          </span>
          <span class="sale-price">${this.formatMoney(this.currentVariant.price)}</span>
        `;
      } else {
        priceElement.textContent = this.formatMoney(this.currentVariant.price);
      }
    }

    /**
     * Update availability status
     * @param {boolean} available 
     */
    updateAvailability(available) {
      const addToCartBtn = document.querySelector('.product-3d__add-to-cart');
      
      if (addToCartBtn) {
        if (available) {
          addToCartBtn.disabled = false;
          addToCartBtn.textContent = 'Add to Cart';
        } else {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'Sold Out';
        }
      }
    }

    /**
     * Format money amount
     * @param {number} amount - Amount in cents
     * @returns {string}
     */
    formatMoney(amount) {
      const currency = this.productData.currency || 'USD';
      const amountInDollars = amount / 100;
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amountInDollars);
    }

    /**
     * Add product to cart via AJAX
     * @param {number} quantity 
     * @returns {Promise}
     */
    addToCart(quantity = 1) {
      if (!this.currentVariant) {
        console.error('No variant selected');
        return Promise.reject(new Error('No variant selected'));
      }
      
      return fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          id: this.currentVariant.id,
          quantity: quantity,
          sections: document.querySelectorAll('[id^="cart-icon-bubble"]').length > 0 ? ['cart-icon-bubble'] : [],
          sections_url: window.location.pathname
        })
      })
      .then((response) => response.json())
      .then((data) => {
        // Dispatch custom event for cart update
        window.dispatchEvent(new CustomEvent('cart:update', { detail: data }));
        return data;
      })
      .catch((error) => {
        console.error('Add to cart error:', error);
        throw error;
      });
    }

    /**
     * Update model material properties
     * @param {string} materialType - 'roughness', 'metalness', etc.
     * @param {number} value 
     */
    updateMaterialProperty(materialType, value) {
      if (!this.viewer || !this.viewer.model) return;
      
      this.viewer.model.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (materialType in mat) {
                mat[materialType] = value;
              }
            });
          } else {
            if (materialType in child.material) {
              child.material[materialType] = value;
            }
          }
        }
      });
    }

    /**
     * Reset customizer to default state
     */
    reset() {
      // Reset swatches
      const swatches = document.querySelectorAll(this.options.colorSwatchSelector);
      if (swatches.length > 0) {
        swatches[0].click();
      }
      
      // Reset sizes
      const sizeBtns = document.querySelectorAll(this.options.sizeButtonSelector);
      if (sizeBtns.length > 0) {
        sizeBtns[0].click();
      }
    }

    /**
     * Export current configuration
     * @returns {Object}
     */
    exportConfig() {
      return {
        variant: this.currentVariant,
        color: this.currentVariant ? this.currentVariant.option1 : null,
        size: this.currentVariant ? (this.currentVariant.option2 || this.currentVariant.option1) : null,
        price: this.currentVariant ? this.currentVariant.price : null
      };
    }
  }

  // Export
  window.SneakerCustomizer = SneakerCustomizer;

  /**
   * Auto-initialize when DOM is ready
   */
  document.addEventListener('DOMContentLoaded', function() {
    const productSection = document.getElementById('product-3d-section');
    if (!productSection) return;
    
    const productData = JSON.parse(productSection.dataset.product || '{}');
    
    // Initialize customizer if viewer exists
    const customizer = new SneakerCustomizer({
      productData: productData,
      priceElement: document.getElementById('product-price')
    });
    
    // Store reference globally
    window.sneakerCustomizer = customizer;
  });
})();
