import * as path from 'path';
import * as vscode from 'vscode';
import { NetCDFDataset, StoredNetCDF } from '../types';
import { getSampleSlice } from '../utils/sampleSlice';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Opens a webview to display the entire dataset as an HTML table with collapsible sections.
 *
 * @param context - VS Code extension context
 * @param dataset - The NetCDF dataset to display
 */
export function showDatasetHtmlView(context: vscode.ExtensionContext, dataset: NetCDFDataset): void {
  const stored = context.workspaceState.get<StoredNetCDF>('lastNetCDF');
  const fileName = stored?.uri ? path.basename(stored.uri.fsPath) : 'NetCDF File';

  const panel = vscode.window.createWebviewPanel(
    'netcdfHtmlView',
    fileName,
    vscode.ViewColumn.One,
    { enableScripts: false }
  );

  panel.webview.html = getDatasetHtml(panel.webview, dataset, fileName);
}

/** CSS styles using VS Code theme variables for proper light/dark theme support */
const CSS_STYLES = `
  :root {
    --indent-size: 12px;
  }
  body {
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    padding: 16px;
    line-height: 1.5;
  }
  h1 {
    color: var(--vscode-foreground);
    font-size: 1.4em;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 8px;
  }
  details {
    margin-bottom: 2px;
  }
  summary {
    cursor: pointer;
    padding: 2px 0;
  }
  summary:hover {
    background-color: var(--vscode-list-hoverBackground);
  }
  .section-header {
    font-weight: bold;
    color: var(--vscode-textLink-foreground);
  }
  .file-header {
    font-size: 1.1em;
    font-weight: bold;
  }
  .var-name {
    color: var(--vscode-symbolIcon-variableForeground, var(--vscode-foreground));
    font-weight: 600;
  }
  .attr-name {
    color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe);
  }
  .key {
    color: var(--vscode-foreground);
  }
  .val {
    color: var(--vscode-debugTokenExpression-string, #ce9178);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .val-number {
    color: var(--vscode-debugTokenExpression-number, #b5cea8);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .val-null {
    color: var(--vscode-debugTokenExpression-name, #569cd6);
    font-style: italic;
  }
  .index {
    color: var(--vscode-descriptionForeground);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  /* Use margin-left on details/divs for tree indentation */
  .indent-1 { margin-left: calc(1 * var(--indent-size)); }
  .indent-2 { margin-left: calc(2 * var(--indent-size)); }
  .indent-3 { margin-left: calc(3 * var(--indent-size)); }
  .indent-4 { margin-left: calc(4 * var(--indent-size)); }
  .indent-5 { margin-left: calc(5 * var(--indent-size)); }
  .indent-6 { margin-left: calc(6 * var(--indent-size)); }
  .row {
    padding: 1px 0;
  }
`;

/** Maximum indent level supported by CSS classes */
const MAX_INDENT = 6;

/** Maximum number of array elements to display (prevents UI overload) */
const MAX_ARRAY_DISPLAY = 100;

/**
 * Returns the appropriate CSS class for a given indent level.
 */
function indentClass(level: number): string {
  const clamped = Math.min(Math.max(level, 0), MAX_INDENT);
  return clamped > 0 ? `indent-${clamped}` : '';
}

/**
 * Returns the appropriate value class based on the value type.
 */
function valueClass(value: unknown): string {
  if (value === null || value === undefined) {return 'val-null';}
  if (typeof value === 'number') {return 'val-number';}
  return 'val';
}

/**
 * Returns HTML markup for the dataset using nested <details> elements, ordered and labeled.
 *
 * @param webview - The webview instance for CSP source
 * @param dataset - The NetCDF dataset
 * @param fileName - Name of the file for display
 * @returns HTML string
 */
