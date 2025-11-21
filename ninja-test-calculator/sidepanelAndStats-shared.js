// Ninja Test Calculator - Shared Functions
// Contains common functions and utilities used across all tabs

// Global state management (functional approach)
let currentTab = 'about';
let dispatchTimeout;

// Shared utility functions
function formatNumber(value, decimals = 2) {
  if (isNaN(value) || !isFinite(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}

function formatPercentage(value, decimals = 2) {
  if (isNaN(value) || !isFinite(value)) {
    return '-';
  }
  return `${(value * 100).toFixed(decimals)}%`;
}

// UI display update functions (used across all tabs)
function updateConfidenceDisplay(value) {
  const confidenceValueDisplay = document.getElementById('confidenceValue');
  if (confidenceValueDisplay) {
    confidenceValueDisplay.textContent = value + '%';
  }
}

function updatePowerDisplay(value) {
  const powerValueDisplay = document.getElementById('powerValue');
  if (powerValueDisplay) {
    powerValueDisplay.textContent = value + '%';
  }
}

function updateVariationsDisplay(value) {
  const variationsValueDisplay = document.getElementById('variationsValue');
  if (variationsValueDisplay) {
    variationsValueDisplay.textContent = value;
  }
}



// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize shared components and event listeners
  initializeSharedComponents();

  // Initialize variant rows for default number of variations (2)
  handleNumberOfVariationsChange();

  // Set up input field change listeners for all variant inputs
  setupInputFieldListeners();

  // Initialize the default tab (About tab)
  switchTab('about');

  // Initialize Poisson dispersion slider display and chart
  const poissonDispersionSlider = document.getElementById('poissonDispersion');
  if (poissonDispersionSlider) {
    updatePoissonDispersionDisplay(poissonDispersionSlider.value);
  }
});

function initializeSharedComponents() {
  // Set up tab switching
  setupTabSwitching();

  // Set up variant capture functionality
  initializeOCRCapture()

  // Set up clear all data functionality
  setupClearAllData();
}

function setupTabSwitching() {
  // Tab buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ntc-tab-btn')) {
      const tabName = e.target.getAttribute('data-tab');
      switchTab(tabName);
    } else if (e.target.classList.contains('callout-button')) {
      const tabName = e.target.getAttribute('data-tab-to');
      switchTab(tabName);
    } else if (e.target.closest('.callout-panel')) {
      const panel = e.target.closest('.callout-panel');
      // Don't navigate if it's an info-only panel
      if (panel.classList.contains('info-only')) {
        return;
      }
      const tabName = panel.getAttribute('data-target-tab');
      if (tabName) {
        switchTab(tabName);
      }
    }
  });
}

function switchTab(tabName) {
  // Update tab button states
  const tabButtons = document.querySelectorAll('.ntc-tab-btn');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  showTab(tabName);
}

function showTab(tabName) {
  // Hide all content components with data-tab attributes (but not tab buttons)
  const allComponents = document.querySelectorAll('[data-tab]:not(.ntc-tab-btn)');
  allComponents.forEach(component => {
    component.classList.add('hidden');
  });

  // Show content components for the selected tab (but not tab buttons)
  const tabComponents = document.querySelectorAll(`[data-tab="${tabName}"]:not(.ntc-tab-btn)`);
  tabComponents.forEach(component => {
    component.classList.remove('hidden');
  });

  // Show shared components (used by z-test and poisson tabs)
  const sharedComponents = document.querySelectorAll('[data-tab="shared"]:not(.ntc-tab-btn)');
  sharedComponents.forEach(component => {
    if (tabName === 'z-test' || tabName === 'poisson') {
      component.classList.remove('hidden');
    }
  });

  // Show analysis components (variants table and analysis cards) for z-test and poisson tabs
  const analysisComponents = document.querySelectorAll('[data-tab="z-test"]:not(.ntc-tab-btn)');
  analysisComponents.forEach(component => {
    if (tabName === 'z-test' || tabName === 'poisson') {
      component.classList.remove('hidden');
    }
  });

  // Show sample size & duration card on all tabs except percentages
  const durationCard = document.getElementById('durationCard');
  if (durationCard) {
    if (tabName === 'percentages') {
      durationCard.classList.add('hidden');
    } else {
      durationCard.classList.remove('hidden');
    }
  }

  // Show leading variant card on z-test and poisson tabs
  const leadingVariantCard = document.getElementById('leadingVariantCard');
  if (leadingVariantCard) {
    if (tabName === 'z-test' || tabName === 'poisson') {
      leadingVariantCard.classList.remove('hidden');
    } else {
      leadingVariantCard.classList.add('hidden');
    }
  }

  // Control field descriptor visibility
  updateFieldDescriptorVisibility(tabName);

  // Show poisson-only inputs (dispersion parameter) only on poisson tab
  const poissonOnlyInputs = document.querySelectorAll('[data-tab="poisson-only"]');
  poissonOnlyInputs.forEach(component => {
    if (tabName === 'poisson') {
      component.classList.remove('hidden');
    } else {
      component.classList.add('hidden');
    }
  });

  // Update current tab and trigger appropriate initialization
  currentTab = tabName;

  // Initialize dispersion chart when showing Poisson tab
  if (tabName === 'poisson') {
    const poissonDispersionSlider = document.getElementById('poissonDispersion');
    if (poissonDispersionSlider) {
      updatePoissonDispersionDisplay(poissonDispersionSlider.value);
    }
  }

  // Dispatch fields updated event to update calculations when tab changes
  if (currentTab === 'z-test' || currentTab === 'poisson') {
    dispatchTabChanged();
  }

  // Initialize the appropriate tab when shown
  // Note: All tab-specific initialization functions removed as requested
  // Each tab file will handle its own event listeners for fieldsUpdated
}

