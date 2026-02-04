import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

/**
 * Represents a discovered Python environment
 */
export interface PythonEnvironment {
  name: string;
  path: string;
  source: 'vscode-python' | 'conda' | 'venv' | 'system' | 'manual';
  version?: string;
}

/**
 * Gets the Python path from VS Code Python extension if available
 */
export async function getPythonFromVSCodeExtension(): Promise<PythonEnvironment | null> {
  const pythonExt = vscode.extensions.getExtension('ms-python.python');

  if (!pythonExt) {
    return null;
  }

  if (!pythonExt.isActive) {
    await pythonExt.activate();
  }

  try {
    // Try the newer API first (Python extension 2023.4+)
    const execDetails = pythonExt.exports?.settings?.getExecutionDetails?.(
      vscode.workspace.workspaceFolders?.[0]?.uri
    );
    if (execDetails?.execCommand?.[0]) {
      const pythonPath = execDetails.execCommand[0];
      const version = await getPythonVersion(pythonPath);
      return {
        name: `VS Code Python${version ? ` (${version})` : ''}`,
        path: pythonPath,
        source: 'vscode-python',
        version,
      };
    }

    // Fallback to older API
    const pythonPath = pythonExt.exports?.settings?.getExecutionDetails?.()?.execCommand?.[0];
    if (pythonPath) {
      const version = await getPythonVersion(pythonPath);
      return {
        name: `VS Code Python${version ? ` (${version})` : ''}`,
        path: pythonPath,
        source: 'vscode-python',
        version,
      };
    }
  } catch {
    // Extension API may have changed, fall through
  }

  return null;
}

/**
 * Discovers conda environments
 */
export async function discoverCondaEnvironments(): Promise<PythonEnvironment[]> {
  const environments: PythonEnvironment[] = [];

  try {
    const condaInfo = await runCommand('conda', ['info', '--envs', '--json']);
    const info = JSON.parse(condaInfo);

    if (info.envs && Array.isArray(info.envs)) {
      for (const envPath of info.envs) {
        const pythonPath =
          process.platform === 'win32' ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');

        if (fs.existsSync(pythonPath)) {
          const envName = path.basename(envPath);
          const isBase = envPath === info.root_prefix;
          const version = await getPythonVersion(pythonPath);
          environments.push({
            name: `conda: ${isBase ? 'base' : envName}${version ? ` (${version})` : ''}`,
            path: pythonPath,
            source: 'conda',
            version,
          });
        }
      }
    }
  } catch {
    // Conda not installed or not in PATH
  }

  return environments;
}

/**
 * Discovers virtual environments in the workspace
 */
export async function discoverWorkspaceVenvs(): Promise<PythonEnvironment[]> {
  const environments: PythonEnvironment[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    return environments;
  }

  const venvDirs = ['.venv', 'venv', 'env', '.env'];

  for (const folder of workspaceFolders) {
    for (const venvDir of venvDirs) {
      const venvPath = path.join(folder.uri.fsPath, venvDir);
      const pythonPath =
        process.platform === 'win32'
          ? path.join(venvPath, 'Scripts', 'python.exe')
          : path.join(venvPath, 'bin', 'python');

      if (fs.existsSync(pythonPath)) {
        const version = await getPythonVersion(pythonPath);
        environments.push({
          name: `venv: ${venvDir}${version ? ` (${version})` : ''}`,
          path: pythonPath,
          source: 'venv',
          version,
        });
      }
    }
  }

  return environments;
}

/**
 * Discovers system Python installations
 */
export async function discoverSystemPython(): Promise<PythonEnvironment[]> {
  const environments: PythonEnvironment[] = [];
  const pythonCommands = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const pythonPath = await runCommand(process.platform === 'win32' ? 'where' : 'which', [cmd]);
      const firstPath = pythonPath.trim().split('\n')[0];

      if (firstPath && fs.existsSync(firstPath)) {
        // Check if we already have this path
        if (!environments.some((e) => e.path === firstPath)) {
          const version = await getPythonVersion(firstPath);
          environments.push({
            name: `System: ${cmd}${version ? ` (${version})` : ''}`,
            path: firstPath,
            source: 'system',
            version,
          });
        }
      }
    } catch {
      // Command not found
    }
  }

  return environments;
}

/**
 * Gets the Python version for a given interpreter path
 */
export async function getPythonVersion(pythonPath: string): Promise<string | undefined> {
  try {
    const output = await runCommand(pythonPath, ['--version']);
    const match = output.match(/Python (\d+\.\d+\.\d+)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Discovers all available Python environments
 */
export async function discoverAllEnvironments(): Promise<PythonEnvironment[]> {
  const environments: PythonEnvironment[] = [];

  // Try VS Code Python extension first (highest priority)
  const vscodeEnv = await getPythonFromVSCodeExtension();
  if (vscodeEnv) {
    environments.push(vscodeEnv);
  }

  // Discover other environments in parallel
  const [condaEnvs, venvs, systemEnvs] = await Promise.all([
    discoverCondaEnvironments(),
    discoverWorkspaceVenvs(),
    discoverSystemPython(),
  ]);

  environments.push(...condaEnvs, ...venvs, ...systemEnvs);

  // Remove duplicates by path
  const seen = new Set<string>();
  return environments.filter((env) => {
    const normalizedPath = env.path.toLowerCase();
    if (seen.has(normalizedPath)) {
      return false;
    }
    seen.add(normalizedPath);
    return true;
  });
}

/**
 * Helper function to run a command and return stdout
 */
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Gets a friendly display name for the current Python path
 */
export function getEnvironmentDisplayName(pythonPath: string): string {
  if (pythonPath === 'python' || pythonPath === 'python3') {
    return pythonPath;
  }

  // Check if it's in a conda environment
  if (pythonPath.includes('conda') || pythonPath.includes('miniconda') || pythonPath.includes('anaconda')) {
    const parts = pythonPath.split(path.sep);
    const envsIndex = parts.indexOf('envs');
    if (envsIndex !== -1 && parts[envsIndex + 1]) {
      return `conda: ${parts[envsIndex + 1]}`;
    }
    return 'conda: base';
  }

  // Check if it's a venv
  const venvIndicators = ['.venv', 'venv', 'env', '.env'];
  for (const indicator of venvIndicators) {
    if (pythonPath.includes(path.sep + indicator + path.sep)) {
      return `venv: ${indicator}`;
    }
  }

  // Return the last directory name or the path itself
  const parts = pythonPath.split(path.sep);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return pythonPath;
}
