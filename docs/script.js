document.addEventListener('DOMContentLoaded', () => {
  // Decision Tree Filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');

      cards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.classList.remove('hidden');
          card.style.opacity = '0';
          setTimeout(() => { card.style.opacity = '1'; }, 50);
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // Wizard Logic (Sequential Yes/No & Filtering)
  const startWizardBtn = document.getElementById('startWizardBtn');
  const wizardContainer = document.getElementById('inSituWizard');
  const decisionContainer = document.querySelector('.decision-container');

  // Helper to filter cards based on criteria
  function filterCards(criteria, action = 'show') {
    cards.forEach(card => {
      const category = card.getAttribute('data-category');
      const title = card.querySelector('h3').textContent.toLowerCase();
      
      let match = false;
      // Logic for "hiding" specific categories based on "No" answers
      if (action === 'hide') {
        if (criteria === 'binary' && category === 'binary') match = true;
        if (criteria === 'counts' && category === 'counts') match = true;
        if (criteria === 'averages' && category === 'averages') match = true;
      } else {
        // Logic for "showing" specific cards based on "Yes" answers (Result)
        if (criteria === 'all') match = true;
        else if (criteria === 'z_test') match = category === 'binary';
        else if (criteria === 'quasi_poisson') match = title.includes('counts (skewed)');
        else if (criteria === 'poisson') match = title.includes('counts (even)');
        else if (criteria === 'welch') match = title.includes('average (skewed)');
        else if (criteria === 'student') match = title.includes('average (normal)');
        else if (criteria === 'mann_whitney') match = title.includes('ranked/ordinal');
        else if (criteria === 'chi_square') match = title.includes('categorical');
        else if (criteria === 'bootstrap') match = title.includes('assumption-free');
      }

      if (action === 'hide') {
        if (match) {
          card.classList.add('hidden');
          card.style.opacity = '0';
        }
      } else {
        if (match) {
          card.classList.remove('hidden');
          card.style.opacity = '1';
        } else {
          card.classList.add('hidden');
          card.style.opacity = '0';
        }
      }
    });
  }

  const wizardSteps = {
    start: {
      question: "Is your data Binary (Yes/No)?",
      explanation: "Binary data has only two possible outcomes, like 'Converted/Not Converted', 'Clicked/Did Not Click', or 'Success/Fail'.",
      options: [
        { text: "Yes", next: "binary_result", action: () => filterCards('z_test', 'show') },
        { text: "No", next: "counts_check", action: () => filterCards('binary', 'hide') }
      ]
    },
    binary_result: {
      message: "For binary data, the Z-Test is your best bet.",
      reset: true
    },
    counts_check: {
      question: "Is your data Counts (Numbers)?",
      explanation: "Count data represents the number of times an event happens, like '5 purchases', '10 clicks', or '3 errors'. It's always a whole number.",
      options: [
        { text: "Yes", next: "counts_dist", action: () => {} }, // Don't hide yet, need to refine
        { text: "No", next: "averages_check", action: () => filterCards('counts', 'hide') }
      ]
    },
    counts_dist: {
      question: "How is the data distributed?",
      explanation: "Is it 'Skewed' (e.g., a few power users with many actions) or 'Evenly Distributed' (predictable patterns)?",
      options: [
        { text: "Skewed (Power Users)", next: "quasi_poisson_result", action: () => filterCards('quasi_poisson', 'show') },
        { text: "Evenly Distributed", next: "poisson_result", action: () => filterCards('poisson', 'show') }
      ]
    },
    quasi_poisson_result: {
      message: "For skewed count data, use the Quasi-Poisson Test.",
      reset: true
    },
    poisson_result: {
      message: "For evenly distributed count data, use the Poisson Test.",
      reset: true
    },
    averages_check: {
      question: "Is your data Averages (Continuous)?",
      explanation: "Continuous data can be any value, including decimals. Examples: 'Average Order Value ($50.25)', 'Time on Site (120.5s)'.",
      options: [
        { text: "Yes", next: "averages_outliers", action: () => {} },
        { text: "No", next: "other_check", action: () => filterCards('averages', 'hide') }
      ]
    },
    averages_outliers: {
      question: "Are there outliers in your data?",
      explanation: "Outliers are extreme values that differ significantly from other observations (e.g., one huge order in a sea of small ones).",
      options: [
        { text: "Yes (Skewed)", next: "welch_result", action: () => filterCards('welch', 'show') },
        { text: "No (Normal)", next: "student_result", action: () => filterCards('student', 'show') }
      ]
    },
    welch_result: {
      message: "Welch's T-Test handles outliers and unequal variances best.",
      reset: true
    },
    student_result: {
      message: "Student's T-Test is ideal for normal distributions.",
      reset: true
    },
    other_check: {
      question: "Is your data Ranked or Categorical?",
      explanation: "Ranked: 1st, 2nd, 3rd. Categorical: Red, Blue, Green (more than 2 categories).",
      options: [
        { text: "Yes", next: "other_type", action: () => {} },
        { text: "No", next: "bootstrap_result", action: () => filterCards('bootstrap', 'show') } // Fallback to bootstrap
      ]
    },
    other_type: {
      question: "Which specific type?",
      explanation: "Ranked/Ordinal (e.g., Star Ratings) or Categorical (e.g., Product Categories).",
      options: [
        { text: "Ranked / Ordinal", next: "mann_whitney_result", action: () => filterCards('mann_whitney', 'show') },
        { text: "Categorical (3+)", next: "chi_square_result", action: () => filterCards('chi_square', 'show') }
      ]
    },
    mann_whitney_result: {
      message: "Mann-Whitney U is perfect for ranked or ordinal data.",
      reset: true
    },
    chi_square_result: {
      message: "Chi-Square tests differences across multiple categories.",
      reset: true
    },
    bootstrap_result: {
      message: "For complex or unknown distributions, use Bootstrap methods.",
      reset: true
    }
  };

  function renderWizardStep(stepKey) {
    const step = wizardSteps[stepKey];
    wizardContainer.innerHTML = '';

    const stepDiv = document.createElement('div');
    stepDiv.className = 'wizard-step';

    if (step.question) {
      const h3 = document.createElement('h3');
      h3.textContent = step.question;
      stepDiv.appendChild(h3);

      if (step.explanation) {
        const p = document.createElement('p');
        p.className = 'wizard-explanation';
        p.textContent = step.explanation;
        stepDiv.appendChild(p);
      }

      const optionsDiv = document.createElement('div');
      optionsDiv.className = 'wizard-options-inline';
      step.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn secondary-btn wizard-btn-inline';
        btn.textContent = opt.text;
        btn.onclick = () => {
          if (opt.action) opt.action();
          renderWizardStep(opt.next);
        };
        optionsDiv.appendChild(btn);
      });
      stepDiv.appendChild(optionsDiv);
    } else if (step.message) {
      const p = document.createElement('p');
      p.className = 'wizard-message';
      p.textContent = step.message;
      stepDiv.appendChild(p);

      if (step.reset) {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn primary-btn wizard-reset-btn';
        resetBtn.textContent = 'Start Over';
        resetBtn.onclick = () => {
          filterCards('all', 'show');
          wizardContainer.classList.add('hidden');
          startWizardBtn.classList.remove('hidden');
          filterBtns.forEach(b => b.classList.remove('active'));
          document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
        };
        stepDiv.appendChild(resetBtn);
      }
    }

    wizardContainer.appendChild(stepDiv);
  }

  startWizardBtn.addEventListener('click', () => {
    startWizardBtn.classList.add('hidden');
    wizardContainer.classList.remove('hidden');
    renderWizardStep('start');
    filterCards('all', 'show'); // Reset to show all initially
    filterBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  });
});