function updateFieldDescriptorVisibility(tabName) {
  // Hide all tab content headers first
  const allTabContentHeaders = document.querySelectorAll('.tab-content-header');
  allTabContentHeaders.forEach(header => {
    header.classList.add('hidden');
  });

  // Show the tab content header for the current tab (if it exists)
  const currentTabContentHeader = document.querySelector(`.tab-content-header[data-tab="${tabName}"]`);
  if (currentTabContentHeader) {
    currentTabContentHeader.classList.remove('hidden');
  }

  console.log(`Updated tab content header visibility for tab: ${tabName}`);
}

// Rate calculation function
function calculateRate(visitors, conversions) {
  if (!visitors || visitors <= 0 || !conversions || conversions < 0) {
    return null;
  }
  return conversions / visitors;
}

// Lift calculation function (relative to control variant A)
function calculateLift(controlRate, testRate) {
  if (controlRate === null || controlRate <= 0) {
    if (testRate > 0) {
      return Infinity;
    } else {
      return 0;
    }
  }
  return (testRate - controlRate) / controlRate;
}

// Function to recalculate all shared display values (rates, lifts, extras) for all variants
function updateAllSharedDisplays() {
  const inputs = getAllInputFields();
  const numVariations = parseInt(inputs.numberOfVariations?.value || '2');
  const variants = ['A', 'B', 'C', 'D', 'E'];

  // Update rates for all variants
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    updateRateDisplay(variant);
  }
}

function updateRateDisplay(variant) {
  const visitorsField = document.getElementById(`visitors${variant}`);
  const conversionsField = document.getElementById(`conversions${variant}`);
  const ratePercentField = document.getElementById(`rate${variant}Percent`);
  const rateRawField = document.getElementById(`rate${variant}Raw`);

  if (!visitorsField || !conversionsField || !ratePercentField || !rateRawField) {
    return;
  }

  const visitors = parseInt(visitorsField.value) || 0;
  const conversions = parseFloat(conversionsField.value) || 0;
  const rate = calculateRate(visitors, conversions);

  if (rate !== null) {
    ratePercentField.textContent = formatPercentage(rate);
    rateRawField.textContent = rate.toFixed(6);
  } else {
    ratePercentField.textContent = '-';
    rateRawField.textContent = '-';
  }

  // Trigger lift updates for all variants after rate change
  setTimeout(updateLiftDisplays, 0);
}

