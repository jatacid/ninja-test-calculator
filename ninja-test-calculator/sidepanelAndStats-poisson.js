// Collect DOM nodes that tests will need to update
function collectDOMNodesPoisson() {
   const variants = ['A', 'B', 'C', 'D', 'E'];

   const domNodes = {};

   // Nodes used by multiple test types
   domNodes.pValues = {};
   domNodes.confidences = {};
   domNodes.leading = {};

   // Collect p-value and confidence nodes for all variants (including control A)
   variants.forEach(variant => {
     domNodes.pValues[variant] = document.getElementById(`pValue${variant}`);
     domNodes.confidences[variant] = document.getElementById(`confidence${variant}`);
   });

   // Leading variant card nodes
   domNodes.leading.leadingConfidence = document.getElementById('leadingConfidence');
   domNodes.leading.leadingConfidenceInterval = document.getElementById('leadingConfidenceInterval');
   domNodes.leading.leadingPValue = document.getElementById('leadingPValue');
   domNodes.leading.leadingLaymanSummary = document.getElementById('leadingLaymanSummary');

   // Methodology accordion content node
   domNodes.methodologyContent = document.getElementById('methodology-content');

   return domNodes;
}

document.addEventListener('fieldsUpdated', (event) => {
  // Only run calculations if this is the active tab
  if (event.detail && event.detail.tab === 'poisson') {
    const inputData = event.detail.inputData;
    const domNodes = collectDOMNodesPoisson();

    console.log('Poisson Input Data:', inputData);
    // Run Poisson calculations
    calculatePoisson(inputData, domNodes);
  }
});

document.addEventListener('tabChanged', (event) => {
   // Only run calculations if this is the active tab
   if (event.detail && event.detail.tab === 'poisson') {
     const domNodes = collectDOMNodesPoisson();
     populateMethodologyPoisson(domNodes);
   }
 });

function calculatePoisson(inputData, domNodes) {
   const variants = Object.keys(inputData.variants);
   const controlVariant = 'A';
   const control = inputData.variants[controlVariant];
   const numTests = inputData.numberOfVariations - 1;

   // Get dispersion factor (φ) - map slider position to actual dispersion value
   const dispersionSlider = document.getElementById('poissonDispersion');
   const sliderPosition = dispersionSlider ? parseInt(dispersionSlider.value) : 1;
   
   // Map slider positions (1-10) to dispersion values
   const dispersionMap = {
     1: 1.0,
     2: 2.0,
     3: 3.0,
     4: 4.0,
     5: 5.0,
     6: 6.0,
     7: 7.0,
     8: 8.0,
     9: 9.0,
     10: 10.0
   };
   
   const dispersionFactor = dispersionMap[sliderPosition] || 1.0;

   // Calculate p-values and confidences for each test variant (B, C, D, E)
   variants.forEach(variant => {
     if (variant === controlVariant) {
       // Control variant displays reference values
       if (domNodes.pValues[variant]) {
         domNodes.pValues[variant].textContent = '-';
       }
       if (domNodes.confidences[variant]) {
         domNodes.confidences[variant].textContent = '-';
       }
       return;
     }

     const test = inputData.variants[variant];

     // Calculate Quasi-Poisson test statistics
     const result = calculatePoissonTest(
       control.conversions,
       control.visitors,
       test.conversions,
       test.visitors,
       dispersionFactor
     );

     // Apply Bonferroni correction if strictness adjustment is enabled
     let adjustedPValue = result.pValue;
     if (inputData.strictnessAdjustment) {
       adjustedPValue = Math.min(result.pValue * numTests, 1);
     }

     // Update p-value
     if (domNodes.pValues[variant]) {
       domNodes.pValues[variant].textContent = formatPValuePoisson(adjustedPValue);
     }

     // Update confidence
     if (domNodes.confidences[variant]) {
       const confidence = (1 - adjustedPValue) * 100;
       domNodes.confidences[variant].textContent = formatConfidencePoisson(confidence);
     }
   });
  
  // Calculate and update duration and sample size
  calculateDurationPoisson(inputData, domNodes, dispersionFactor);

  // Update leading variant p-value and confidence
  updateLeadingVariantStatsPoisson(inputData, domNodes, numTests, dispersionFactor);
}

