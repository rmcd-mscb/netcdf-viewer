# Contributing to NetCDF Viewer

Thank you for your interest in contributing!  
This guide will help you set up your development environment and follow our coding standards.

---

## 🚀 Getting Started

1. **Clone the repository:**

   ```sh
   git clone https://github.com/YOUR-USERNAME/netcdf-viewer.git
   cd netcdf-viewer
   ```

2. **Install dependencies:**

   ```sh
   npm install
   npx husky install
   ```

3. **Install Python dependencies (for NetCDF inspection):**
   - Ensure you have Python 3.x installed.
   - Install [xarray](https://xarray.dev/), [netCDF4](https://unidata.github.io/netcdf4-python/), and [numpy](https://numpy.org/):

     ```sh
     conda env create -f environment.yml
     conda activate netcdf-viewer
     ```

---

## 🛠️ Development Workflow

- **Build the extension:**

  ```sh
  npm run compile
  ```

- **Run the extension in VS Code:**

  1. Press `F5` in VS Code to launch a new Extension Development Host.
  2. Use the Command Palette (`Ctrl+Shift+P`) to find and run your extension commands.

- **Run tests:**

  ```sh
  npm test
  ```

  or

  ```sh
  npx @vscode/test-cli --extensionDevelopmentPath=. --extensionTestsPath=./out/test/index.js
  ```

---

## 🧹 Code Quality

- **Lint your code:**

  ```sh
  npm run lint
  ```

- **Format your code:**

  ```sh
  npx prettier --write "src/**/*.{ts,js,json}"
  ```

- **Pre-commit hooks:**  
  We use [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to automatically lint and format staged files before each commit.

---

## 📝 Making a Contribution

1. **Create a new branch:**

   ```sh
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**

   ```sh
   git add .
   git commit -m "Describe your change"
   ```

3. **Push your branch and open a Pull Request:**

   ```sh
   git push origin feature/your-feature-name
   ```

---

## 💡 Tips

- Keep your changes focused and well-documented.
- Write or update tests for new features or bug fixes.
- If you’re unsure about anything, open an issue or draft PR for discussion!

---

Thank you for helping improve NetCDF Viewer!