function updateLiftDisplays() {
  const inputs = getAllInputFields();
  const numVariations = parseInt(inputs.numberOfVariations?.value || '2');
  const variants = ['A', 'B', 'C', 'D', 'E'];

  // Calculate all rates first
  const rates = {};
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const visitors = parseInt(inputs.variantInputs.visitors[variant]?.value || '0');
    const conversions = parseFloat(inputs.variantInputs.conversions[variant]?.value || '0');
    rates[variant] = calculateRate(visitors, conversions);
  }

  const controlRate = rates['A'];

  // Calculate lifts vs A for others, and vs next best for A when A is best
  const lifts = {};
  const extras = {};
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const visitors = parseInt(inputs.variantInputs.visitors[variant]?.value || '0');
    if (variant === 'A') {
      // Will be calculated below
    } else {
      lifts[variant] = controlRate !== null ? calculateLift(controlRate, rates[variant]) : null;
      extras[variant] = controlRate !== null ? (rates[variant] - controlRate) * visitors : null;
    }
  }

  // Always calculate A vs next best
  const sortedVariants = variants
    .slice(0, numVariations)
    .filter(v => rates[v] !== null)
    .sort((a, b) => (rates[b] || 0) - (rates[a] || 0));

  // Find next best (highest rate excluding A, or if A is tied, the effective next)
  let nextBest = null;
  let nextRate = null;
  if (sortedVariants.length > 1) {
    nextBest = sortedVariants[0] === 'A' ? sortedVariants[1] : sortedVariants[0];
    nextRate = rates[nextBest];
  }

  if (rates['A'] !== null && nextBest !== null) {
    const visitors = parseInt(inputs.variantInputs.visitors['A']?.value || '0');
    lifts['A'] = calculateLift(nextRate, rates['A']);
    extras['A'] = (rates['A'] - nextRate) * visitors;
  } else {
    lifts['A'] = 0;
    extras['A'] = 0;
  }

  // Update lift and extra displays for all variants - Calculate raw rate difference
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const liftField = document.getElementById(`lift${variant}`);
    const liftCountField = document.getElementById(`liftCount${variant}`);
    const additionalField = document.getElementById(`additional${variant}`);

    const liftPercentage = lifts[variant];
    const extra = extras[variant];
    const rate = rates[variant];

    if (liftField) {
      if (liftPercentage == null || isNaN(liftPercentage)) {
        liftField.textContent = '-';
      } else if (liftPercentage === Infinity) {
        liftField.textContent = '∞';
      } else if (liftPercentage === 0) {
        liftField.textContent = '-';
      } else {
        // Only show lift percentage (no bracketed raw-rate difference)
        liftField.textContent = (liftPercentage > 0 ? '+' : '') + formatPercentage(liftPercentage);
      }
    }

    if (liftCountField) {
      let rateDiff;
      if (variant === 'A') {
        // For variant A, show lift vs next best (same logic as lift percentage)
        rateDiff = rates['A'] - nextRate;
      } else {
        // For other variants, show lift vs control (variant A)
        rateDiff = rates[variant] - controlRate;
      }

      if (rateDiff == null || isNaN(rateDiff) || rateDiff === 0) {
        liftCountField.textContent = '-';
      } else {
        liftCountField.textContent = (rateDiff > 0 ? '+' : '') + rateDiff.toFixed(6);
      }
    }

    if (additionalField) {
      if (extra == null || isNaN(extra) || extra === 0) {
        additionalField.textContent = '-';
      } else {
        additionalField.textContent = (extra > 0 ? '+' : '') + extra.toFixed(0);
      }
    }
  }
}



function updateLeadingVariant(inputData) {
  const variants = Object.keys(inputData.variants);
  const rates = variants.map(v => ({ variant: v, rate: inputData.variants[v].rate }))
    .filter(item => item.rate !== null)
    .sort((a, b) => b.rate - a.rate);

  if (rates.length >= 2) {
    const leader = rates[0];
    const next = rates[1];
    const lift = ((leader.rate - next.rate) / next.rate) * 100;

    // Update leading variant display
    const leadingVariantField = document.getElementById('leadingVariant');
    if (leadingVariantField) {
      leadingVariantField.textContent = leader.variant;
    }

    const leadingVsField = document.getElementById('leadingVs');
    if (leadingVsField) {
      leadingVsField.textContent = `${(lift > 0 ? '+' : '') + lift.toFixed(1)}% vs ${next.variant}`;
    }

    // Calculate Lift vs A
    const controlRate = inputData.variants['A'].rate || 0;
    const liftVsA = leader.variant === 'A' ? null : ((leader.rate - controlRate) / controlRate) * 100;
    const leadingVsAField = document.getElementById('leadingVsA');
    if (leadingVsAField) {
      if (liftVsA == null || isNaN(liftVsA)) {
        leadingVsAField.textContent = '-';
      } else {
        leadingVsAField.textContent = (liftVsA > 0 ? '+' : '') + liftVsA.toFixed(1) + '%';
      }
    }

    // Calculate monthly extras (projected for 30 days, extrapolated using daysOfData)
    const leadingMonthlyExtrasField = document.getElementById('leadingMonthlyExtras');
    if (leadingMonthlyExtrasField) {
      // Monthly extras = (rate_leader - rate_comparison) * monthly_traffic
      // If leader is A, compare to next best variant; otherwise compare to variant A
      // Using combined traffic from all variants per day as baseline for full rollout, extrapolated to 30 days
      const controlRate = inputData.variants['A'].rate || 0;
      const leaderRate = inputData.variants[leader.variant].rate || 0;
      const comparisonRate = leader.variant === 'A' ? (inputData.variants[next.variant].rate || 0) : controlRate;
      let totalTrafficPerDay = 0;
      for (const variantKey in inputData.variants) {
        totalTrafficPerDay += inputData.variants[variantKey].visitors;
      }
      totalTrafficPerDay /= inputData.daysOfData;
      const monthlyTraffic = totalTrafficPerDay * 30;
      const extraMonthly = (leaderRate - comparisonRate) * monthlyTraffic;
      leadingMonthlyExtrasField.textContent = isFinite(extraMonthly) && !isNaN(extraMonthly) ? extraMonthly.toFixed(0) : '-';
    }

  } else {
    // Clear fields if not enough data
    const fields = ['leadingVariant', 'leadingVs', 'leadingVsA', 'leadingMonthlyExtras', 'leadingLaymanSummary'];
    fields.forEach(id => {
      const field = document.getElementById(id);
      if (field) field.textContent = '-';
    });
  }
}