function calculatePoissonTest(x1, n1, x2, n2, dispersionFactor) {
  // Quasi-Poisson regression test for count data (always two-tailed)
  // Handles overdispersion with dispersion factor φ
  // When φ = 1: true Poisson (variance = mean)
  // When φ > 1: overdispersed (variance = mean * φ)
  // H0: λ1 = λ2
  // H1: λ1 ≠ λ2 (two-tailed test: detects any difference)

  const lambda1 = x1 / n1; // Rate for control
  const lambda2 = x2 / n2; // Rate for test

  // For Quasi-Poisson, variance = mean * dispersion factor
  const var1 = lambda1 * dispersionFactor;
  const var2 = lambda2 * dispersionFactor;

  // Standard errors
  const se1 = Math.sqrt(var1 / n1);
  const se2 = Math.sqrt(var2 / n2);

  // Log rate ratio and its standard error
  const logRR = Math.log(lambda2 / lambda1);
  const seLogRR = Math.sqrt((se1 / lambda1) ** 2 + (se2 / lambda2) ** 2);

  // Z-score for the log rate ratio
  const zScore = logRR / seLogRR;

  // Calculate p-value using jstat (always two-tailed)
  const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zScore), 0, 1));

  return {
    zScore: zScore,
    pValue: pValue,
    lambda1: lambda1,
    lambda2: lambda2,
    rateRatio: lambda2 / lambda1,
    seLogRR: seLogRR
  };
}

function calculateConfidenceIntervalPoisson(lambda1, n1, lambda2, n2, dispersionFactor, confidenceLevel) {
  // Calculate confidence interval for rate ratio using Quasi-Poisson model (always two-tailed)

  const rr = lambda2 / lambda1;

  // For Quasi-Poisson, variance = mean * dispersion factor
  const var1 = lambda1 * dispersionFactor;
  const var2 = lambda2 * dispersionFactor;

  const se1 = Math.sqrt(var1 / n1);
  const se2 = Math.sqrt(var2 / n2);

  // Standard error of log rate ratio
  const seLogRR = Math.sqrt((se1 / lambda1) ** 2 + (se2 / lambda2) ** 2);

  const logRR = Math.log(rr);

  // Two-tailed test: calculate both bounds
  const zScore = jStat.normal.inv(1 - (1 - confidenceLevel / 100) / 2, 0, 1);

  const lowerBoundLog = logRR - zScore * seLogRR;
  const upperBoundLog = logRR + zScore * seLogRR;

  const lowerBound = Math.exp(lowerBoundLog);
  const upperBound = Math.exp(upperBoundLog);

  const lowerPercent = (lowerBound - 1) * 100;
  const upperPercent = (upperBound - 1) * 100;

  return {
    lowerBound: lowerPercent / 100,
    upperBound: upperPercent / 100,
    rateRatio: rr,
    oneTailed: false
  };
}

