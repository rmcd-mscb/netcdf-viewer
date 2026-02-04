# NetCDF Viewer - VS Code Extension

A VS Code extension for viewing NetCDF files and their metadata using Python (xarray/netCDF4).

## Commands

```bash
npm run compile     # Build extension (webpack production)
npm run watch       # Build in watch mode (development)
npm run lint        # Run ESLint
npm run tsc         # TypeScript type checking
npm run pretest     # compile + lint + tsc
npm run test        # Run tests
```

## Testing the Extension

Press **F5** in VS Code to launch the Extension Development Host. The extension runs in that new window, not the original.

## Architecture

```
src/
├── extension.ts              # Entry point, command registration
├── types.ts                  # TypeScript interfaces
├── providers/
│   └── NetCDFTreeProvider.ts # Tree view data provider
├── views/
│   ├── datasetHtmlView.ts    # HTML webview for dataset display
│   └── variableWebview.ts    # Variable-specific webview
├── python/
│   └── inspector.ts          # Python script execution
├── utils/
│   ├── escapeHtml.ts         # HTML escaping utility
│   └── sampleSlice.ts        # Sample slice notation utility
└── test/
    └── extension.test.ts     # Tests
```

## Code Style

- TypeScript with ES modules
- ESLint with `@typescript-eslint` rules
- Prettier for formatting
- Use curly braces for all control structures
- Semicolons required
- camelCase for imports

## Key Patterns

- **Webviews**: Use VS Code CSS variables (`--vscode-foreground`, etc.) for theme compatibility
- **Python interaction**: Via `child_process.execFile` in `inspector.ts`
- **Configuration**: Access via `vscode.workspace.getConfiguration('netcdfViewer')`
- **Tree views**: Implement `vscode.TreeDataProvider` interface

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/<description>`
- Commits should be atomic and well-described
- Use conventional commit style when appropriate

## Related Files

- `inspect_netcdf.py` - Python script for reading NetCDF files
- `package.json` - Extension manifest and contribution points
- `webpack.config.js` - Build configuration

## Planned Features

- **CF Compliance Checker** - See `docs/cf-compliance-checker.md` and issue #14
