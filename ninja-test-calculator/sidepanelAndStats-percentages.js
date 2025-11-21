// Ninja Test Calculator - Percentages Tab
// Contains percentage calculator functionality

// Percentage calculation functions
function calculateXY() {
  const percentX = parseFloat(document.getElementById('percentX').value);
  const valueY = parseFloat(document.getElementById('valueY').value);
  const resultElement = document.getElementById('resultXY');

  if (!isNaN(percentX) && !isNaN(valueY) && valueY !== 0) {
    const result = (percentX / 100) * valueY;
    resultElement.textContent = result.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    resultElement.textContent = '-';
  }
}

function calculatePercent() {
  const valueX = parseFloat(document.getElementById('valueX').value);
  const totalY = parseFloat(document.getElementById('totalY').value);
  const resultElement = document.getElementById('resultPercent');

  if (!isNaN(valueX) && !isNaN(totalY) && totalY !== 0) {
    const result = (valueX / totalY) * 100;
    resultElement.textContent = result.toFixed(2) + '%';
  } else {
    resultElement.textContent = '-';
  }
}

function calculateChange() {
  const originalValue = parseFloat(document.getElementById('originalValue').value);
  const newValue = parseFloat(document.getElementById('newValue').value);
  const resultElement = document.getElementById('resultChange');

  if (!isNaN(originalValue) && !isNaN(newValue) && originalValue !== 0) {
    const result = ((newValue - originalValue) / originalValue) * 100;
    const sign = result >= 0 ? '+' : '';
    resultElement.textContent = sign + result.toFixed(2) + '%';
  } else {
    resultElement.textContent = '-';
  }
}

function setupPercentageCalculator() {
  // What is X% of Y
  const percentX = document.getElementById('percentX');
  const valueY = document.getElementById('valueY');

  // X is what percent of Y
  const valueX = document.getElementById('valueX');
  const totalY = document.getElementById('totalY');

  // Percentage change from X to Y
  const originalValue = document.getElementById('originalValue');
  const newValue = document.getElementById('newValue');

  // Add event listeners for real-time calculation (no event dispatching - this tab is independent)
  if (percentX) {
    percentX.addEventListener('input', calculateXY);
  }
  if (valueY) {
    valueY.addEventListener('input', calculateXY);
  }

  if (valueX) {
    valueX.addEventListener('input', calculatePercent);
  }
  if (totalY) {
    totalY.addEventListener('input', calculatePercent);
  }

  if (originalValue) {
    originalValue.addEventListener('input', calculateChange);
  }
  if (newValue) {
    newValue.addEventListener('input', calculateChange);
  }
}

function resetPercentageCalculator() {
  // Clear percentage calculator fields
  const percentageInputs = ['percentX', 'valueY', 'valueX', 'totalY', 'originalValue', 'newValue'];
  percentageInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.value = '';
    }
  });

  // Clear percentage calculator results
  const percentageResults = ['resultXY', 'resultPercent', 'resultChange'];
  percentageResults.forEach(id => {
    const result = document.getElementById(id);
    if (result) {
      result.textContent = '-';
    }
  });
}

// Initialize percentages calculator immediately when DOM loads
// This tab is independent and doesn't rely on shared event system
document.addEventListener('DOMContentLoaded', () => {
  setupPercentageCalculator();
});