function calculateDurationPoisson(inputData, domNodes, dispersionFactor) {
   const control = inputData.variants['A'];
   const variants = Object.keys(inputData.variants).filter(v => v !== 'A');

   if (variants.length === 0) {
     // No variants to compare
     if (domNodes) {
       document.getElementById('totalDuration').textContent = '-';
       document.getElementById('remainingDays').textContent = '-';
       document.getElementById('sampleSizeSubheading').textContent = '-';
     }
     return;
   }

   // Find the best performing variant (highest rate)
   let bestVariant = variants[0];
   let highestRate = inputData.variants[variants[0]].rate;
   
   variants.forEach(variant => {
     const rate = inputData.variants[variant].rate;
     if (rate > highestRate) {
       highestRate = rate;
       bestVariant = variant;
     }
   });

   // Calculate required sample size using power analysis for the best variant
   const lambda1 = control.rate;
   const lambda2 = inputData.variants[bestVariant].rate;
   const alpha = 1 - (inputData.confidenceLevel / 100);
   const beta = 1 - (inputData.powerLevel / 100);
   const numVariants = inputData.numberOfVariations;

   // Apply Bonferroni correction only if strictness adjustment is enabled
   const alphaAdjusted = inputData.strictnessAdjustment ? alpha / (numVariants - 1) : alpha;

   // Z-scores for alpha and beta (always two-tailed)
   const zAlpha = jStat.normal.inv(1 - alphaAdjusted / 2, 0, 1);
   const zBeta = jStat.normal.inv(1 - beta, 0, 1);

   // For Quasi-Poisson, variance = mean * dispersion factor
   const var1 = lambda1 * dispersionFactor;
   const var2 = lambda2 * dispersionFactor;
   
   // Effect size on log scale
   const logRR = Math.log(lambda2 / lambda1);
   
   // Sample size per group for Poisson
   const numerator = Math.pow(zAlpha + zBeta, 2) * (var1 / (lambda1 * lambda1) + var2 / (lambda2 * lambda2));
   const denominator = Math.pow(logRR, 2);
   
   if (denominator === 0) {
     // Same rate, no difference to detect
     if (domNodes) {
       document.getElementById('totalDuration').textContent = '-';
       document.getElementById('remainingDays').textContent = '-';
       document.getElementById('sampleSizeSubheading').textContent = '-';
     }
     return;
   }

   const sampleSizePerVariant = Math.ceil(numerator / denominator);

  // Calculate current sample size per variant (average across all variants)
  let totalVisitors = 0;
  Object.keys(inputData.variants).forEach(v => {
    totalVisitors += inputData.variants[v].visitors;
  });
  const avgVisitorsPerVariant = totalVisitors / numVariants;
  const trafficPerVariantPerDay = avgVisitorsPerVariant / inputData.daysOfData;

  // Calculate duration needed
  const daysNeeded = Math.ceil(sampleSizePerVariant / trafficPerVariantPerDay);
  const remainingDays = Math.max(0, daysNeeded - inputData.daysOfData);

  // Update DOM
  document.getElementById('exactSampleSize').textContent = sampleSizePerVariant.toLocaleString();
  document.getElementById('totalDuration').textContent = daysNeeded.toLocaleString();
  document.getElementById('remainingDays').textContent = remainingDays.toLocaleString();
  
  // Build explanation of sample size calculation
  const lift = ((lambda2 - lambda1) / lambda1 * 100).toFixed(0);
  const bonferroniNote = inputData.strictnessAdjustment && numVariants > 2 ? ' (Bonferroni adjusted)' : '';
  const variantInfo = numVariants > 2 ? `${numVariants} variants (best: ${bestVariant} +${lift}%)` : `${bestVariant} (+${lift}%)`;
  document.getElementById('sampleSizeSubheading').textContent = `Based on ${variantInfo}${bonferroniNote}`;
}

function updateLeadingVariantStatsPoisson(inputData, domNodes, numTests, dispersionFactor) {
   // Find leading variant (highest rate)
   const variants = Object.keys(inputData.variants);
   let leadingVariant = null;
   let highestRate = -1;

   variants.forEach(v => {
     const rate = inputData.variants[v].rate;
     if (rate > highestRate) {
       highestRate = rate;
       leadingVariant = v;
     }
   });

   if (!leadingVariant) return;

   const numTestsLeading = numTests;

  // Calculate stats for leading variant
  if (leadingVariant === 'A') {
    // If A is leading, compare to next best
    let nextBest = null;
    let nextRate = -1;

    variants.forEach(v => {
      if (v !== 'A') {
        const rate = inputData.variants[v].rate;
        if (rate > nextRate) {
          nextRate = rate;
          nextBest = v;
        }
      }
    });

    if (nextBest) {
      const result = calculatePoissonTest(
        inputData.variants['A'].conversions,
        inputData.variants['A'].visitors,
        inputData.variants[nextBest].conversions,
        inputData.variants[nextBest].visitors,
        dispersionFactor
      );

      // Apply Bonferroni correction if strictness adjustment is enabled
      let adjustedPValue = result.pValue;
      if (inputData.strictnessAdjustment) {
        adjustedPValue = Math.min(result.pValue * numTestsLeading, 1);
      }

      const confidence = (1 - adjustedPValue) * 100;
      domNodes.leading.leadingConfidence.textContent = formatConfidencePoisson(confidence);
      domNodes.leading.leadingPValue.textContent = formatPValuePoisson(adjustedPValue) + ' vs ' + nextBest;

      // Calculate confidence interval
      const ci = calculateConfidenceIntervalPoisson(
        inputData.variants['A'].rate,
        inputData.variants['A'].visitors,
        inputData.variants[nextBest].rate,
        inputData.variants[nextBest].visitors,
        dispersionFactor,
        inputData.confidenceLevel
      );
      domNodes.leading.leadingConfidenceInterval.textContent = formatConfidenceIntervalPoisson(ci, inputData.confidenceLevel);

      // Generate layman summary
      const summary = generateLaymanSummaryPoisson(leadingVariant, nextBest, confidence, adjustedPValue, inputData.confidenceLevel);
      domNodes.leading.leadingLaymanSummary.textContent = summary;
    }
  } else {
    // Leading variant is not A, compare to A
    const result = calculatePoissonTest(
      inputData.variants['A'].conversions,
      inputData.variants['A'].visitors,
      inputData.variants[leadingVariant].conversions,
      inputData.variants[leadingVariant].visitors,
      dispersionFactor
    );

    // Apply Bonferroni correction if strictness adjustment is enabled
    let adjustedPValue = result.pValue;
    if (inputData.strictnessAdjustment) {
      adjustedPValue = Math.min(result.pValue * numTestsLeading, 1);
    }

    const confidence = (1 - adjustedPValue) * 100;
    domNodes.leading.leadingConfidence.textContent = formatConfidencePoisson(confidence);
    domNodes.leading.leadingPValue.textContent = formatPValuePoisson(adjustedPValue) + ' vs A';

    // Calculate confidence interval
    const ci = calculateConfidenceIntervalPoisson(
      inputData.variants['A'].rate,
      inputData.variants['A'].visitors,
      inputData.variants[leadingVariant].rate,
      inputData.variants[leadingVariant].visitors,
      dispersionFactor,
      inputData.confidenceLevel
    );
    domNodes.leading.leadingConfidenceInterval.textContent = formatConfidenceIntervalPoisson(ci, inputData.confidenceLevel);

    // Generate layman summary
    const summary = generateLaymanSummaryPoisson(leadingVariant, 'A', confidence, adjustedPValue, inputData.confidenceLevel);
    domNodes.leading.leadingLaymanSummary.textContent = summary;
  }
}

