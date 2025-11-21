// Collect DOM nodes that tests will need to update
function collectDOMNodes() {
   const variants = ['A', 'B', 'C', 'D', 'E'];

   const domNodes = {};

   // Nodes used by multiple test types (z-test, t-tests, poisson, neg-bin)
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
  if (event.detail && event.detail.tab === 'z-test') {
    const inputData = event.detail.inputData;
    const domNodes = collectDOMNodes();

    console.log('Z-Test Input Data:', inputData);
    // Run z-test calculations
    calculateZTest(inputData, domNodes);
  }
});

document.addEventListener('tabChanged', (event) => {
   // Only run calculations if this is the active tab
   if (event.detail && event.detail.tab === 'z-test') {
     const domNodes = collectDOMNodes();
     populateMethodology(domNodes);
   }
 });

function calculateZTest(inputData, domNodes) {
   const variants = Object.keys(inputData.variants);
   const controlVariant = 'A';
   const control = inputData.variants[controlVariant];
   const numTests = inputData.numberOfVariations - 1;

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

     // Calculate z-test statistics
     const result = calculateTwoProportionZTest(
       control.conversions,
       control.visitors,
       test.conversions,
       test.visitors
     );

     // Apply Bonferroni correction if strictness adjustment is enabled
     let adjustedPValue = result.pValue;
     if (inputData.strictnessAdjustment) {
       adjustedPValue = Math.min(result.pValue * numTests, 1);
     }

     // Update p-value
     if (domNodes.pValues[variant]) {
       domNodes.pValues[variant].textContent = formatPValue(adjustedPValue);
     }

     // Update confidence
     if (domNodes.confidences[variant]) {
       const confidence = (1 - adjustedPValue) * 100;
       domNodes.confidences[variant].textContent = formatConfidence(confidence);
     }
   });
  
  // Calculate and update duration and sample size
  calculateDuration(inputData, domNodes);

  // Update leading variant p-value and confidence
  updateLeadingVariantStats(inputData, domNodes, numTests);
}

function calculateTwoProportionZTest(x1, n1, x2, n2) {
  // Two-proportion z-test (always two-tailed)
  // H0: p1 = p2
  // H1: p1 ≠ p2 (two-tailed test: detects any difference)

  const p1 = x1 / n1;
  const p2 = x2 / n2;

  // Pooled proportion for null hypothesis
  const pPooled = (x1 + x2) / (n1 + n2);

  // Standard error under null hypothesis
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));

  // Z-score
  const zScore = (p2 - p1) / se;

  // Calculate p-value using jstat (always two-tailed)
  const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zScore), 0, 1));

  return {
    zScore: zScore,
    pValue: pValue,
    p1: p1,
    p2: p2,
    se: se
  };
}

function calculateConfidenceInterval(p1, n1, p2, n2, confidenceLevel) {
  // Calculate confidence interval for difference in proportions (p2 - p1)
  // Uses unpooled standard error for CI (appropriate for estimation, not hypothesis testing)
  
  const diff = p2 - p1;
  
  // Unpooled standard error for confidence interval
  const seUnpooled = Math.sqrt((p1 * (1 - p1) / n1) + (p2 * (1 - p2) / n2));
  
  // Z-score for confidence level (e.g., 1.96 for 95%)
  const zScore = jStat.normal.inv(1 - (1 - confidenceLevel / 100) / 2, 0, 1);
  
  // Margin of error
  const marginOfError = zScore * seUnpooled;
  
  // Confidence interval
  const lowerBound = diff - marginOfError;
  const upperBound = diff + marginOfError;
  
  return {
    lowerBound: lowerBound,
    upperBound: upperBound,
    diff: diff
  };
}

