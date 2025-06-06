import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Called when your extension is activated.
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
  // 1) Register "Open NetCDF File…", now accepting an optional URI
  const openCmd = vscode.commands.registerCommand('netcdf-viewer.openFile', async (uri?: vscode.Uri) => {
    let fileUri = uri;

    // 2) If no URI was passed (user ran from Command Palette), prompt for one
    if (!fileUri) {
      const [picked] =
        (await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'NetCDF files': ['nc', 'nc4', 'cdf', 'h5'] },
        })) || [];
      if (!picked) {
        return;
      }
      fileUri = picked;
    }
    try {
      const xarrayDataset = await inspectNetCDFWithPython(context, fileUri.fsPath);
      if (xarrayDataset.error) {
        vscode.window.showErrorMessage('Python error: ' + xarrayDataset.error);
        return;
      }
      context.workspaceState.update('lastNetCDF', {
        uri: fileUri,
        dataset: xarrayDataset,
      });
      provider.refresh();
      await vscode.commands.executeCommand('workbench.view.explorer');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to inspect NetCDF file: ' + e);
    }
  });
  context.subscriptions.push(openCmd);

  // Register a command to select Python environment using the Python extension
  const selectPythonEnvCmd = vscode.commands.registerCommand('netcdf-viewer.selectPythonEnv', async () => {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select Python Executable',
      filters: process.platform === 'win32' ? { 'Python Executable': ['exe'] } : undefined,
    });
    if (picked && picked[0]) {
      await vscode.workspace
        .getConfiguration()
        .update('netcdfViewer.pythonPath', picked[0].fsPath, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`NetCDF Viewer will use: ${picked[0].fsPath}`);
    } else {
      vscode.window.showWarningMessage('No Python interpreter selected.');
    }
  });
  context.subscriptions.push(selectPythonEnvCmd);

  // Register command to show dataset in an HTML view
  const showHtmlCmd = vscode.commands.registerCommand('netcdf-viewer.showHtmlView', () => {
    const stored = context.workspaceState.get<any>('lastNetCDF');
    if (!stored || !stored.dataset) {
      vscode.window.showWarningMessage('No NetCDF file loaded.');
      return;
    }
    showDatasetHtmlView(context, stored.dataset);
  });
  context.subscriptions.push(showHtmlCmd);

  // 3) Register TreeDataProvider for NetCDF Explorer
  const provider = new NetCDFTreeProvider(context);
  vscode.window.registerTreeDataProvider('netcdfExplorer', provider);

  // Check Python and dependencies
  const pythonPath = vscode.workspace.getConfiguration().get<string>('netcdfViewer.pythonPath', 'python');
  checkPythonDependencies(pythonPath).then((depError) => {
    if (depError) {
      vscode.window.showErrorMessage(depError);
    }
  });
}

/**
 * Called when your extension is deactivated.
 */
export function deactivate() {
  // No cleanup needed currently
}

/**
 * Opens a Webview panel to preview the selected NetCDF variable.
 */