function setupInputFieldListeners() {
  // Set up listeners for all variant input fields (visitors and conversions)
  // Note: Percentage calculator inputs are handled separately in -percentages.js
  const variants = ['A', 'B', 'C', 'D', 'E'];

    variants.forEach(variant => {
    // Visitors field
    const visitorsField = document.getElementById(`visitors${variant}`);
    if (visitorsField) {
      visitorsField.addEventListener('input', () => {
        updateRateDisplay(variant);
        dispatchFieldsUpdated();
      });
      visitorsField.addEventListener('change', () => {
        updateRateDisplay(variant);
        dispatchFieldsUpdated();
      });
    }

    // Conversions field
    const conversionsField = document.getElementById(`conversions${variant}`);
    if (conversionsField) {
      conversionsField.addEventListener('input', () => {
        updateRateDisplay(variant);
        dispatchFieldsUpdated();
      });
      conversionsField.addEventListener('change', () => {
        updateRateDisplay(variant);
        dispatchFieldsUpdated();
      });
    }

    // SD field
    const sdField = document.getElementById(`sd${variant}`);
    if (sdField) {
      sdField.addEventListener('input', () => {
        dispatchFieldsUpdated();
      });
      sdField.addEventListener('change', () => {
        dispatchFieldsUpdated();
      });
    }
  });

  // Set up listeners for shared configuration inputs (excluding percentage calculator)
  const sharedInputs = [
    'testDuration',
    'numberOfVariations',
    'confidenceLevel',
    'statisticalPower',
    'strictnessAdjustment'
  ];

  sharedInputs.forEach(inputId => {
    const inputField = document.getElementById(inputId);
    if (inputField) {
      inputField.addEventListener('input', () => {
        // Update display values immediately for sliders
        updateSliderDisplay(inputId, inputField.value);
        dispatchFieldsUpdated();
      });
      inputField.addEventListener('change', () => {
        dispatchFieldsUpdated();
      });
    }
  });

  // Set up listener for Poisson dispersion slider
  const poissonDispersionSlider = document.getElementById('poissonDispersion');
  if (poissonDispersionSlider) {
    poissonDispersionSlider.addEventListener('input', () => {
      updatePoissonDispersionDisplay(poissonDispersionSlider.value);
      dispatchFieldsUpdated();
    });
    poissonDispersionSlider.addEventListener('change', () => {
      updatePoissonDispersionDisplay(poissonDispersionSlider.value);
      dispatchFieldsUpdated();
    });
    // Double-click to reset to default (dispersion = 1.0)
    poissonDispersionSlider.addEventListener('dblclick', () => {
      poissonDispersionSlider.value = 1;
      updatePoissonDispersionDisplay(1);
      dispatchFieldsUpdated();
    });
  }

  // Set up double-click reset for sliders
  setupSliderDoubleClickResets();

  // Set up listener for strictness adjustment checkbox
  const strictnessCheckbox = document.getElementById('strictnessAdjustment');
  if (strictnessCheckbox) {
    strictnessCheckbox.addEventListener('change', () => {
      dispatchFieldsUpdated();
    });
  }

  // Set up specific listener for number of variations to handle dynamic variant management
  const numberOfVariationsField = document.getElementById('numberOfVariations');
  if (numberOfVariationsField) {
    numberOfVariationsField.addEventListener('input', () => {
      handleNumberOfVariationsChange();
      updateStrictnessAdjustmentVisibility();
      dispatchFieldsUpdated();
    });
    numberOfVariationsField.addEventListener('change', () => {
      handleNumberOfVariationsChange();
      updateStrictnessAdjustmentVisibility();
      dispatchFieldsUpdated();
    });

    // Double-click to reset to default (2)
    numberOfVariationsField.addEventListener('dblclick', () => {
      numberOfVariationsField.value = 2;
      handleNumberOfVariationsChange();
      updateStrictnessAdjustmentVisibility();
      dispatchFieldsUpdated();
    });
    
    // Initialize visibility on load
    updateStrictnessAdjustmentVisibility();
  }
}

