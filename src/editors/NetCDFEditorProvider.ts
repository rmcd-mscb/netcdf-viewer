import * as path from 'path';
import * as vscode from 'vscode';
import { StoredNetCDF, isInspectError } from '../types';
import { inspectNetCDFWithPython } from '../python/inspector';
import { getDatasetHtml } from '../views/datasetHtmlView';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Read-only custom editor so that opening a NetCDF file (e.g. double-click in the Explorer)
 * shows the dataset structure instead of the "binary file" warning.
 */
export class NetCDFEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'netcdf-viewer.preview';

  /**
   * Registers the custom editor provider.
   *
   * @param context - VS Code extension context
   * @param onLoaded - Called after a file loads successfully (e.g. to refresh the tree view)
   */
  public static register(context: vscode.ExtensionContext, onLoaded: () => void): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      NetCDFEditorProvider.viewType,
      new NetCDFEditorProvider(context, onLoaded)
    );
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onLoaded: () => void
  ) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel): Promise<void> {
    const fileName = path.basename(document.uri.fsPath);
    try {
      const result = await inspectNetCDFWithPython(this.context, document.uri.fsPath);
      if (isInspectError(result)) {
        panel.webview.html = getErrorHtml(result.error);
        return;
      }
      const stored: StoredNetCDF = { uri: document.uri, dataset: result };
      await this.context.workspaceState.update('lastNetCDF', stored);
      this.onLoaded();
      panel.webview.html = getDatasetHtml(panel.webview, result, fileName);
    } catch (e) {
      panel.webview.html = getErrorHtml(String(e));
    }
  }
}

/**
 * Minimal page shown when Python fails to read the file.
 */
function getErrorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<body>
  <h3>Could not read this file</h3>
  <pre style="white-space: pre-wrap;">${escapeHtml(error)}</pre>
  <p>Check that <code>netcdfViewer.pythonPath</code> points to a Python with xarray and netCDF4 installed.</p>
</body>
</html>`;
}
