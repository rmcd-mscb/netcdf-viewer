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
  source: 'vscode-python' | 'conda' | 'venv' | 'system';
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
        if (typeof envPath !== 'string') {
          continue;
        }
        const pythonPath =
          process.platform === 'win32' ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');

        try {
          await fs.promises.access(pythonPath);
          const envName = path.basename(envPath);
          const isBase = envPath === info.root_prefix;
          const version = await getPythonVersion(pythonPath);
          environments.push({
            name: `conda: ${isBase ? 'base' : envName}${version ? ` (${version})` : ''}`,
            path: pythonPath,
            source: 'conda',
            version,
          });
        } catch {
          // Python executable not found in this environment
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

  // Note: '.env' is excluded as it's commonly used for environment variable files
  const venvDirs = ['.venv', 'venv', 'env'];

  for (const folder of workspaceFolders) {
    for (const venvDir of venvDirs) {
      const venvPath = path.join(folder.uri.fsPath, venvDir);
      const pythonPath =
        process.platform === 'win32'
          ? path.join(venvPath, 'Scripts', 'python.exe')
          : path.join(venvPath, 'bin', 'python');

      try {
        await fs.promises.access(pythonPath);
        const version = await getPythonVersion(pythonPath);
        environments.push({
          name: `venv: ${venvDir}${version ? ` (${version})` : ''}`,
          path: pythonPath,
          source: 'venv',
          version,
        });
      } catch {
        // Python executable not found in this venv directory
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

      if (firstPath) {
        try {
          await fs.promises.access(firstPath);
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
        } catch {
          // Path not accessible
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
    // Match version numbers like 3.9, 3.9.7, 3.12.0rc1, 3.9.7+
    const match = output.match(/Python (\d+(?:\.\d+){1,2})(?:\D|$)/);
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

  // Remove duplicates by path (resolve symlinks for accurate comparison)
  const seen = new Set<string>();
  return environments.filter((env) => {
    let resolvedPath: string;
    try {
      resolvedPath = fs.realpathSync(env.path);
    } catch {
      // If path cannot be resolved, use original path
      resolvedPath = env.path;
    }
    const normalizedPath = resolvedPath.toLowerCase();
    if (seen.has(normalizedPath)) {
      return false;
    }
    seen.add(normalizedPath);
    return true;
  });
}

/**
 * Helper function to run a command and return stdout
 * Uses 30s timeout to support slow systems or many conda environments
 */
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        // Include stderr in error for better debugging
        const errorMessage = stderr ? `${error.message}: ${stderr}` : error.message;
        reject(new Error(errorMessage));
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

  const parts = pythonPath.split(path.sep);

  // Check if it's in a conda environment
  if (pythonPath.includes('conda') || pythonPath.includes('miniconda') || pythonPath.includes('anaconda')) {
    const envsIndex = parts.indexOf('envs');
    if (envsIndex !== -1 && parts[envsIndex + 1]) {
      return `conda: ${parts[envsIndex + 1]}`;
    }
    return 'conda: base';
  }

  // Check if it's a venv (look for common venv folder names in the path)
  // Note: '.env' is excluded as it's commonly used for environment variable files
  const venvIndicators = ['.venv', 'venv', 'env'];
  for (const indicator of venvIndicators) {
    const indicatorIndex = parts.indexOf(indicator);
    if (indicatorIndex !== -1) {
      // Verify it's followed by bin/Scripts (typical venv structure)
      const nextSegment = parts[indicatorIndex + 1];
      if (!nextSegment || nextSegment === 'bin' || nextSegment === 'Scripts') {
        return `venv: ${indicator}`;
      }
    }
  }

  // Skip 'bin' or 'Scripts' folders to get the actual environment name
  const skipFolders = ['bin', 'Scripts'];
  for (let i = parts.length - 2; i >= 0; i--) {
    if (!skipFolders.includes(parts[i]) && parts[i] !== '') {
      return parts[i];
    }
  }

  return pythonPath;
}
