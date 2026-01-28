# Contributing to NetCDF Viewer

Thank you for your interest in contributing!
This guide will help you set up your development environment and follow our coding standards.

---

## 📁 Project Structure

```
netcdf-viewer/
├── src/
│   ├── extension.ts              # Entry point: activate/deactivate, command registration
│   ├── types.ts                  # TypeScript interfaces for NetCDF data structures
│   ├── providers/
│   │   └── NetCDFTreeProvider.ts # Tree view provider for NetCDF Explorer
│   ├── views/
│   │   ├── datasetHtmlView.ts    # HTML view for dataset structure
│   │   └── variableWebview.ts    # Chart.js webview for variable preview
│   ├── python/
│   │   └── inspector.ts          # Python script execution and dependency checks
│   ├── utils/
│   │   └── sampleSlice.ts        # Shared utility functions
│   └── test/
│       └── extension.test.ts
├── inspect_netcdf.py             # Python backend for reading NetCDF files
├── media/
│   └── chart.js                  # Chart.js library for visualizations
├── dist/                         # Webpack output (production bundle)
├── out/                          # TypeScript output (for testing)
└── .vscode-test.mjs              # Test runner configuration
```

### Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point with `activate`/`deactivate` and command registration |
| `src/types.ts` | TypeScript interfaces (`NetCDFDataset`, `NetCDFVariable`, etc.) |
| `src/providers/NetCDFTreeProvider.ts` | Tree view data provider for the NetCDF Explorer sidebar |
| `src/views/datasetHtmlView.ts` | Generates collapsible HTML view of dataset structure |
| `src/views/variableWebview.ts` | Generates variable preview with Chart.js visualization |
| `src/python/inspector.ts` | Executes Python script and checks dependencies |
| `src/utils/sampleSlice.ts` | Shared `getSampleSlice()` utility function |
| `inspect_netcdf.py` | Python script that uses xarray to extract NetCDF metadata |

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

  This runs the full test pipeline: compile, lint, type check, then execute tests via `@vscode/test-cli`.

---

## 🧹 Code Quality

- **Lint your code:**

  ```sh
  npm run lint
  ```

- **Type check:**

  ```sh
  npm run tsc
  ```

- **Format your code:**

  ```sh
  npx prettier --write "src/**/*.{ts,js,json}"
  ```

- **Pre-commit hooks:**
  We use [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to automatically lint and format staged files before each commit.

### TypeScript Guidelines

- **Use proper types:** Import and use interfaces from `src/types.ts` rather than using `any`.
- **Type guards:** Use type guard functions like `isInspectError()` for discriminated unions.
- **New interfaces:** When adding new data structures, define interfaces in `src/types.ts` with JSDoc comments.

```typescript
// Good
import { NetCDFDataset, StoredNetCDF } from './types';
const stored = context.workspaceState.get<StoredNetCDF>('lastNetCDF');

// Avoid
const stored = context.workspaceState.get<any>('lastNetCDF');
```

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
- Run `npm run tsc` to catch type errors before committing.
- If you're unsure about anything, open an issue or draft PR for discussion!

---

Thank you for helping improve NetCDF Viewer!