function generateLaymanSummaryPoisson(leadingVariant, comparisonVariant, confidence, pValue, targetConfidence) {
  // Convert p-value to percentage for easier interpretation
  const chanceOfRandomness = (pValue * 100).toFixed(1);
  
  if (confidence >= targetConfidence) {
    return `Variant ${leadingVariant} vs ${comparisonVariant}: The observed difference has only a ${chanceOfRandomness}% likelihood of being due to random chance. This meets your ${targetConfidence}% confidence threshold.`;
  } else if (confidence >= targetConfidence - 5) {
    return `Variant ${leadingVariant} vs ${comparisonVariant}: There's a ${chanceOfRandomness}% likelihood this difference is due to random chance. Very close to your ${targetConfidence}% threshold - consider collecting more data.`;
  } else if (confidence >= targetConfidence - 15) {
    return `Variant ${leadingVariant} vs ${comparisonVariant}: There's a ${chanceOfRandomness}% likelihood this difference is due to random chance. Some evidence of a difference, but not yet conclusive at your ${targetConfidence}% threshold.`;
  } else {
    return `Variant ${leadingVariant} vs ${comparisonVariant}: There's a ${chanceOfRandomness}% likelihood this difference is due to random chance. Insufficient evidence of a meaningful difference at your ${targetConfidence}% confidence level.`;
  }
}

function formatPValuePoisson(pValue) {
  if (isNaN(pValue) || !isFinite(pValue)) {
    return '-';
  }
  if (pValue < 0.0001) {
    return '<0.0001';
  }
  return pValue.toFixed(4);
}

function formatConfidencePoisson(confidence) {
  if (isNaN(confidence) || !isFinite(confidence)) {
    return '-';
  }
  if (confidence > 99.99) {
    return '>99.99%';
  }
  return confidence.toFixed(2) + '%';
}

function formatConfidenceIntervalPoisson(ci, confidenceLevel) {
  if (!ci || isNaN(ci.lowerBound) || isNaN(ci.upperBound)) {
    return '-';
  }

  // Always two-tailed: show interval
  const lowerPercent = (ci.lowerBound * 100).toFixed(2);
  const upperPercent = (ci.upperBound * 100).toFixed(2);

  const lowerFormatted = parseFloat(lowerPercent) >= 0 ? `+${lowerPercent}` : lowerPercent;
  const upperFormatted = parseFloat(upperPercent) >= 0 ? `+${upperPercent}` : upperPercent;

  return `${lowerFormatted}% to ${upperFormatted}%`;
}