function calculateDuration(inputData, domNodes) {
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

   // Find the best performing variant (highest conversion rate)
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
   const p1 = control.rate;
   const p2 = inputData.variants[bestVariant].rate;
   const alpha = 1 - (inputData.confidenceLevel / 100);
   const beta = 1 - (inputData.powerLevel / 100);
   const numVariants = inputData.numberOfVariations;

   // Apply Bonferroni correction only if strictness adjustment is enabled
   const alphaAdjusted = inputData.strictnessAdjustment ? alpha / (numVariants - 1) : alpha;

   // Z-scores for alpha and beta (always two-tailed)
   const zAlpha = jStat.normal.inv(1 - alphaAdjusted / 2, 0, 1);
   const zBeta = jStat.normal.inv(1 - beta, 0, 1);

   // Calculate sample size for best variant vs control
   const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
   const denominator = Math.pow(p2 - p1, 2);
   
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
  const lift = ((p2 - p1) / p1 * 100).toFixed(0);
  const bonferroniNote = inputData.strictnessAdjustment && numVariants > 2 ? ' (Bonferroni adjusted)' : '';
  const variantInfo = numVariants > 2 ? `${numVariants} variants (best: ${bestVariant} +${lift}%)` : `${bestVariant} (+${lift}%)`;
  document.getElementById('sampleSizeSubheading').textContent = `Based on ${variantInfo}${bonferroniNote}`;
}

function updateLeadingVariantStats(inputData, domNodes, numTests) {
   // Find leading variant (highest conversion rate)
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
      const result = calculateTwoProportionZTest(
        inputData.variants[nextBest].conversions,
        inputData.variants[nextBest].visitors,
        inputData.variants['A'].conversions,
        inputData.variants['A'].visitors
      );

      // Apply Bonferroni correction if strictness adjustment is enabled
      let adjustedPValue = result.pValue;
      if (inputData.strictnessAdjustment) {
        adjustedPValue = Math.min(result.pValue * numTestsLeading, 1);
      }

      const confidence = (1 - adjustedPValue) * 100;
      domNodes.leading.leadingConfidence.textContent = formatConfidence(confidence);
      domNodes.leading.leadingPValue.textContent = formatPValue(adjustedPValue) + ' vs ' + nextBest;

      // Calculate confidence interval
      const ci = calculateConfidenceInterval(
        inputData.variants[nextBest].rate,
        inputData.variants[nextBest].visitors,
        inputData.variants['A'].rate,
        inputData.variants['A'].visitors,
        inputData.confidenceLevel
      );
      domNodes.leading.leadingConfidenceInterval.textContent = formatConfidenceInterval(ci);

      // Generate layman summary
      const summary = generateLaymanSummary(leadingVariant, nextBest, confidence, adjustedPValue, inputData.confidenceLevel);
      domNodes.leading.leadingLaymanSummary.textContent = summary;
    }
  } else {
    // Leading variant is not A, compare to A
    const result = calculateTwoProportionZTest(
      inputData.variants['A'].conversions,
      inputData.variants['A'].visitors,
      inputData.variants[leadingVariant].conversions,
      inputData.variants[leadingVariant].visitors
    );

    // Apply Bonferroni correction if strictness adjustment is enabled
    let adjustedPValue = result.pValue;
    if (inputData.strictnessAdjustment) {
      adjustedPValue = Math.min(result.pValue * numTestsLeading, 1);
    }

    const confidence = (1 - adjustedPValue) * 100;
    domNodes.leading.leadingConfidence.textContent = formatConfidence(confidence);
    domNodes.leading.leadingPValue.textContent = formatPValue(adjustedPValue) + ' vs A';

    // Calculate confidence interval
    const ci = calculateConfidenceInterval(
      inputData.variants['A'].rate,
      inputData.variants['A'].visitors,
      inputData.variants[leadingVariant].rate,
      inputData.variants[leadingVariant].visitors,
      inputData.confidenceLevel
    );
    domNodes.leading.leadingConfidenceInterval.textContent = formatConfidenceInterval(ci);

    // Generate layman summary
    const summary = generateLaymanSummary(leadingVariant, 'A', confidence, adjustedPValue, inputData.confidenceLevel);
    domNodes.leading.leadingLaymanSummary.textContent = summary;
  }
}

