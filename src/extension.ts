import * as vscode from 'vscode';
import { NetCDFDataset, StoredNetCDF, isInspectError } from './types';
import { inspectNetCDFWithPython, checkPythonDependencies } from './python/inspector';
import { NetCDFTreeProvider } from './providers/NetCDFTreeProvider';
import { showDatasetHtmlView } from './views/datasetHtmlView';
import {
  discoverAllEnvironments,
  getEnvironmentDisplayName,
  PythonEnvironment,
} from './python/environmentDiscovery';

// Status bar item for showing current Python environment
let pythonStatusBarItem: vscode.StatusBarItem;

/**
 * Updates the status bar item with the current Python environment
 */
function updatePythonStatusBar(): void {
  const config = vscode.workspace.getConfiguration('netcdfViewer');
  const pythonPath = config.get<string>('pythonPath', 'python');
  const displayName = getEnvironmentDisplayName(pythonPath);
  pythonStatusBarItem.text = `$(symbol-misc) ${displayName}`;
  pythonStatusBarItem.tooltip = `NetCDF Viewer Python: ${pythonPath}\nClick to change`;
  pythonStatusBarItem.show();
}

/**
 * Called when your extension is activated.
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create status bar item for Python environment
  pythonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  pythonStatusBarItem.command = 'netcdf-viewer.selectPythonEnv';
  context.subscriptions.push(pythonStatusBarItem);
  updatePythonStatusBar();

  // Listen for configuration changes to update status bar
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('netcdfViewer.pythonPath')) {
        updatePythonStatusBar();
      }
    })
  );

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
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading NetCDF file...',
          cancellable: false,
        },
        async () => {
          return inspectNetCDFWithPython(context, fileUri.fsPath);
        }
      );

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
    // Show progress while discovering environments
    const environments = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Discovering Python environments...',
        cancellable: false,
      },
      async () => discoverAllEnvironments()
    );

    // Build QuickPick items
    const items: (vscode.QuickPickItem & { env?: PythonEnvironment })[] = environments.map((env) => ({
      label: env.name,
      description: env.path,
      detail: env.source === 'vscode-python' ? '$(star) Recommended - from VS Code Python extension' : undefined,
      env,
    }));

    // Add option to browse manually
    items.push({
      label: '$(folder) Browse...',
      description: 'Select Python executable manually',
      alwaysShow: true,
    });

    // Add option to enter path manually
    items.push({
      label: '$(edit) Enter path...',
      description: 'Type a custom Python path',
      alwaysShow: true,
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a Python environment for NetCDF Viewer',
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    let pythonPath: string | undefined;

    if (selected.label === '$(folder) Browse...') {
      // Fall back to file picker
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select Python Executable',
        filters: process.platform === 'win32' ? { 'Python Executable': ['exe'] } : undefined,
      });
      if (picked && picked[0]) {
        pythonPath = picked[0].fsPath;
      }
    } else if (selected.label === '$(edit) Enter path...') {
      // Allow manual path entry
      pythonPath = await vscode.window.showInputBox({
        prompt: 'Enter the path to Python executable',
        placeHolder: '/usr/bin/python3 or C:\\Python39\\python.exe',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Please enter a path';
          }
          return undefined;
        },
      });
    } else if (selected.env) {
      pythonPath = selected.env.path;
    }

    if (pythonPath) {
      // Verify the selected Python has required dependencies
      const depError = await checkPythonDependencies(pythonPath);
      if (depError) {
        const choice = await vscode.window.showWarningMessage(
          `Selected Python is missing required packages (xarray, netCDF4). Use anyway?`,
          'Use Anyway',
          'Cancel'
        );
        if (choice !== 'Use Anyway') {
          return;
        }
      }

      await vscode.workspace
        .getConfiguration()
        .update('netcdfViewer.pythonPath', pythonPath, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`NetCDF Viewer will use: ${pythonPath}`);
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
