let ocrWorker = null;

async function initializeOCR() {
  if (ocrWorker) return ocrWorker;
  
  try {
    ocrWorker = await Tesseract.createWorker('eng', 1, {
      workerBlobURL: false,
      workerPath: '../worker.min.js',
      corePath: '../tesseract-core-simd-lstm.wasm.js',
      cacheMethod: 'none',
      logger: (m) => {
        // Send progress updates to parent
        if (parent && parent.postMessage) {
          parent.postMessage({
            type: 'OCR_PROGRESS',
            progress: m.progress || 0,
            status: m.status
          }, '*');
        }
      }
    });
    
    return ocrWorker;
  } catch (error) {
    console.error('Failed to initialize OCR worker:', error);
    throw error;
  }
}

window.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'PRELOAD_OCR') {
    const { id } = event.data;

    try {
      // Initialize OCR worker for preloading
      await initializeOCR();
      parent.postMessage({
        id: id,
        type: 'PRELOAD_SUCCESS'
      }, '*');
    } catch (error) {
      console.error('Preload error:', error);
      parent.postMessage({
        id: id,
        type: 'PRELOAD_ERROR',
        error: error.message
      }, '*');
    }
  } else if (event.data && event.data.type === 'OCR_REQUEST') {
    const { id, imageData, region } = event.data;
    
    try {
      const worker = await initializeOCR();
      
      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Create image from data URL
      const img = new Image();
      
      img.onload = async () => {
        try {
          // Set canvas dimensions to the region size
          canvas.width = region.width;
          canvas.height = region.height;
          
          // Draw the cropped region onto canvas
          ctx.drawImage(
            img, 
            region.left, region.top, region.width, region.height, // Source rectangle
            0, 0, region.width, region.height // Destination rectangle
          );
          
          // Run OCR on the canvas
          const result = await worker.recognize(canvas);
          
          // Extract numbers from the recognized text
          const numbers = extractNumbers(result.data.text);
          
          // Send result back to parent
          parent.postMessage({
            id: id,
            type: 'OCR_RESULT',
            result: {
              text: result.data.text.trim(),
              confidence: result.data.confidence,
              numbers: numbers
            }
          }, '*');
          
        } catch (error) {
          console.error('OCR processing error:', error);
          parent.postMessage({
            id: id,
            type: 'OCR_ERROR',
            error: error.message
          }, '*');
        }
      };
      
      img.onerror = () => {
        parent.postMessage({
          id: id,
          type: 'OCR_ERROR',
          error: 'Failed to load image'
        }, '*');
      };
      
      img.src = imageData;
      
    } catch (error) {
      console.error('OCR initialization error:', error);
      parent.postMessage({
        id: id,
        type: 'OCR_ERROR',
        error: error.message
      }, '*');
    }
  }
});

function extractNumbers(text) {
  const numbers = [];
  // Match numbers with optional commas and decimals
  const regex = /\d+(?:,\d{3})*(?:\.\d+)?/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const cleanNumber = match[0].replace(/,/g, '');
    const value = parseFloat(cleanNumber);
    if (!isNaN(value) && isFinite(value)) {
      numbers.push(value);
    }
  }
  
  return numbers;
}
