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
    fileName, // Use the filename as the tab heading
    vscode.ViewColumn.One,
    { enableScripts: false }
  );

  panel.webview.html = getDatasetHtml(panel.webview, dataset, fileName);
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

  function renderTree(node: unknown, label: string, indent = 0, parent?: Record<string, any>): string {
    // Special handling for sample_data
    let displayLabel = escapeHtml(label);
    if (label === 'sample_data' && Array.isArray(node) && parent && (parent.shape || parent.dims)) {
      const shape: number[] =
        parent.shape || (parent.dims ? parent.dims.map((d: string) => parent[d]?.length || 0) : []);
      const sampleSlice = getSampleSlice(shape, node.length);
      displayLabel = `sample_data ${escapeHtml(sampleSlice)}`;
    }

    // Always expandable for certain keys, even if primitive
    if (alwaysExpandable.has(label)) {
      let content = '';
      if (typeof node === 'object' && node !== null) {
        content = Object.entries(node)
          .map(([k, v]) => renderTree(v, k, indent + 1, node))
          .join('');
      } else {
        content = `<div style="padding-left:${(indent + 1) * 20}px"><span class="val">${escapeHtml(node)}</span></div>`;
      }
      return `<details>
        <summary style="padding-left:${indent * 20}px">${displayLabel}</summary>
        ${content}
      </details>`;
    }

    // For plain objects, render as expandable
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
      const children = Object.entries(node)
        .map(([k, v]) => renderTree(v, k, indent + 1, node))
        .join('');
      return `<details>
      <summary style="padding-left:${indent * 20}px">${displayLabel}</summary>
      ${children}
    </details>`;
    }

    // For arrays, show a preview (first 10 values)
    if (Array.isArray(node)) {
      const preview = node
        .slice(0, 10)
        .map(
          (v, i) =>
            `<div style="padding-left:${(indent + 1) * 20}px">[${i}]: <span class="val">${escapeHtml(v)}</span></div>`
        )
        .join('');
      return `<details>
      <summary style="padding-left:${indent * 20}px">${displayLabel}</summary>
      ${preview}
    </details>`;
    }

    // For primitives, just show as a line
    return `<div style="padding-left:${indent * 20}px">${displayLabel}: <span class="val">${escapeHtml(node)}</span></div>`;
  }

  // Prepare ordered branches
  const dims = dataset.dims ? renderTree(dataset.dims, 'Dimensions', 1) : '';
  const coords = dataset.coords ? renderTree(dataset.coords, 'Coordinates', 1) : '';
  const dataVars = dataset.data_vars ? renderTree(dataset.data_vars, 'Data Variables', 1) : '';
  const globalAttrs = dataset.attrs ? renderTree(dataset.attrs, 'Global Attributes', 1) : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
    <style>
      body { font-family: sans-serif; padding: 16px; }
      summary { font-weight: bold; cursor: pointer; }
      details { margin-bottom: 8px; }
      .val { color: #333; }
    </style>
  </head>
  <body>
    <h1>NetCDF Structure Viewer</h1>
    <details>
      <summary style="font-size:1.2em;">${escapeHtml(fileName)}</summary>
      ${dims}
      ${coords}
      ${dataVars}
      ${globalAttrs}
    </details>
  </body>
  </html>
  `;
}