// Convenience function that defines all input fields from the HTML
function getAllInputFields() {
  return {
    // Test configuration inputs
    numberOfVariations: document.getElementById('numberOfVariations'),
    confidenceLevel: document.getElementById('confidenceLevel'),
    statisticalPower: document.getElementById('statisticalPower'),
    testDuration: document.getElementById('testDuration'),

    // Variant data inputs (A, B, C, D, etc.)
    variantInputs: {
      visitors: {
        A: document.getElementById('visitorsA'),
        B: document.getElementById('visitorsB'),
        C: document.getElementById('visitorsC'),
        D: document.getElementById('visitorsD'),
        E: document.getElementById('visitorsE')
      },
      conversions: {
        A: document.getElementById('conversionsA'),
        B: document.getElementById('conversionsB'),
        C: document.getElementById('conversionsC'),
        D: document.getElementById('conversionsD'),
        E: document.getElementById('conversionsE')
      },
      sd: {
        A: document.getElementById('sdA'),
        B: document.getElementById('sdB'),
        C: document.getElementById('sdC'),
        D: document.getElementById('sdD'),
        E: document.getElementById('sdE')
      }
    }
  };
}


// Event dispatching system for input field updates
function dispatchFieldsUpdated() {
   clearTimeout(dispatchTimeout);
   dispatchTimeout = setTimeout(() => {
     // Always dispatch the event when all fields are filled
     // Each test will check if it's the active tab before running calculations
     // Validate that all required inputs are filled before dispatching
     if (validateAllInputsFilled()) {
       // Create comprehensive JSON object with all input data
       const inputData = collectAllInputData();

       const event = new CustomEvent('fieldsUpdated', {
         detail: {
           timestamp: Date.now(),
           tab: currentTab,
           inputData: inputData
         }
       });
       document.dispatchEvent(event);

       // Update shared displays (rates, lifts, extras) for all variants
       updateAllSharedDisplays();

       // Update leading variant after dispatch
       if (currentTab === 'z-test' || currentTab === 'poisson') {
         updateLeadingVariant(inputData);
       }
     }
   }, 300);
}
// Event dispatching system for a tab change
function dispatchTabChanged() {

       const event = new CustomEvent('tabChanged', {
         detail: {
           timestamp: Date.now(),
           tab: currentTab
         }
       });
       document.dispatchEvent(event);
      
  dispatchFieldsUpdated();
}



// Collect all input data into a structured JSON object
function collectAllInputData() {
  const inputs = getAllInputFields();
  const variants = ['A', 'B', 'C', 'D', 'E'];
  const numVariations = parseInt(inputs.numberOfVariations?.value || '2');

  // Always use two-tailed test
  const tailType = 'two-tailed';

  // Collect variant data
  const variantData = {};

  // First pass: gather all rates
  const rates = {};
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const visitors = parseInt(inputs.variantInputs.visitors[variant]?.value || '0');
    const conversions = parseFloat(inputs.variantInputs.conversions[variant]?.value || '0');
    const rate = calculateRate(visitors, conversions);
    rates[variant] = rate;
  }

  // Second pass: calculate lifts and extras
  const controlRate = rates['A'];
  const lifts = {};
  const extras = {};
  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const visitors = parseInt(inputs.variantInputs.visitors[variant]?.value || '0');
    if (variant === 'A') {
      // Will be calculated below
    } else {
      lifts[variant] = controlRate !== null ? calculateLift(controlRate, rates[variant]) : null;
      extras[variant] = controlRate !== null ? (rates[variant] - controlRate) * visitors : null;
    }
  }

  // Always calculate A vs next best
  const sortedVariants = variants
    .slice(0, numVariations)
    .filter(v => rates[v] !== null)
    .sort((a, b) => (rates[b] || 0) - (rates[a] || 0));

  // Find next best (highest rate excluding A, or if A is tied, the effective next)
  let nextBest = null;
  let nextRate = null;
  if (sortedVariants.length > 1) {
    nextBest = sortedVariants[0] === 'A' ? sortedVariants[1] : sortedVariants[0];
    nextRate = rates[nextBest];
  }

  if (rates['A'] !== null && nextBest !== null) {
    const visitors = parseInt(inputs.variantInputs.visitors['A']?.value || '0');
    lifts['A'] = calculateLift(nextRate, rates['A']);
    extras['A'] = (rates['A'] - nextRate) * visitors;
  } else {
    lifts['A'] = 0;
    extras['A'] = 0;
  }

  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];
    const visitors = parseInt(inputs.variantInputs.visitors[variant]?.value || '0');
    const conversions = parseFloat(inputs.variantInputs.conversions[variant]?.value || '0');
    const sd = parseFloat(inputs.variantInputs.sd[variant]?.value || '0');
    const rate = rates[variant];
    const lift = lifts[variant];
    const extra = extras[variant];

    variantData[variant] = {
      visitors: visitors,
      conversions: conversions,
      sd: sd,
      rate: rate,
      lift: lift,
      extra: extra
    };
  }

  return {
    daysOfData: parseInt(inputs.testDuration?.value || '7'),
    numberOfVariations: numVariations,
    confidenceLevel: parseFloat(inputs.confidenceLevel?.value || '95'),
    powerLevel: parseFloat(inputs.statisticalPower?.value || '80'),
    tailType: tailType,
    strictnessAdjustment: document.getElementById('strictnessAdjustment')?.checked || false,
    variants: variantData
  };
}

