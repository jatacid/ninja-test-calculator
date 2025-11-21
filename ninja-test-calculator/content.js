// Content Script for Ninja Test Calculator
// Handles OCR-based number capture via click & drag selection

class OCRProcessor {
  constructor() {
    this.isInitialized = false;
    this.currentFrame = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Create sandboxed iframe for OCR processing
    this.currentFrame = document.createElement('iframe');
    this.currentFrame.src = chrome.runtime.getURL('tesseract/inject/sandbox.html');
    this.currentFrame.style.cssText = `
      position: fixed;
      width: 0;
      height: 0;
      border: none;
      z-index: -1;
      opacity: 0;
      pointer-events: none;
    `;

    document.documentElement.appendChild(this.currentFrame);

    // Wait for frame to load
    await new Promise(resolve => {
      this.currentFrame.onload = resolve;
    });

    this.isInitialized = true;
  }

  async preload() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Preload the OCR worker to avoid first-run delay
    return new Promise((resolve, reject) => {
      const messageId = 'preload-' + Math.random();

      const handleMessage = (event) => {
        if (event.data && event.data.id === messageId) {
          window.removeEventListener('message', handleMessage);

          if (event.data.type === 'PRELOAD_ERROR') {
            reject(new Error(event.data.error));
          } else if (event.data.type === 'PRELOAD_SUCCESS') {
            resolve();
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Send preload request to sandboxed frame
      this.currentFrame.contentWindow.postMessage({
        id: messageId,
        type: 'PRELOAD_OCR'
      }, '*');

      // Timeout after 10 seconds if preload takes too long
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Preload timeout'));
      }, 10000);
    });
  }

  async processScreenshot(imageData, region) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const messageId = 'ocr-' + Math.random();
      
      const handleMessage = (event) => {
        if (event.data && event.data.id === messageId) {
          window.removeEventListener('message', handleMessage);
          
          if (event.data.type === 'OCR_ERROR') {
            reject(new Error(event.data.error));
          } else if (event.data.type === 'OCR_RESULT') {
            resolve(event.data.result);
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Send OCR request to sandboxed frame
      this.currentFrame.contentWindow.postMessage({
        id: messageId,
        type: 'OCR_REQUEST',
        imageData: imageData,
        region: region
      }, '*');
    });
  }

  cleanup() {
    if (this.currentFrame) {
      this.currentFrame.remove();
      this.currentFrame = null;
    }
    this.isInitialized = false;
  }
}