export function getDatasetHtml(
  webview: vscode.Webview,
  dataset: NetCDFDataset,
  fileName: string = 'NetCDF File'
): string {
  const alwaysExpandable = new Set(['dtype', 'shape', 'dims', 'encoding']);
  const sectionLabels = new Set(['Dimensions', 'Coordinates', 'Data Variables', 'Global Attributes']);

  function renderTree(
    node: unknown,
    label: string,
    indent = 0,
    parent?: Record<string, unknown>,
    parentKey?: string
  ): string {
    const indentCls = indentClass(indent);
    const isSection = sectionLabels.has(label);
    const isVariable = parentKey === 'data_vars' || parentKey === 'coords';

    // Determine label styling
    let labelClass = 'key';
    if (isSection) {labelClass = 'section-header';}
    else if (isVariable) {labelClass = 'var-name';}
    else if (parentKey === 'attrs') {labelClass = 'attr-name';}

    // Special handling for sample_data label
    let displayLabel = escapeHtml(label);
    if (label === 'sample_data' && Array.isArray(node) && parent?.shape) {
      const sampleSlice = getSampleSlice(parent.shape as number[], node.length);
      displayLabel = `sample_data <span class="val">${escapeHtml(sampleSlice)}</span>`;
    }

    // Always expandable for certain keys, even if primitive
    if (alwaysExpandable.has(label)) {
      let content = '';
      if (typeof node === 'object' && node !== null) {
        content = Object.entries(node)
          .map(([k, v]) => renderTree(v, k, indent + 1, node as Record<string, unknown>, label))
          .join('');
      } else {
        const valCls = valueClass(node);
        content = `<div class="row"><span class="${valCls}">${escapeHtml(node)}</span></div>`;
      }
      return `<details class="${indentCls}">
        <summary><span class="${labelClass}">${displayLabel}</span></summary>
        ${content}
      </details>`;
    }

    // For plain objects, render as expandable
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
      const nodeRecord = node as Record<string, unknown>;
      const children = Object.entries(nodeRecord)
        .map(([k, v]) => renderTree(v, k, indent + 1, nodeRecord, isVariable ? 'variable' : parentKey))
        .join('');
      return `<details class="${indentCls}">
        <summary><span class="${labelClass}">${displayLabel}</span></summary>
        ${children}
      </details>`;
    }

    // For arrays, show values (limited to prevent UI overload)
    if (Array.isArray(node)) {
      const limitedNode = node.slice(0, MAX_ARRAY_DISPLAY);
      const truncated = node.length > MAX_ARRAY_DISPLAY;
      const preview = limitedNode
        .map((v, i) => {
          const valCls = valueClass(v);
          return `<div class="row"><span class="index">[${i}]:</span> <span class="${valCls}">${escapeHtml(v)}</span></div>`;
        })
        .join('');
      const truncatedNote = truncated
        ? `<div class="row"><span class="val-null">... and ${node.length - MAX_ARRAY_DISPLAY} more items</span></div>`
        : '';
      return `<details class="${indentCls}">
        <summary><span class="${labelClass}">${displayLabel}</span></summary>
        ${preview}${truncatedNote}
      </details>`;
    }

    // For primitives, show as a line
    const valCls = valueClass(node);
    return `<div class="row ${indentCls}"><span class="${labelClass}">${displayLabel}:</span> <span class="${valCls}">${escapeHtml(node)}</span></div>`;
  }

  // Prepare ordered branches
  const dims = dataset.dims ? renderTree(dataset.dims, 'Dimensions', 1, undefined, 'dims') : '';
  const coords = dataset.coords ? renderTree(dataset.coords, 'Coordinates', 1, undefined, 'coords') : '';
  const dataVars = dataset.data_vars
    ? renderTree(dataset.data_vars, 'Data Variables', 1, undefined, 'data_vars')
    : '';
  const globalAttrs = dataset.attrs ? renderTree(dataset.attrs, 'Global Attributes', 1, undefined, 'attrs') : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline';">
  <style>${CSS_STYLES}</style>
</head>
<body>
  <h1>NetCDF Structure Viewer</h1>
  <details open>
    <summary class="file-header">${escapeHtml(fileName)}</summary>
    ${dims}
    ${coords}
    ${dataVars}
    ${globalAttrs}
  </details>
</body>
</html>`;
}