// Validate that all required inputs are filled and not zero
function validateAllInputsFilled() {
  const inputs = getAllInputFields();

  // Check test configuration inputs (excluding percentage calculator)
  const configInputs = [
    inputs.numberOfVariations,
    inputs.confidenceLevel,
    inputs.statisticalPower,
    inputs.testDuration
  ];

  for (const input of configInputs) {
    if (!input || input.value === '' || parseFloat(input.value) <= 0) {
      return false;
    }
  }

  // Check variant inputs based on number of variations
  const numVariations = parseInt(inputs.numberOfVariations?.value || '2');
  const variants = ['A', 'B', 'C', 'D', 'E'];

  for (let i = 0; i < numVariations; i++) {
    const variant = variants[i];

    // Check visitors field
    const visitorsField = inputs.variantInputs.visitors[variant];
    if (!visitorsField || visitorsField.value === '' || parseInt(visitorsField.value) <= 0) {
      return false;
    }

    // Check conversions field
    const conversionsField = inputs.variantInputs.conversions[variant];
    if (!conversionsField || conversionsField.value === '' || parseFloat(conversionsField.value) < 0) {
      return false;
    }

  }

  return true;
}


function setupClearAllData() {
  // Set up clear all data functionality
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', clearAllData);
  }
}

function handleNumberOfVariationsChange() {
  const numberOfVariationsField = document.getElementById('numberOfVariations');
  if (!numberOfVariationsField) return;

  const newNumVariations = parseInt(numberOfVariationsField.value);

  // Validate the number of variations
  if (isNaN(newNumVariations) || newNumVariations < 2 || newNumVariations > 5) {
    console.warn('Invalid number of variations:', newNumVariations);
    return;
  }

  // Collect current variant input values before regenerating rows
  const variants = ['A', 'B', 'C', 'D', 'E'];
  const currentValues = {};
  variants.forEach(v => {
    const visitorsField = document.getElementById(`visitors${v}`);
    const conversionsField = document.getElementById(`conversions${v}`);
    const sdField = document.getElementById(`sd${v}`);
    currentValues[v] = {
      visitors: visitorsField ? visitorsField.value : '',
      conversions: conversionsField ? conversionsField.value : '',
      sd: sdField ? sdField.value : ''
    };
  });


  // Dynamically generate variant rows based on number of variations
  generateVariantRows(newNumVariations);

  // Restore input values for existing variants
  for (let i = 0; i < newNumVariations; i++) {
    const v = variants[i];
    const visitorsField = document.getElementById(`visitors${v}`);
    const conversionsField = document.getElementById(`conversions${v}`);
    const sdField = document.getElementById(`sd${v}`);
    if (visitorsField) visitorsField.value = currentValues[v].visitors;
    if (conversionsField) conversionsField.value = currentValues[v].conversions;
    if (sdField) sdField.value = currentValues[v].sd;
  }


  // Additional logic for handling number of variations can be added here
  // For example, updating calculations, etc.
}