class NumberCapture {
  constructor() {
    this.isActive = false;

    // Screenshot overlay state
    this.screenshotOverlay = null;
    this.screenshotImage = null;
    this.darkOverlay = null;
    this.selectionOverlay = null;
    this.screenshotDataUrl = null;

    // Selection state
    this.isSelecting = false;
    this.selectionStart = { x: 0, y: 0 };
    this.selectionEnd = { x: 0, y: 0 };

    // Legacy modal state (for cleanup)
    this.screenshotModal = null;
    this.crosshairOverlay = null;
    this.isSelectingFromModal = false;
    this.modalSelectionStart = { x: 0, y: 0 };
    this.modalSelectionEnd = { x: 0, y: 0 };
    this.modalSelectionBox = null;
    
    this.boundKeyHandler = this.handleKeyPress.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    
    // Initialize OCR processor
    this.ocrProcessor = new OCRProcessor();
    
    // Listen for messages from side panel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        switch (message.type) {
          case 'START_CAPTURE':
            this.startCapture();
            sendResponse({ success: true });
            break;

          case 'STOP_CAPTURE':
            this.stopCapture();
            sendResponse({ success: true });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
        }
      } catch (error) {
        console.error('Content: Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });
  }

  async startCapture() {
    this.isActive = true;

    // Clean up any existing overlays from previous captures
    const existingOverlay = document.getElementById('ninja-screenshot-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const existingProcessing = document.getElementById('ninja-processing-overlay');
    if (existingProcessing) {
      existingProcessing.remove();
    }

    try {
      // Take screenshot immediately
      const dataUrl = await this.captureScreenshot();

      // Show screenshot as overlay
      this.showScreenshotOverlay(dataUrl);

      this.removeEventListeners(); // Clean up any existing listeners first
      this.attachOverlayEventListeners();

      // Start OCR worker preload in the background
      // This will prepare the expensive Tesseract worker while user makes their selection
      this.ocrProcessor.preload().catch(error => {
        // Silent failure - OCR will still work on first use
      });

    } catch (error) {
      console.error('Content: Error starting capture:', error);
      this.stopCapture();
    }
  }

  stopCapture() {
    if (!this.isActive) return;

    this.isActive = false;
    this.isSelecting = false;
    this.removeEventListeners();
    this.removeCaptureStyles();
    this.removeSelectionOverlay();
    this.removeLoadingOverlay();
    this.removeScreenshotOverlay();
    // Note: Don't remove debug crop here - let it run independently
  }





  attachEventListeners() {
    document.addEventListener('keydown', this.boundKeyHandler, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
  }

  removeEventListeners() {
    document.removeEventListener('keydown', this.boundKeyHandler, true);
    document.removeEventListener('mousemove', this.boundMouseMove, true);
    document.removeEventListener('mousedown', this.boundMouseDown, true);
    document.removeEventListener('mouseup', this.boundMouseUp, true);
  }

  attachModalEventListeners() {
    document.addEventListener('keydown', this.boundKeyHandler, true);
    document.addEventListener('mousemove', this.boundModalMouseMove, true);
    document.addEventListener('mousedown', this.boundModalMouseDown, true);
    document.addEventListener('mouseup', this.boundModalMouseUp, true);
  }

  attachOverlayEventListeners() {
    document.addEventListener('keydown', this.boundKeyHandler, true);
    // Note: Mouse events are attached directly to the overlay element
  }

  boundOverlayMouseMove = this.handleOverlayMouseMove.bind(this);
  boundOverlayMouseDown = this.handleOverlayMouseDown.bind(this);
  boundOverlayMouseUp = this.handleOverlayMouseUp.bind(this);

  // Arrow function versions that preserve context
  boundOverlayMouseMoveArrow = (event) => this.handleOverlayMouseMove(event);
  boundOverlayMouseDownArrow = (event) => this.handleOverlayMouseDown(event);
  boundOverlayMouseUpArrow = (event) => this.handleOverlayMouseUp(event);

  handleMouseMove(event) {
    if (!this.isActive) return;
    
    // Update selection rectangle if dragging
    if (this.isSelecting) {
      this.selectionEnd.x = event.clientX;
      this.selectionEnd.y = event.clientY;
      this.updateSelectionOverlay();
    }
  }

  handleMouseDown(event) {
    if (!this.isActive) return;
    
    // Start selection
    this.isSelecting = true;
    this.selectionStart.x = event.clientX;
    this.selectionStart.y = event.clientY;
    this.selectionEnd.x = event.clientX;
    this.selectionEnd.y = event.clientY;
    
    this.createSelectionOverlay();
    event.preventDefault();
  }

  async handleMouseUp(event) {
    if (!this.isActive || !this.isSelecting) return;
    
    this.isSelecting = false;
    
    // Calculate selection dimensions
    const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
    
    // Only process if selection is large enough (at least 10x10 pixels)
    if (width > 10 && height > 10) {
      this.removeSelectionOverlay();
      await this.processOCRSelection(left, top, width, height);
    } else {
      this.removeSelectionOverlay();
    }
    
    event.preventDefault();
  }

  handleKeyPress(event) {
    if (!this.isActive) return;

    // Only handle ESC if we're not in an input field or if the event target is the document/body
    const target = event.target;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

    if (event.key === 'Escape' && !isInputField) {
      // Remove overlays if they exist
      this.removeProcessingOverlay();
      this.removeDebugCrop();
      // Send message to sidepanel to stop capture there too
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
      // Escape ends the capture locally
      this.stopCapture();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  applyCaptureStyles() {
    if (!document.getElementById('ninja-capture-styles')) {
      const style = document.createElement('style');
      style.id = 'ninja-capture-styles';
      style.textContent = `
        .ninja-capture-active { cursor: crosshair !important; }
        .ninja-capture-active * { cursor: crosshair !important; }
      `;
      document.head.appendChild(style);
    }
    document.body.classList.add('ninja-capture-active');
  }

  removeCaptureStyles() {
    document.body.classList.remove('ninja-capture-active');
    const style = document.getElementById('ninja-capture-styles');
    if (style) {
      style.remove();
    }
  }

  createSelectionOverlay() {
    // Create a selection rectangle for visual feedback
    this.selectionOverlay = document.createElement('div');
    this.selectionOverlay.id = 'ninja-selection-overlay';
    this.selectionOverlay.style.cssText = `
      position: fixed;
      border: 2px solid #fff;
      background: transparent;
      z-index: 3;
      pointer-events: none;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
    `;

    this.screenshotOverlay.appendChild(this.selectionOverlay);
    this.updateSelectionOverlay();
  }

  updateSelectionOverlay() {
    if (!this.selectionOverlay || !this.frameTop) return;

    const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

    // Position the selection rectangle
    this.selectionOverlay.style.left = `${left}px`;
    this.selectionOverlay.style.top = `${top}px`;
    this.selectionOverlay.style.width = `${Math.max(1, width)}px`;
    this.selectionOverlay.style.height = `${Math.max(1, height)}px`;

    // Update frame overlays to create hole around selection
    this.frameTop.style.height = `${top}px`;
    this.frameBottom.style.top = `${top + height}px`;
    this.frameBottom.style.height = `calc(100vh - ${top + height}px)`;
    this.frameBottom.style.left = '0';
    this.frameBottom.style.width = '100vw';
    this.frameLeft.style.top = `${top}px`;
    this.frameLeft.style.height = `${height}px`;
    this.frameLeft.style.width = `${left}px`;
    this.frameRight.style.top = `${top}px`;
    this.frameRight.style.height = `${height}px`;
    this.frameRight.style.left = `${left + width}px`;
    this.frameRight.style.width = `calc(100vw - ${left + width}px)`;
  }

  removeSelectionOverlay() {
    if (this.selectionOverlay) {
      this.selectionOverlay.remove();
      this.selectionOverlay = null;
    }

    // Reset frame overlays to cover the entire screen
    if (this.frameTop) {
      this.frameTop.style.height = '100vh';
    }
    if (this.frameBottom) {
      this.frameBottom.style.top = '0';
      this.frameBottom.style.height = '0';
      this.frameBottom.style.left = '0';
    }
    if (this.frameLeft) {
      this.frameLeft.style.top = '0';
      this.frameLeft.style.height = '100vh';
      this.frameLeft.style.width = '100vw';
    }
    if (this.frameRight) {
      this.frameRight.style.top = '0';
      this.frameRight.style.height = '0';
      this.frameRight.style.width = '0';
      this.frameRight.style.left = '0';
    }
  }

  showLoadingOverlay() {
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.id = 'ninja-loading-overlay';
    this.loadingOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 20px 30px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      z-index: 1000003;
      display: flex;
      align-items: center;
      gap: 15px;
    `;
    
    this.loadingOverlay.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top: 3px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>Reading numbers from selected area...</span>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.documentElement.appendChild(this.loadingOverlay);
  }

  removeLoadingOverlay() {
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }
  }



  async processOCRSelection(left, top, width, height) {
    try {
      this.showLoadingOverlay();

      // Capture screenshot and get dimensions
      const dataUrl = await this.captureScreenshot();
      const tempImg = new Image();
      await new Promise(resolve => {
        tempImg.onload = resolve;
        tempImg.src = dataUrl;
      });

      const screenshotWidth = tempImg.width;
      const screenshotHeight = tempImg.height;

      // Get device pixel ratio to handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      // Scale coordinates to match screenshot resolution
      const scaledLeft = Math.max(0, left * dpr);
      const scaledTop = Math.max(0, top * dpr);
      const scaledWidth = Math.min(width * dpr, screenshotWidth - scaledLeft);
      const scaledHeight = Math.min(height * dpr, screenshotHeight - scaledTop);

      const ocrRegion = {
        left: scaledLeft,
        top: scaledTop,
        width: scaledWidth,
        height: scaledHeight
      };

      // Show processing overlay with cropped region
      this.showProcessingOverlay(dataUrl, ocrRegion, screenshotWidth, screenshotHeight);

      const result = await this.ocrProcessor.processScreenshot(dataUrl, ocrRegion);

      if (result.numbers && result.numbers.length > 0) {
        // Concatenate all numbers found
        const concatenatedNumber = result.numbers.join('');
        const finalNumber = parseFloat(concatenatedNumber.replace(/,/g, ''));

        if (!isNaN(finalNumber)) {
          // Update overlay with successful result
          this.updateProcessingOverlay(finalNumber, result.numbers);
          this.sendCapturedValue(finalNumber);
          // Stop capture completely after successful OCR - treat each capture separately
          this.stopCapture();
        }
      } else {
        // Update overlay with no results found
        this.updateProcessingOverlay(null, [], 'No numbers detected in selected area');
      }

    } catch (error) {
      console.error('OCR processing error:', error);
      // Continue capture on error
    } finally {
      this.removeLoadingOverlay();
    }
  }

  async captureScreenshot() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Content: Screenshot capture failed:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          console.error('Content: Screenshot capture error:', response.error);
          reject(new Error(response.error));
        } else if (response && response.dataUrl) {
          resolve(response.dataUrl);
        } else {
          console.error('Content: Screenshot capture returned invalid response:', response);
          reject(new Error('Invalid screenshot response'));
        }
      });
    });
  }

  showProcessingOverlay(dataUrl, ocrRegion, screenshotWidth, screenshotHeight) {
    // Remove any existing processing overlay
    this.removeProcessingOverlay();

    // Create canvas to crop the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size to cropped region
    canvas.width = ocrRegion.width;
    canvas.height = ocrRegion.height;

    const img = new Image();
    img.onload = () => {
      // Draw the cropped portion
      ctx.drawImage(
        img,
        ocrRegion.left, ocrRegion.top, ocrRegion.width, ocrRegion.height, // source
        0, 0, ocrRegion.width, ocrRegion.height // destination
      );

      // Create processing overlay
      this.processingOverlay = document.createElement('div');
      this.processingOverlay.id = 'ninja-processing-overlay';
      this.processingOverlay.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(255,255,255,0.95);
        border: 2px solid #0366d6;
        border-radius: 12px;
        padding: 15px;
        z-index: 2000001;
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #333;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        backdrop-filter: blur(10px);
      `;

      const croppedDataUrl = canvas.toDataURL();

      this.processingOverlay.innerHTML = `
        <div style="margin-bottom: 12px; font-weight: 600; color: #0366d6; font-size: 14px;">📊 Number Recognition</div>
        <div id="status-container" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <div id="spinner" style="
            width: 16px;
            height: 16px;
            border: 2px solid #0366d6;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <span id="status-text" style="color: #666;">Processing selected area...</span>
        </div>
        <img src="${croppedDataUrl}" style="max-width: 100%; border: 1px solid #e1e5e9; border-radius: 6px; margin-bottom: 8px;" />
        <div id="result-container" style="margin-bottom: 8px;">
          <div id="detected-number" style="font-size: 18px; font-weight: 700; color: #0366d6; margin-bottom: 4px; min-height: 22px;"></div>
          <div id="raw-ocr" style="font-size: 11px; color: #666; min-height: 13px;"></div>
          <div style="font-size: 11px; color: #666; min-height: 13px;">Zoom in to take a larger screenshot if required.</div>

        </div>
        <div id="message-container" style="font-size: 11px; color: #666; text-align: center; min-height: 13px;">
          Analyzing image for numbers
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      document.documentElement.appendChild(this.processingOverlay);
    };
    img.src = dataUrl;
  }

  updateProcessingOverlay(finalNumber, rawNumbers, errorMessage = null) {
    if (!this.processingOverlay) return;

    // Update status container
    const statusContainer = this.processingOverlay.querySelector('#status-container');
    const spinner = this.processingOverlay.querySelector('#spinner');
    const statusText = this.processingOverlay.querySelector('#status-text');

    // Update result container
    const detectedNumber = this.processingOverlay.querySelector('#detected-number');
    const rawOcr = this.processingOverlay.querySelector('#raw-ocr');

    // Update message container
    const messageContainer = this.processingOverlay.querySelector('#message-container');

    if (errorMessage) {
      // Error state
      statusContainer.innerHTML = '<span style="color: #dc3545; font-weight: 600;">⚠️ Recognition Failed</span>';
      detectedNumber.textContent = '';
      rawOcr.textContent = '';
      messageContainer.textContent = errorMessage;
      messageContainer.style.color = '#999';
    } else if (finalNumber !== null) {
      // Success state
      statusContainer.innerHTML = '<span style="color: #28a745; font-weight: 600;">✅ Number Detected</span>';
      detectedNumber.textContent = finalNumber.toLocaleString();
      rawOcr.textContent = `Raw OCR: ${rawNumbers.join('')}`;
      messageContainer.textContent = '✓ Successful';
      messageContainer.style.color = '#28a745';
    }

    // Auto-remove after 4 seconds for success, 6 seconds for errors
    const timeout = errorMessage ? 6000 : 4000;
    setTimeout(() => {
      this.removeProcessingOverlay();
    }, timeout);
  }

  removeProcessingOverlay() {
    if (this.processingOverlay) {
      this.processingOverlay.remove();
      this.processingOverlay = null;
    }
  }

  removeDebugCrop() {
    if (this.debugOverlay) {
      this.debugOverlay.remove();
      this.debugOverlay = null;
    }
  }

  sendCapturedValue(value) {
    const messageId = 'ocr-' + Date.now() + '-' + Math.random();

    // Send the captured value to the sidepanel (no variant/field context)
    chrome.runtime.sendMessage({
      type: 'OCR_VALUE',
      value: value,
      id: messageId
    });
  }

  showScreenshotOverlay(dataUrl) {
    // Remove any existing overlay
    this.removeScreenshotOverlay();

    // Store the original screenshot data for processing
    this.screenshotDataUrl = dataUrl;

    // Create full-page overlay container
    this.screenshotOverlay = document.createElement('div');
    this.screenshotOverlay.id = 'ninja-screenshot-overlay';
    this.screenshotOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2000000;
      cursor: crosshair;
    `;

    // Create screenshot image (below everything)
    this.screenshotImage = document.createElement('img');
    this.screenshotImage.src = dataUrl;
    this.screenshotImage.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      object-fit: contain;
      pointer-events: none;
      z-index: 1;
    `;

    // Create frame overlays for dark background around selection
    this.frameTop = document.createElement('div');
    this.frameTop.style.cssText = `position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.4); pointer-events: none; z-index: 2;`;

    this.frameBottom = document.createElement('div');
    this.frameBottom.style.cssText = `position: absolute; top: 0; left: 0; width: 0; height: 0; background: rgba(0, 0, 0, 0.4); pointer-events: none; z-index: 2;`;

    this.frameLeft = document.createElement('div');
    this.frameLeft.style.cssText = `position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.4); pointer-events: none; z-index: 2;`;

    this.frameRight = document.createElement('div');
    this.frameRight.style.cssText = `position: absolute; top: 0; left: 0; width: 0; height: 0; background: rgba(0, 0, 0, 0.4); pointer-events: none; z-index: 2;`;

    // Add elements to overlay
    this.screenshotOverlay.appendChild(this.screenshotImage);
    this.screenshotOverlay.appendChild(this.frameTop);
    this.screenshotOverlay.appendChild(this.frameBottom);
    this.screenshotOverlay.appendChild(this.frameLeft);
    this.screenshotOverlay.appendChild(this.frameRight);

    document.documentElement.appendChild(this.screenshotOverlay);

    // Handle image load
    this.screenshotImage.onload = () => {};

    this.screenshotImage.onerror = (error) => {
      console.error('Content: Failed to load screenshot image:', error);
    };

    // Add event listeners directly to the overlay (using arrow functions for proper context)
    this.screenshotOverlay.addEventListener('mousedown', (event) => {
      this.handleOverlayMouseDown(event);
    });
    this.screenshotOverlay.addEventListener('mousemove', (event) => {
      if (this.isSelecting) {
        this.handleOverlayMouseMove(event);
      }
    });
    this.screenshotOverlay.addEventListener('mouseup', (event) => {
      this.handleOverlayMouseUp(event);
    });
  }

  removeScreenshotOverlay() {
    if (this.screenshotOverlay) {
      this.screenshotOverlay.remove();
      this.screenshotOverlay = null;
      this.screenshotImage = null;
      this.darkOverlay = null;
      this.frameTop = null;
      this.frameBottom = null;
      this.frameLeft = null;
      this.frameRight = null;
      this.selectionOverlay = null;
    }
  }

  handleOverlayMouseDown(event) {
    if (!this.isActive || !this.screenshotOverlay) return;

    // Start selection from overlay
    this.isSelecting = true;
    this.selectionStart.x = event.clientX;
    this.selectionStart.y = event.clientY;
    this.selectionEnd.x = event.clientX;
    this.selectionEnd.y = event.clientY;

    this.createSelectionOverlay();
    event.preventDefault();
  }

  handleOverlayMouseMove(event) {
    if (!this.isActive || !this.isSelecting) return;

    // Update selection rectangle
    this.selectionEnd.x = event.clientX;
    this.selectionEnd.y = event.clientY;
    this.updateSelectionOverlay();
  }

  async handleOverlayMouseUp(event) {
    if (!this.isActive || !this.isSelecting) return;

    this.isSelecting = false;

    // Calculate selection dimensions
    const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

    // Only process if selection is large enough (at least 3x3 pixels)
    if (width > 3 && height > 3) {
      this.removeSelectionOverlay();
      await this.processOverlaySelection(left, top, width, height);
    } else {
      this.removeSelectionOverlay();
    }

    event.preventDefault();
  }

  async processOverlaySelection(left, top, width, height) {
    try {
      this.showLoadingOverlay();

      // Use the stored screenshot data directly
      const dataUrl = this.screenshotDataUrl;

      // Get image dimensions
      const img = new Image();
      await new Promise(resolve => {
        img.onload = resolve;
        img.src = dataUrl;
      });

      const screenshotWidth = img.width;
      const screenshotHeight = img.height;

      // Get device pixel ratio to handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      // Scale coordinates to match screenshot resolution
      const scaledLeft = Math.max(0, left * dpr);
      const scaledTop = Math.max(0, top * dpr);
      const scaledWidth = Math.min(width * dpr, screenshotWidth - scaledLeft);
      const scaledHeight = Math.min(height * dpr, screenshotHeight - scaledTop);

      const ocrRegion = {
        left: scaledLeft,
        top: scaledTop,
        width: scaledWidth,
        height: scaledHeight
      };

      // Show processing overlay with cropped region
      this.showProcessingOverlay(dataUrl, ocrRegion, screenshotWidth, screenshotHeight);

      const result = await this.ocrProcessor.processScreenshot(dataUrl, ocrRegion);

      if (result.numbers && result.numbers.length > 0) {
        // Concatenate all numbers found
        const concatenatedNumber = result.numbers.join('');
        const finalNumber = parseFloat(concatenatedNumber.replace(/,/g, ''));

        if (!isNaN(finalNumber)) {
          // Update overlay with successful result
          this.updateProcessingOverlay(finalNumber, result.numbers);
          this.sendCapturedValue(finalNumber);
          // Stop capture completely after successful OCR - treat each capture separately
          this.stopCapture();
        }
      } else {
        // Update overlay with no results found
        this.updateProcessingOverlay(null, [], 'No numbers detected in selected area');
      }

    } catch (error) {
      console.error('Overlay OCR processing error:', error);
      this.updateProcessingOverlay(null, [], 'Error processing selected area');
    } finally {
      this.removeLoadingOverlay();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.numberCapture = new NumberCapture();
  });
} else {
  window.numberCapture = new NumberCapture();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.numberCapture) {
    window.numberCapture.ocrProcessor.cleanup();
  }
});
