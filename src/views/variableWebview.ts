import * as vscode from 'vscode';
import { NamedVariable } from '../types';
import { getSampleSlice } from '../utils/sampleSlice';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Escapes a string for safe use in JavaScript string literals.
 */
function escapeJs(unsafe: unknown): string {
  const str = String(unsafe ?? '');
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Opens a Webview panel to preview the selected NetCDF variable.
 *
 * NOTE: This function is currently not wired up to any command.
 * It can be used in the future to preview variables when clicked in the tree view.
 *
 * @param context - VS Code extension context
 * @param variable - The variable to preview
 */
export function showVariableWebview(context: vscode.ExtensionContext, variable: NamedVariable): void {
  const panel = vscode.window.createWebviewPanel(
    'netcdfVarPreview',
    `Preview: ${variable.name || variable.label || '?'}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    }
  );

  panel.webview.html = getWebviewContent(panel.webview, context, variable);

  panel.webview.onDidReceiveMessage((msg) => {
    if (msg.command === 'alert') {
      vscode.window.showInformationMessage(msg.text);
    }
  });
}

/**
 * Generates HTML for the Webview, including metadata and a mini-chart.
 *
 * @param webview - The webview instance
 * @param context - VS Code extension context
 * @param variable - The variable to display
 * @returns HTML string
 */
export function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  variable: NamedVariable
): string {
  // URI for local Chart.js script in media folder
  const chartJsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'chart.js'));

  const attrsStr = Object.entries(variable.attrs || {})
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(JSON.stringify(v))}</td></tr>`)
    .join('');

  // Sample data (sample size is configured via netcdfViewer.sampleSize)
  const sampleData: (number | string | null)[] = Array.isArray(variable.sample_data) ? variable.sample_data : [];

  const shape = variable.shape || [];
  const sampleSlice = getSampleSlice(shape, sampleData.length);

  const variableName = escapeHtml(variable.name || variable.label || '?');
  const variableNameJs = escapeJs(variable.name || variable.label || '?');

  const dimensionsDisplay =
    variable.dims && variable.shape
      ? variable.dims.map((d: string, i: number) => `${escapeHtml(d)} (${variable.shape[i]})`).join(' × ')
      : (variable.dims || []).map((d) => escapeHtml(d)).join(' × ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-chart' ${webview.cspSource}; style-src ${webview.cspSource};">
    <style>
        body { font-family: sans-serif; padding: 16px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    </style>
    <title>Variable Preview</title>
</head>
<body>
    <h1>${variableName}</h1>
    <p><strong>Dimensions:</strong> ${dimensionsDisplay}</p>
    <p><strong>Type:</strong> ${escapeHtml(variable.dtype || '?')}</p>

    <h2>Attributes</h2>
    <table>
        <tr><th>Key</th><th>Value</th></tr>
        ${attrsStr || '<tr><td colspan="2"><em>No attributes</em></td></tr>'}
    </table>

    <h2>
      Sample Data${sampleSlice ? ` ${escapeHtml(sampleSlice)}` : ''} (first ${sampleData.length} values)
    </h2>
${
  sampleData.length > 0
    ? `
      <table>
        <tr><th>Index</th><th>Value</th></tr>
        ${sampleData.map((v, i) => `<tr><td>${i}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
      </table>
      <canvas id="chart" width="400" height="200"></canvas>
      `
    : '<p><em>No data available for this variable.</em></p>'
}
    ${
      sampleData.length > 0
        ? `
    <!-- Acquire VS Code API -->
    <script nonce="nonce-chart">
        const vscode = acquireVsCodeApi();
    </script>
    <!-- Chart.js library -->
    <script nonce="nonce-chart" src="${chartJsUri}"></script>
    <!-- Render the chart -->
    <script nonce="nonce-chart">
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(sampleData.map((_, i) => i))},
                datasets: [{
                    label: '${variableNameJs}',
                    data: ${JSON.stringify(sampleData)},
                    fill: false,
                    tension: 0.1
                }]
            },
            options: { responsive: true }
        });

        ctx.canvas.addEventListener('click', () => {
            vscode.postMessage({ command: 'alert', text: 'Chart clicked!' });
        });
    </script>
    `
        : ''
    }
</body>
</html>`;
}