function generateVariantRows(numVariations) {
  const variantsTableBody = document.getElementById('variantsTableBody');
  if (!variantsTableBody) return;

  // Remove all existing variant rows (keep the comment placeholder)
  const existingRows = variantsTableBody.querySelectorAll('tr[data-variant]');
  // Skip the first row which is variant B (always present) - wait, no, I removed the hardcoded ones
  // Actually, let me remove all rows except the comment, then regenerate

  // Clear all rows after the first B row
  const rowsToRemove = Array.from(variantsTableBody.children).filter(child =>
    child.tagName === 'TR' && child.dataset.variant
  );
  rowsToRemove.forEach(row => row.remove());

  // Now generate rows for variants B through the required number
  const variantLetters = ['B', 'C', 'D', 'E'];
  const startIndex = 0; // Start from B
  const endIndex = numVariations - 1; // Subtract 1 for control variant A

  for (let i = startIndex; i < endIndex; i++) {
    const variant = variantLetters[i];
    const variantRow = document.createElement('tr');
    variantRow.setAttribute('data-variant', variant);

    variantRow.innerHTML = `
      <td class="variant-name">
        <strong>${variant}</strong>
      </td>
      <td class="data-cell-with-capture">
        <button class="capture-field-btn" data-variant="${variant}" data-field="visitors" title="Select from page" tabindex="-1">𖦏</button>
        <input type="number" id="visitors${variant}" placeholder="0" class="data-input">
      </td>
      <td class="data-cell-with-capture">
        <button class="capture-field-btn" data-variant="${variant}" data-field="conversions" title="Select from page" tabindex="-1">𖦏</button>
        <input type="number" id="conversions${variant}" placeholder="0" class="data-input">
      </td>
      <td class="conversion-rate-percent" id="rate${variant}Percent">0.000%</td>
      <td class="conversion-rate-raw" id="rate${variant}Raw">0.000000</td>
      <td class="lift-value" id="lift${variant}">-</td>
      <td class="lift-count" id="liftCount${variant}">-</td>
      <td class="additional-conversions" id="additional${variant}">-</td>
      <td class="p-value" id="pValue${variant}">-</td>
      <td class="confidence-observed" id="confidence${variant}">-</td>
      <td class="spacer-cell"></td>
    `;

    variantsTableBody.appendChild(variantRow);

    // Add event listeners for the new inputs
    setupEventListenersForVariant(variant);
  }

}

function setupEventListenersForVariant(variant) {
  // Visitors field
  const visitorsField = document.getElementById(`visitors${variant}`);
  if (visitorsField) {
    visitorsField.addEventListener('input', () => {
      updateRateDisplay(variant);
      dispatchFieldsUpdated();
    });
    visitorsField.addEventListener('change', () => {
      updateRateDisplay(variant);
      dispatchFieldsUpdated();
    });
  }

  // Conversions field
  const conversionsField = document.getElementById(`conversions${variant}`);
  if (conversionsField) {
    conversionsField.addEventListener('input', () => {
      updateRateDisplay(variant);
      dispatchFieldsUpdated();
    });
    conversionsField.addEventListener('change', () => {
      updateRateDisplay(variant);
      dispatchFieldsUpdated();
    });
  }

  // SD field
  const sdField = document.getElementById(`sd${variant}`);
  if (sdField) {
    sdField.addEventListener('input', () => {
      dispatchFieldsUpdated();
    });
    sdField.addEventListener('change', () => {
      dispatchFieldsUpdated();
    });
  }
}

function clearAllData() {
  console.log('Clearing all data to default values');

  // Clear all variant input fields (visitors and conversions) for existing variants
  const variants = ['A', 'B', 'C', 'D', 'E'];
  variants.forEach(variant => {
    const visitorsField = document.getElementById(`visitors${variant}`);
    const conversionsField = document.getElementById(`conversions${variant}`);
    const sdField = document.getElementById(`sd${variant}`);

    if (visitorsField) {
      visitorsField.value = '';
    }
    if (conversionsField) {
      conversionsField.value = '';
    }
    if (sdField) {
      sdField.value = '';
    }
  });

  // Clear test configuration inputs
  const testDuration = document.getElementById('testDuration');
  const numberOfVariations = document.getElementById('numberOfVariations');
  const confidenceLevel = document.getElementById('confidenceLevel');
  const statisticalPower = document.getElementById('statisticalPower');

  if (testDuration) {
    testDuration.value = '7'; // Default value from HTML
  }
  if (numberOfVariations) {
    numberOfVariations.value = '2'; // Default value from HTML
  }
  if (confidenceLevel) {
    confidenceLevel.value = '95'; // Default value from HTML
  }
  if (statisticalPower) {
    statisticalPower.value = '80'; // Default value from HTML
  }


  // Clear percentage calculator (handled by its own reset function)
  if (typeof resetPercentageCalculator === 'function') {
    resetPercentageCalculator();
  }

  // Radio buttons removed - always use two-tailed tests

  // Regenerate variant rows to default (2 variations)
  handleNumberOfVariationsChange();

  // Dispatch fields updated event to trigger recalculation
  dispatchFieldsUpdated();

  console.log('All data cleared successfully');
}