function showVariableWebview(context: vscode.ExtensionContext, variable: any) {
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

/** Opens a webview to display the entire dataset as an HTML table with collapsible sections. */
function showDatasetHtmlView(context: vscode.ExtensionContext, dataset: any) {
  const panel = vscode.window.createWebviewPanel('netcdfHtmlView', 'NetCDF HTML View', vscode.ViewColumn.One, {
    enableScripts: true,
  });

  panel.webview.html = getDatasetHtml(panel.webview, dataset);
}

/** Returns HTML markup for the dataset using nested <details> elements. */
function getDatasetHtml(webview: vscode.Webview, dataset: any): string {
  const escape = (s: any) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Helper for tables with indentation
  const objectTable = (obj: any, indent = 0) =>
    `<table style="margin-left:${indent * 20}px">${Object.entries(obj || {})
      .map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`)
      .join('')}</table>`;

  // Recursive variable details with indentation
  const variableDetails = (name: string, variable: any, indent = 0) => {
    const attrs = Object.keys(variable.attrs || {}).length
      ? objectTable(variable.attrs, indent + 1)
      : `<div style="margin-left:${(indent + 1) * 20}px"><em>No attributes</em></div>`;
    const enc = Object.keys(variable.encoding || {}).length
      ? objectTable(variable.encoding, indent + 1)
      : `<div style="margin-left:${(indent + 1) * 20}px"><em>No encoding</em></div>`;
    const sample =
      Array.isArray(variable.sample_data) && variable.sample_data.length
        ? `<table style="margin-left:${(indent + 1) * 20}px">${variable.sample_data
            .slice(0, 10)
            .map(
              (v: any, i: number) =>
                `<tr><td>[${i}]</td><td>${escape(v)}</td></tr>`
            )
            .join('')}</table>`
        : `<div style="margin-left:${(indent + 1) * 20}px"><em>No sample</em></div>`;
    return `<details style="margin-left:${indent * 20}px"><summary>${escape(name)}</summary>
      <details style="margin-left:${(indent + 1) * 20}px"><summary>Attributes</summary>${attrs}</details>
      <details style="margin-left:${(indent + 1) * 20}px"><summary>Sample Data</summary>${sample}</details>
      <details style="margin-left:${(indent + 1) * 20}px"><summary>Encoding</summary>${enc}</details>
    </details>`;
  };

  const dimsTable = `<table style="margin-left:20px">${Object.entries(dataset.dims || {})
    .map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`)
    .join('')}</table>`;

  const coords = Object.entries(dataset.coords || {})
    .map(([k, v]) => variableDetails(k, v, 1))
    .join('');

  const vars = Object.entries(dataset.data_vars || {})
    .map(([k, v]) => variableDetails(k, v, 1))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
  <style>
    body { font-family: sans-serif; padding: 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
    td, th { border: 1px solid #ccc; padding: 4px; }
    summary { cursor: pointer; font-weight: bold; }
    details { margin-bottom: 6px; }
  </style>
</head>
<body>
  <h1>NetCDF Dataset</h1>
  <details open><summary>Dimensions</summary>${dimsTable}</details>
  <details open><summary>Coordinates</summary>${coords}</details>
  <details open><summary>Data Variables</summary>${vars}</details>
</body>
</html>`;
}

/**
 * Generates HTML for the Webview, including metadata and a mini-chart.
 */
function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext, variable: any): string {
  // URI for local Chart.js script in media folder
  const chartJsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'chart.js'));

  // Format variable summary like xarray
  const dimsStr =
    variable.dims && variable.dims.length > 0
      ? `(${variable.dims
          .map((d: string, i: number) => `${d}: ${variable.shape ? variable.shape[i] : '?'}`)
          .join(', ')})`
      : '';

  const attrsStr = Object.entries(variable.attrs || {})
    .map(([k, v]) => `<tr><td>${k}</td><td>${JSON.stringify(v)}</td></tr>`)
    .join('');

  // Read all data and take the first 10 values as sample
  let rawData: any[] = [];
  if (Array.isArray(variable.sample_data)) {
    rawData = variable.sample_data;
  }
  const sampleData = rawData.slice(0, 10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${
          webview.cspSource
        } https:; script-src 'nonce-chart' ${webview.cspSource}; style-src ${webview.cspSource};">
    <style>
        body { font-family: sans-serif; padding: 16px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    </style>
    <title>Variable Preview</title>
</head>
<body>
    <h1>${variable.name || variable.label || '?'}</h1>
    <p><strong>Dimensions:</strong> ${
      variable.dims && variable.shape
        ? variable.dims.map((d: string, i: number) => `${d} (${variable.shape[i]})`).join(' × ')
        : (variable.dimensions || variable.dims || []).join(' × ')
    }</p>
    <p><strong>Type:</strong> ${variable.type || variable.dtype || '?'}</p>

    <h2>Attributes</h2>
    <table>
        <tr><th>Key</th><th>Value</th></tr>
        ${attrsStr || '<tr><td colspan="2"><em>No attributes</em></td></tr>'}
    </table>

    <h2>Sample Data (first ${sampleData.length} values)</h2>
${
  sampleData.length > 0
    ? `
      <table>
        <tr><th>Index</th><th>Value</th></tr>
        ${sampleData.map((v, i) => `<tr><td>${i}</td><td>${v}</td></tr>`).join('')}
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
                    label: '${variable.name || variable.label || '?'}',
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

/**
 * Represents an item in the NetCDF Explorer view.
 */
class NetCDFTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly state: vscode.TreeItemCollapsibleState,
    public readonly variable: any = undefined,
    public readonly contextValue: string = ''
  ) {
    super(label, state);
    this.contextValue = contextValue;
  }
}

/**
 * Provides data (variables) for the NetCDF Explorer tree view.
 */
export class NetCDFTreeProvider implements vscode.TreeDataProvider<NetCDFTreeItem> {
  private _onDidChange = new vscode.EventEmitter<NetCDFTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  /** Refresh the entire tree */
  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(item: NetCDFTreeItem): vscode.TreeItem {
    return item;
  }

  async getChildren(element?: NetCDFTreeItem): Promise<NetCDFTreeItem[]> {
    const stored = this.context.workspaceState.get<any>('lastNetCDF');
    if (!stored || !stored.dataset) {
      return [];
    }
    const ds = stored.dataset;
    const fileName = stored.uri ? path.basename(stored.uri.fsPath) : 'NetCDF File';
    // If no element, show the file name as the root
    if (!element) {
      return [new NetCDFTreeItem(fileName, vscode.TreeItemCollapsibleState.Expanded, ds, 'file')];
    }

    // If the element is the file node, show the main branches
    if (element.contextValue === 'file') {
      return [
        new NetCDFTreeItem('Dimensions', vscode.TreeItemCollapsibleState.Collapsed),
        new NetCDFTreeItem('Coordinates', vscode.TreeItemCollapsibleState.Collapsed),
        new NetCDFTreeItem('Data Variables', vscode.TreeItemCollapsibleState.Collapsed),
      ];
    }

    if (element.label === 'Dimensions') {
      return Object.entries(ds.dims || {}).map(
        ([dim, size]) => new NetCDFTreeItem(`${dim} (${size})`, vscode.TreeItemCollapsibleState.None)
      );
    }

    if (element.label === 'Coordinates') {
      return Object.entries(ds.coords || {}).map(
        ([coordName, v]) =>
          new NetCDFTreeItem(
            coordName,
            vscode.TreeItemCollapsibleState.Collapsed,
            {
              ...(typeof v === 'object' && v !== null ? v : {}),
              name: coordName,
            },
            'variable'
          )
      );
    }

    if (element.label === 'Data Variables') {
      return Object.entries(ds.data_vars || {}).map(
        ([varName, v]) =>
          new NetCDFTreeItem(
            varName,
            vscode.TreeItemCollapsibleState.Collapsed,
            {
              ...(typeof v === 'object' && v !== null ? v : {}),
              name: varName,
            },
            'variable'
          )
      );
    }

    // If this is a variable, show its attributes, sample data, and encoding as children
    if (element.contextValue === 'variable' && element.variable) {
      return [
        new NetCDFTreeItem('Attributes', vscode.TreeItemCollapsibleState.Collapsed, element.variable, 'attributes'),
        new NetCDFTreeItem('Sample Data', vscode.TreeItemCollapsibleState.Collapsed, element.variable, 'sample'),
        new NetCDFTreeItem('Encoding', vscode.TreeItemCollapsibleState.Collapsed, element.variable, 'encoding'),
      ];
    }

    // Show encoding children
    if (element.contextValue === 'encoding' && element.variable) {
      return Object.entries(element.variable.encoding || {}).map(
        ([k, v]) => new NetCDFTreeItem(`${k}: ${JSON.stringify(v)}`, vscode.TreeItemCollapsibleState.None)
      );
    }

    // Show attribute children
    if (element.contextValue === 'attributes' && element.variable) {
      return Object.entries(element.variable.attrs || {}).map(
        ([k, v]) => new NetCDFTreeItem(`${k}: ${JSON.stringify(v)}`, vscode.TreeItemCollapsibleState.None)
      );
    }

    // Show sample data children
    if (element.contextValue === 'sample' && element.variable) {
      const sampleData = Array.isArray(element.variable.sample_data) ? element.variable.sample_data.slice(0, 10) : [];
      return sampleData.map(
        (v: any, i: number) => new NetCDFTreeItem(`[${i}]: ${v}`, vscode.TreeItemCollapsibleState.None)
      );
    }

    return [];
  }
}

/**
 * Inspects a NetCDF file using an external Python script and returns the parsed output.
 */
async function inspectNetCDFWithPython(context: vscode.ExtensionContext, filePath: string): Promise<any> {
  const scriptPath = path.join(context.extensionPath, 'inspect_netcdf.py');
  const pythonPath = vscode.workspace.getConfiguration().get<string>('netcdfViewer.pythonPath', 'python');
  return new Promise((resolve, reject) => {
    execFile(pythonPath, [scriptPath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // Show stderr in the error message for debugging
        reject(`Python error: ${stderr || err.message}`);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject('Failed to parse Python output: ' + stdout);
        }
      }
    });
  });
}

/**
 * Checks Python and required dependencies, returning an error message if any are missing.
 */
async function checkPythonDependencies(pythonPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(pythonPath, ['-c', 'import xarray; import netCDF4'], (err) => {
      if (err) {
        resolve('Python, xarray, or netCDF4 not found. Please check your Python path and environment.');
      } else {
        resolve(null);
      }
    });
  });
}
