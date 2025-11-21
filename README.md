# Ninja Test Calculator

A powerful Chrome Extension for A/B testing analysis, statistical significance, and metric evaluation. Designed for data ninjas and experimentation lovers who want to validate their results quickly and accurately.

## 🌐 Landing Page
Visit our official landing page to find the right statistical test for your data:
[**Ninja Test Calculator Landing Page**](https://jatacid.github.io/ninja-test-calculator/)

## 🚀 Features

- **Comprehensive Statistical Tests**:
  - **Z-Test**: Perfect for binary metrics like conversion rates (Yes/No data).
  - **Poisson Test**: Ideal for count data (e.g., clicks, purchases) that is evenly distributed.
  - **Quasi-Poisson Test**: Designed for skewed count data (e.g., power users, viral content).
- **Percentage Calculator**: Quickly calculate percentage changes, increases, and decreases without leaving the tool.
- **Smart Data Capture**: Point-and-click functionality to capture data directly from your webpage (powered by Tesseract OCR).
- **Side Panel Integration**: Works seamlessly alongside your browsing experience in the Chrome Side Panel.

## 📥 Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jatacid/ninja-test-calculator.git
   ```
2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions/` in your browser.
   - Enable **Developer mode** in the top right corner.
3. **Load Unpacked**:
   - Click **Load unpacked**.
   - Select the `ninja-test-calculator` directory (the folder containing `manifest.json`) from the cloned repository.
4. **Pin & Play**:
   - Pin the extension to your toolbar for easy access.
   - Click the icon to open the side panel.

## 🛠 Usage

1. **Open the Side Panel**: Click the Ninja Test Calculator icon in your browser toolbar.
2. **Choose Your Test**: Use the navigation tabs to select the appropriate statistical test (Z-Test, Poisson, etc.) or utility.
3. **Input Data**:
   - Manually enter your Control and Variant data (Visitors, Conversions, etc.).
   - Use the "Capture" buttons (if applicable) to select numbers directly from your active webpage.
4. **Analyze**: Instantly see your Confidence Level, Test Statistic, and P-Value.
5. **Interpret**: The tool provides clear "Significant" or "Not Significant" results based on your confidence threshold (e.g., 90%, 95%, 99%).

## 📄 License

**Apache License 2.0**

Copyright 2025 jatacid

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