function generateLaymanSummary(leadingVariant, comparisonVariant, confidence, pValue, targetConfidence) {
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

function formatPValue(pValue) {
  if (isNaN(pValue) || !isFinite(pValue)) {
    return '-';
  }
  if (pValue < 0.0001) {
    return '<0.0001';
  }
  return pValue.toFixed(4);
}

function formatConfidence(confidence) {
  if (isNaN(confidence) || !isFinite(confidence)) {
    return '-';
  }
  if (confidence > 99.99) {
    return '>99.99%';
  }
  return confidence.toFixed(2) + '%';
}

function formatConfidenceInterval(ci) {
  if (!ci || isNaN(ci.lowerBound) || isNaN(ci.upperBound)) {
    return '-';
  }
  
  // Convert to percentages
  const lowerPercent = (ci.lowerBound * 100).toFixed(2);
  const upperPercent = (ci.upperBound * 100).toFixed(2);
  
  // Format with + sign for positive values
  const lowerFormatted = parseFloat(lowerPercent) >= 0 ? `+${lowerPercent}` : lowerPercent;
  const upperFormatted = parseFloat(upperPercent) >= 0 ? `+${upperPercent}` : upperPercent;
  
  return `${lowerFormatted}% to ${upperFormatted}%`;
}



function populateMethodology(domNodes) {
   const methodologyElement = domNodes ? domNodes.methodologyContent : document.getElementById('methodology-content');

   if (!methodologyElement) return;

   methodologyElement.innerHTML = `
     <div style="padding: 20px; line-height: 1.6;">
     <h4>Statistical Test: Two-Proportion Z-Test</h4>
     <p>The Z-test compares conversion rates (proportions) between two or more groups to determine if observed differences are statistically significant or likely due to random chance.</p>

     <h4>Assumptions</h4>
     <ul>
       <li><strong>Independence:</strong> Each observation (visitor) is independent and randomly assigned to variants</li>
       <li><strong>Sample Size:</strong> Large enough samples for normal approximation (np ≥ 5 and n(1-p) ≥ 5 for each group)</li>
       <li><strong>Binary Outcome:</strong> Each visitor either converts (success) or doesn't (failure)</li>
       <li><strong>Fixed Probability:</strong> Conversion probability is constant for each visitor within a variant</li>
     </ul>

     <h4>Calculation Method</h4>
     <p><strong>1. Calculate proportions:</strong></p>
     <p style="margin-left: 20px;">p₁ = conversions₁ / visitors₁ (control)<br>
     p₂ = conversions₂ / visitors₂ (variant)</p>

     <p><strong>2. Calculate pooled proportion (under null hypothesis H₀: p₁ = p₂):</strong></p>
     <p style="margin-left: 20px;">p_pooled = (conversions₁ + conversions₂) / (visitors₁ + visitors₂)</p>
     <p style="margin-left: 20px;"><em>Note: This calculator uses the pooled proportion method, which is the standard approach for hypothesis testing. Some calculators use an unpooled method (separate variances for each group), which may produce slightly different results.</em></p>

     <p><strong>3. Calculate standard error:</strong></p>
     <p style="margin-left: 20px;">SE = √[p_pooled × (1 - p_pooled) × (1/n₁ + 1/n₂)]</p>

     <p><strong>4. Calculate z-score:</strong></p>
     <p style="margin-left: 20px;">z = (p₂ - p₁) / SE</p>

     <p><strong>5. Calculate p-value:</strong></p>
     <p style="margin-left: 20px;">Two-tailed test: p-value = 2 × P(Z > |z|)</p>
     <p style="margin-left: 20px;"><em>This calculator only offers two-tailed tests as they apply to more real-world scenarios where you want to detect any difference (better or worse) rather than only testing for improvement in one direction.</em></p>

     <p><strong>6. Calculate informal confidence score:</strong></p>
     <p style="margin-left: 20px;">Informal confidence score = (1 - p-value) × 100%</p>
     <p style="margin-left: 20px;"><em>Note: This is a quick display convention (showing "1 - p-value" as a percentage) commonly used in analytics tools. It should not be confused with a formal confidence interval, which represents a range of plausible values for the true effect size.</em></p>

     <p><strong>7. Calculate confidence interval for the difference:</strong></p>
     <p style="margin-left: 20px;">CI = (p₂ - p₁) ± z_α/2 × SE_unpooled</p>
     <p style="margin-left: 20px;">Where SE_unpooled = √[(p₁(1-p₁)/n₁) + (p₂(1-p₂)/n₂)]</p>
     <p style="margin-left: 20px;"><em>Note: Unlike hypothesis testing (which uses pooled SE), confidence intervals use unpooled standard error because we're estimating the actual difference, not testing if it equals zero. A 95% confidence interval means we're 95% confident the true difference in conversion rates falls within this range. For example, [-0.07%, +2.07%] suggests the variant could perform 0.07% worse to 2.07% better than control.</em></p>

     <p><strong>Note on Multiple Comparisons (Bonferroni Correction):</strong></p>
     <p style="margin-left: 20px;">When testing multiple variants against a control, there's an increased risk of false positives (Type I errors). Bonferroni correction is a conservative method that controls the family-wise error rate by adjusting the significance threshold.</p>
     <p style="margin-left: 20px;"><strong>In this calculator:</strong> The "Enable Bonferroni Correction" checkbox controls whether correction is applied to BOTH p-values and sample size calculations:</p>
     <p style="margin-left: 30px;">• <strong>P-values:</strong> Multiplied by the number of test variants (e.g., with variants B and C, each p-value is multiplied by 2)<br>
     • <strong>Sample size alpha:</strong> Divided by the number of test variants (e.g., α/2 for 2 test variants)<br>
     • <strong>When disabled:</strong> Raw p-values are shown and standard alpha is used</p>
     <p style="margin-left: 20px;"><strong>Recommendation:</strong> Enable Bonferroni correction when testing 2+ variants against control to reduce false positive risk, especially if you plan to make decisions based on p-values. Note that this makes the test more conservative and may require larger sample sizes.</p>

     <h4>Sample Size Calculation</h4>
     <p>Required sample size per variant is calculated using power analysis based on the best-performing test variant (highest conversion rate) compared to control:</p>
     <p style="margin-left: 20px;">n = [(z_α + z_β)² × (p₁(1-p₁) + p₂(1-p₂))] / (p₂ - p₁)²</p>
     <p style="margin-left: 20px;">Where:<br>
     • z_α = critical value for significance level (α for two-tailed, or α/k if Bonferroni enabled, where k = number of test variants)<br>
     • z_β = critical value for power (1-β), representing the probability of detecting a true effect<br>
     • p₁ = control conversion rate<br>
     • p₂ = best test variant conversion rate<br>
     • The calculator uses the best variant to determine sample size because it typically has the largest effect size, requiring fewer samples to detect. Actual power may be higher for this comparison.</p>

     <h4>Why Results May Differ from Other Calculators</h4>
     <p>If you compare results with other A/B testing calculators, you may notice small differences in p-values (typically ±0.001 to 0.005). This is normal and can occur due to:</p>
     <ul>
       <li><strong>Pooled vs Unpooled Standard Error:</strong> This calculator uses the pooled proportion method (standard for hypothesis testing). Some calculators use unpooled standard errors, which treat variances separately.</li>
       <li><strong>Test Type:</strong> Chi-square tests give equivalent but computationally different results than z-tests.</li>
       <li><strong>Continuity Correction:</strong> Some calculators apply Yates' continuity correction for small samples, which adjusts for discrete data.</li>
       <li><strong>Rounding Precision:</strong> Different calculators may use different decimal precision in intermediate calculations.</li>
     </ul>
     <p><em>All these methods are valid; small differences don't affect decision-making at typical confidence thresholds (e.g., 95%).</em></p>

     <h4>Warnings & Limitations</h4>
     <ul>
       <li><strong>Sample Size:</strong> If np < 5 or n(1-p) < 5, normal approximation may be inaccurate. Consider exact tests instead.</li>
       <li><strong>Multiple Comparisons:</strong> Testing multiple variants increases false positive risk. Consider adjusting the significance level (alpha) to account for multiple testing when interpreting results.</li>
       <li><strong>Peeking:</strong> Checking results repeatedly during a test inflates Type I error rate. Pre-define test duration based on sample size calculation.</li>
       <li><strong>Minimum Detectable Effect (MDE):</strong> Sample size depends on the smallest lift you want to detect. Smaller effects require larger samples.</li>
       <li><strong>Non-binary Metrics:</strong> This test is only valid for binary outcomes (converted/didn't convert). For continuous metrics (e.g., revenue), use t-tests instead.</li>
       <li><strong>Temporal Effects:</strong> Assumes no seasonality or time-based confounding factors during test period.</li>
     </ul>

     </div>
   `;
}
