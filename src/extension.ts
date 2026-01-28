import * as vscode from 'vscode';
import { NetCDFDataset, StoredNetCDF, isInspectError } from './types';
import { inspectNetCDFWithPython, checkPythonDependencies } from './python/inspector';
import { NetCDFTreeProvider } from './providers/NetCDFTreeProvider';
import { showDatasetHtmlView } from './views/datasetHtmlView';

/**
 * Called when your extension is activated.
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext): void {
  // Register TreeDataProvider for NetCDF Explorer
  const provider = new NetCDFTreeProvider(context);
  vscode.window.registerTreeDataProvider('netcdfExplorer', provider);

  // Register "Open NetCDF File…" command, accepting an optional URI
  const openCmd = vscode.commands.registerCommand('netcdf-viewer.openFile', async (uri?: vscode.Uri) => {
    let fileUri = uri;

    // If no URI was passed (user ran from Command Palette), prompt for one
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
      const result = await inspectNetCDFWithPython(context, fileUri.fsPath);
      if (isInspectError(result)) {
        vscode.window.showErrorMessage('Python error: ' + result.error);
        return;
      }
      const xarrayDataset: NetCDFDataset = result;
      const storedData: StoredNetCDF = {
        uri: fileUri,
        dataset: xarrayDataset,
      };
      context.workspaceState.update('lastNetCDF', storedData);
      provider.refresh();
      await vscode.commands.executeCommand('workbench.view.explorer');
      // Automatically open HTML view after loading
      showDatasetHtmlView(context, xarrayDataset);
    } catch (e) {
      vscode.window.showErrorMessage('Failed to inspect NetCDF file: ' + e);
    }
  });
  context.subscriptions.push(openCmd);

  // Register command to select Python environment
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
    const stored = context.workspaceState.get<StoredNetCDF>('lastNetCDF');
    if (!stored?.dataset) {
      vscode.window.showWarningMessage('No NetCDF file loaded.');
      return;
    }
    showDatasetHtmlView(context, stored.dataset);
  });
  context.subscriptions.push(showHtmlCmd);

  // Check Python and dependencies on startup
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
export function deactivate(): void {
  // No cleanup needed currently
}