function populateMethodologyPoisson(domNodes) {
   const methodologyElement = domNodes ? domNodes.methodologyContent : document.getElementById('methodology-content');

   if (!methodologyElement) return;

   methodologyElement.innerHTML = `
     <div style="padding: 20px; line-height: 1.6;">
     <h4>Statistical Test: Quasi-Poisson Regression (Poisson with Dispersion)</h4>
     <p>This test uses a Quasi-Poisson model to analyze count data with adjustable dispersion. When dispersion = 1.0, it's a true Poisson test (variance = mean). When dispersion > 1.0, it handles overdispersed count data where variance exceeds the mean, similar to Negative Binomial but with manual dispersion control.</p>

     <h4>The Dispersion Factor (φ)</h4>
     <p>The dispersion factor φ (phi) adjusts for overdispersion in count data. When φ = 1.0, it's a true Poisson distribution (variance = mean). When φ > 1.0, it handles overdispersed data where variance exceeds the mean.</p>

     <h5>How to Choose the Right Dispersion Factor</h5>
     <p><strong>φ = 1.0 (True Poisson):</strong> Use for consistent, predictable count data where most observations follow similar patterns.</p>
     <p><strong>φ = 2.0-3.0 (Light to Moderate Overdispersion):</strong> Use when there's some variation but most users behave similarly.</p>
     <p><strong>φ = 4.0-6.0 (High Overdispersion):</strong> Use when power users or bulk behaviors create notable variation in your data.</p>
     <p><strong>φ = 7.0-10.0 (Extreme Overdispersion):</strong> Use when a small fraction of users drive most activity, creating highly skewed distributions.</p>

     <h5>When to Split Your Data Set</h5>
     <p>If your data shows extreme dispersion (φ ≥ 7.0), consider whether you have mixed user segments that should be analyzed separately:</p>
     <ul>
       <li><strong>Business vs Consumer users:</strong> Commercial buyers often behave differently than individual consumers</li>
       <li><strong>Power users vs Casual users:</strong> Heavy users may respond differently to changes than light users</li>
       <li><strong>New vs Returning users:</strong> User experience may differ by familiarity with your product</li>
       <li><strong>Different traffic sources:</strong> Users from different channels may have different behavior patterns</li>
     </ul>
     <p>Splitting data can provide more accurate insights but requires sufficient sample size in each segment.</p>

     <h4>When to Use This Test</h4>
     <ul>
       <li><strong>Count Data:</strong> Your metric counts events (page views, clicks, items, tickets)</li>
       <li><strong>Adjustable Variance:</strong> You can estimate or calculate the variance-to-mean ratio</li>
       <li><strong>φ = 1.0:</strong> Use for consistent rates (page views per session, checkout steps)</li>
       <li><strong>φ > 1.0:</strong> Use for skewed data with power users (items per cart, support tickets)</li>
     </ul>

     <h4>Assumptions</h4>
     <ul>
       <li><strong>Independence:</strong> Each observation (user/session) is independent</li>
       <li><strong>Count Data:</strong> The outcome is a non-negative integer count</li>
       <li><strong>Constant Dispersion:</strong> The dispersion factor φ is constant across groups</li>
       <li><strong>Log-linear relationship:</strong> The logarithm of the expected count is linearly related to predictors</li>
     </ul>

     <h4>Calculation Method</h4>
     <p><strong>1. Calculate rates (λ):</strong></p>
     <p style="margin-left: 20px;">λ₁ = total_events₁ / users₁ (control)<br>
     λ₂ = total_events₂ / users₂ (variant)</p>

     <p><strong>2. Calculate variances using Quasi-Poisson model:</strong></p>
     <p style="margin-left: 20px;">Var₁ = λ₁ × φ<br>
     Var₂ = λ₂ × φ<br>
     Where φ is the dispersion factor (1.0 for true Poisson, >1.0 for overdispersion)</p>

     <p><strong>3. Calculate standard errors:</strong></p>
     <p style="margin-left: 20px;">SE₁ = √(Var₁/n₁) = √(λ₁ × φ / n₁)<br>
     SE₂ = √(Var₂/n₂) = √(λ₂ × φ / n₂)</p>

     <p><strong>4. Calculate log rate ratio and its standard error:</strong></p>
     <p style="margin-left: 20px;">log(RR) = log(λ₂/λ₁)<br>
     SE_log(RR) = √[(SE₁/λ₁)² + (SE₂/λ₂)²]</p>

     <p><strong>5. Calculate z-score:</strong></p>
     <p style="margin-left: 20px;">z = log(RR) / SE_log(RR)</p>

     <p><strong>6. Calculate p-value:</strong></p>
     <p style="margin-left: 20px;">Two-tailed test: p-value = 2 × P(Z > |z|)</p>
     <p style="margin-left: 20px;"><em>This calculator only offers two-tailed tests as they apply to more real-world scenarios where you want to detect any difference (better or worse) rather than only testing for improvement in one direction.</em></p>

     <p><strong>7. Calculate confidence interval for the rate ratio:</strong></p>
     <p style="margin-left: 20px;">CI_log = log(RR) ± z_α/2 × SE_log(RR)<br>
     CI = [exp(CI_log_lower) - 1, exp(CI_log_upper) - 1]</p>
     <p style="margin-left: 20px;"><em>Note: The confidence interval represents the range of plausible percentage changes in the event rate.</em></p>

     <p><strong>Note on Multiple Comparisons (Bonferroni Correction):</strong></p>
     <p style="margin-left: 20px;">When testing multiple variants, enable the strictness adjustment to apply Bonferroni correction to both p-values (multiplied by number of test variants) and sample size calculations (alpha divided by number of test variants).</p>

     <h4>Sample Size Calculation</h4>
     <p>Required sample size per variant is calculated using power analysis:</p>
     <p style="margin-left: 20px;">n = [(z_α + z_β)² × (Var₁/λ₁² + Var₂/λ₂²)] / [log(λ₂/λ₁)]²</p>
     <p style="margin-left: 20px;">Where:<br>
     • Var = λ × φ (variance adjusted by dispersion factor)<br>
     • Higher φ values require larger sample sizes due to increased variance<br>
     • z_α and z_β are critical values for significance and power</p>



     <h4>Quasi-Poisson vs. Negative Binomial vs. Z-Test</h4>
     <ul>
       <li><strong>Quasi-Poisson:</strong> Count data when you can estimate dispersion from aggregate data or domain knowledge. Good when you only have totals from analytics tools.</li>
       <li><strong>Negative Binomial:</strong> Count data when you have individual-level data to calculate exact dispersion. More accurate but requires raw data export.</li>
       <li><strong>Z-Test:</strong> Binary outcomes only (yes/no, did/didn't), not counts.</li>
     </ul>

     <h4>Common Ecommerce Metrics by Dispersion Level</h4>
     <ul>
       <li><strong>φ = 1.0-2.0 (Consistent):</strong> Page views per session, checkout steps completed, product categories browsed - most users follow similar patterns</li>
       <li><strong>φ = 3.0-4.0 (Moderate Skew):</strong> Items per cart at standard retailers, product searches per session, filters applied - clear casual vs engaged split</li>
       <li><strong>φ = 5.0-6.0 (High Skew):</strong> Grocery items per cart, wishlist additions, weekly repeat orders - strong bulk buyer segment</li>
       <li><strong>φ = 7.0-8.0 (Very High Skew):</strong> Support tickets per customer, product returns, restaurant/business supply orders - commercial buyers creating outliers</li>
       <li><strong>φ = 9.0-10.0 (Extreme Skew):</strong> Social shares per product, reviews written, wholesale orders - tiny fraction (often <5%) drives majority of activity</li>
     </ul>

     <h4>Warnings & Limitations</h4>
     <ul>
       <li><strong>Dispersion Selection:</strong> Incorrect φ can lead to wrong conclusions. If possible, calculate from actual variance rather than estimating.</li>
       <li><strong>Sample Size Impact:</strong> Higher φ dramatically increases required sample size (φ = 10.0 needs 10× more data than φ = 1.0).</li>
       <li><strong>Estimation Uncertainty:</strong> When estimating φ from aggregate data, results are approximate. For critical decisions, try to obtain individual-level data.</li>
       <li><strong>Zero Inflation:</strong> If most users have zero counts (70%+), this test may not be appropriate.</li>
       <li><strong>Independence:</strong> Each user/session must be independent.</li>
       <li><strong>Count Data Only:</strong> Only for non-negative integer counts, not continuous metrics or binary outcomes.</li>
     </ul>

     </div>
   `;
}
