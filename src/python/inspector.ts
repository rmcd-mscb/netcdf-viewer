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

  const MAX_ERROR_LENGTH = 500;

  return new Promise((resolve, reject) => {
    execFile(pythonPath, [scriptPath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // Truncate error output to avoid overwhelming the user
        let details = stderr || err.message || 'Unknown error';
        if (details.length > MAX_ERROR_LENGTH) {
          details = details.slice(0, MAX_ERROR_LENGTH) + '... [truncated]';
        }
        reject(`Python error: ${details}`);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          // Truncate output snippet for parse errors
          let snippet = stdout || '';
          if (snippet.length > MAX_ERROR_LENGTH) {
            snippet = snippet.slice(0, MAX_ERROR_LENGTH) + '... [truncated]';
          }
          reject(`Failed to parse Python output: ${snippet}`);
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
