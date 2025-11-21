// Background service worker for Ninja Test Calculator
// Manages side panel, communication, and OCR processing

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Initialize side panel on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      // From sidepanel to content script - get current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'START_CAPTURE'
          }).catch(() => {
            // Ignore errors if content script not ready
          });
        }
      });
      sendResponse({ success: true });
      break;
    
    case 'STOP_CAPTURE':
      // From sidepanel to content script - get current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_CAPTURE' }).catch(() => {
            // Ignore errors if content script not ready
          });
        }
      });
      sendResponse({ success: true });
      break;
    
    case 'CAPTURE_SCREENSHOT':
      // Handle screenshot capture for OCR - only from content scripts
      if (sender.tab) {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl: dataUrl });
          }
        });
        return true; // Keep message channel open for async response
      }
      break;
    
    case 'OCR_VALUE':
      // Only relay OCR_VALUE messages that come from content scripts (have sender.tab)
      if (sender.tab) {
        chrome.runtime.sendMessage(message).catch(() => {
          // Ignore errors if sidepanel not listening
        });
      }
      sendResponse({ success: true });
      break;
    
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  
  return false; // Don't keep message channel open unless explicitly returned true
});
