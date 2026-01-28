import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { InspectResult } from '../types';

/**
 * Inspects a NetCDF file using an external Python script and returns the parsed output.
 *
 * @param context - VS Code extension context (for locating the Python script)
 * @param filePath - Path to the NetCDF file to inspect
 * @returns Parsed dataset or error object
 */
export async function inspectNetCDFWithPython(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<InspectResult> {
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
 *
 * @param pythonPath - Path to Python executable
 * @returns Error message if dependencies are missing, null otherwise
 */
export async function checkPythonDependencies(pythonPath: string): Promise<string | null> {
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