function setupSliderDoubleClickResets() {
  // Confidence level slider - double-click to reset to 95
  const confidenceSlider = document.getElementById('confidenceLevel');
  if (confidenceSlider) {
    confidenceSlider.addEventListener('dblclick', () => {
      confidenceSlider.value = 95;
      // Update display and trigger calculations
      updateConfidenceDisplay(95);
      dispatchFieldsUpdated();
    });
  }

  // Statistical power slider - double-click to reset to 80
  const powerSlider = document.getElementById('statisticalPower');
  if (powerSlider) {
    powerSlider.addEventListener('dblclick', () => {
      powerSlider.value = 80;
      // Update display and trigger calculations
      updatePowerDisplay(80);
      dispatchFieldsUpdated();
    });
  }

  // Number of variations slider - double-click to reset to 2
  const variationsSlider = document.getElementById('numberOfVariations');
  if (variationsSlider) {
    variationsSlider.addEventListener('dblclick', () => {
      variationsSlider.value = 2;
      // Update display and handle changes
      updateVariationsDisplay(2);
      handleNumberOfVariationsChange();
      dispatchFieldsUpdated();
    });
  }
}

// Update slider display values immediately when sliders change
function updateSliderDisplay(inputId, value) {
  switch (inputId) {
    case 'confidenceLevel':
      updateConfidenceDisplay(value);
      break;
    case 'statisticalPower':
      updatePowerDisplay(value);
      break;
    case 'numberOfVariations':
      updateVariationsDisplay(value);
      break;
  }
}

// Update Poisson dispersion display and description
function updatePoissonDispersionDisplay(sliderValue) {
  const valueDisplay = document.getElementById('poissonDispersionValue');
  const descriptionDisplay = document.querySelector('#dispersionDescription');
  
  const sliderPosition = parseInt(sliderValue);

  // Map slider positions (1-10) to specific dispersion values
  const dispersionMap = {
    1: {
      value: 1.0,
      description: "🎯 <strong>Even Distribution (φ = 1.0) - True Poisson</strong><br><em>Use when:</em> Data follows predictable patterns with minimal variation. Most users behave similarly (e.g., page views per session, checkout steps completed)."
    },
    2: {
      value: 2.0,
      description: "📊 <strong>Light Skew (φ = 2.0) - Minimal Variation</strong><br><em>Use when:</em> Slight variation exists but most users cluster around the average. Some power users but not dominant."
    },
    3: {
      value: 3.0,
      description: "📈 <strong>Moderate Skew (φ = 3.0) - Emerging Power Users</strong><br><em>Use when:</em> Clear distinction between casual and engaged users. Power users exist but don't dominate the data."
    },
    4: {
      value: 4.0,
      description: "📉 <strong>Notable Skew (φ = 4.0) - Distinct Segments</strong><br><em>Use when:</em> Multiple user segments with different behaviors. Some segments drive significantly more activity than others."
    },
    5: {
      value: 5.0,
      description: "🔥 <strong>High Skew (φ = 5.0) - Strong Bulk Buyers</strong><br><em>Use when:</em> Wide range of user behaviors. A notable portion of activity comes from power users or bulk actions."
    },
    6: {
      value: 6.0,
      description: "💥 <strong>Very High Skew (φ = 6.0) - Heavy Power Users</strong><br><em>Use when:</em> Power users dominate activity. Most users contribute little while a few contribute significantly."
    },
    7: {
      value: 7.0,
      description: "🌟 <strong>Extreme Skew (φ = 7.0) - Massive Stockpilers</strong><br><em>Use when:</em> Huge gap between casual users and power users. Commercial or business users may be present."
    },
    8: {
      value: 8.0,
      description: "⚡ <strong>Massive Skew (φ = 8.0) - Commercial Buyers</strong><br><em>Use when:</em> Extreme range with many small transactions and few very large ones. Business/commercial activity likely."
    },
    9: {
      value: 9.0,
      description: "🚀 <strong>Viral-Level Skew (φ = 9.0) - Outlier Dominated</strong><br><em>Use when:</em> Most users contribute minimally while viral effects or extreme outliers drive the majority of activity."
    },
    10: {
      value: 10.0,
      description: "💫 <strong>Maximum Skew (φ = 10.0) - Extreme Outliers</strong><br><em>Use when:</em> Tiny fraction of users or events drive nearly all activity. Consider splitting data by user segments."
    }
  };

  const config = dispersionMap[sliderPosition];

  if (valueDisplay && config) {
    valueDisplay.textContent = `φ = ${config.value.toFixed(1)}`;
  }

  if (descriptionDisplay && config) {
    descriptionDisplay.innerHTML = config.description;
  }
}

// Show/hide strictness adjustment based on number of variations
function updateStrictnessAdjustmentVisibility() {
  const numberOfVariationsField = document.getElementById('numberOfVariations');
  const strictnessGroup = document.getElementById('strictnessAdjustmentGroup');
  
  if (!numberOfVariationsField || !strictnessGroup) return;
  
  const numVariations = parseInt(numberOfVariationsField.value);
  
  // Only show strictness adjustment when 3 or more variations
  if (numVariations >= 3) {
    strictnessGroup.classList.remove('hidden');
  } else {
    strictnessGroup.classList.add('hidden');
  }
}
