// Ninja Test Calculator - OCR Capture Functions
// Contains all OCR-related functionality for capturing data using optical character recognition

// Field capture state
let isCapturing = false;
let currentVariant = null;
let currentField = null; // 'visitors' or 'conversions'

function startFieldCapture(variant, field) {
  // Stop any existing capture
  if (isCapturing) {
    stopCapture();
  }

  isCapturing = true;
  currentVariant = variant;
  currentField = field;

  updateCaptureButtonState();
  highlightCurrentField();

  // Send message to background script to relay to content script
  chrome.runtime.sendMessage({
    type: 'START_CAPTURE'
  });
}

function stopCapture() {
  isCapturing = false;
  clearFieldHighlights();
  updateCaptureButtonState();
  currentVariant = null;
  currentField = null;

  // Send message to background script to relay to content script
  chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
}

function updateCaptureButtonState() {
  // Clear all button states first
  const allButtons = document.querySelectorAll('.capture-field-btn');
  allButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // Clear all variant button states (if any remain)
  const allVariantButtons = document.querySelectorAll('.capture-variant-btn');
  allVariantButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // If capturing, highlight the current field button
  if (isCapturing && currentVariant && currentField) {
    const button = document.querySelector(`[data-variant="${currentVariant}"][data-field="${currentField}"].capture-field-btn`);
    if (button) {
      button.classList.add('active');
    }
  }
}

function highlightCurrentField() {
  clearFieldHighlights();

  if (currentVariant && currentField) {
    const fieldId = `${currentField}${currentVariant}`;
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.add('highlight');
    }
  }
}

function clearFieldHighlights() {
  const highlightedFields = document.querySelectorAll('.data-input.highlight');
  highlightedFields.forEach(field => {
    field.classList.remove('highlight');
  });
}

// Handle OCR value from content script
function handleOCRValue(value) {
  if (!isCapturing || !currentVariant || !currentField) {
    return;
  }

  // Put the value in the appropriate field based on current state
  const fieldId = `${currentField}${currentVariant}`;
  const field = document.getElementById(fieldId);

  if (field) {
    field.value = value;

    // Trigger input event to ensure StatisticsManager recalculates
    const inputEvent = new Event('input', { bubbles: true });
    field.dispatchEvent(inputEvent);

    // Also trigger change event as backup
    const changeEvent = new Event('change', { bubbles: true });
    field.dispatchEvent(changeEvent);

    // Capture complete for this field - stop everything
    stopCapture();
  }
}

// Listen for messages from content script and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OCR_VALUE') {
    handleOCRValue(message.value);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_CAPTURE') {
    stopCapture();
    sendResponse({ success: true });
  }
  return true; // Keep message channel open
});

// Initialize OCR capture functionality
function initializeOCRCapture() {

  // Set up field capture functionality
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('capture-field-btn')) {
      const variant = e.target.getAttribute('data-variant');
      const field = e.target.getAttribute('data-field');
      if (variant && field) {
        // If we're already capturing this specific field, stop capture
        if (isCapturing && currentVariant === variant && currentField === field) {
          stopCapture();
        } else {
          startFieldCapture(variant, field);
        }
      }
    }
  });
}
