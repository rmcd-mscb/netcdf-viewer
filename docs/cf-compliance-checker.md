# CF Compliance Checker - Implementation Guide

> **Issue**: #14
> **Status**: Planned

## Overview

This document outlines the implementation plan for adding CF (Climate and Forecast) Conventions compliance checking to the NetCDF Viewer extension.

## Background

### What are CF Conventions?

The [CF Conventions](https://cfconventions.org/) are metadata standards for Earth science data in NetCDF files:

- **Standard Names**: Controlled vocabulary for physical quantities (e.g., `air_temperature`, `sea_surface_height`)
- **Units**: Must be UDUNITS-compatible and match canonical units for standard names
- **Coordinates**: Latitude, longitude, vertical, time with specific requirements
- **Attributes**: Required and recommended global/variable attributes

### Compliance Categories

| Category | Severity | When Flagged |
|----------|----------|--------------|
| **Required** | HIGH (Error) | Violations of MUST/SHALL requirements |
| **Recommended** | MEDIUM (Warning) | Violations of SHOULD requirements |
| **Optional** | LOW (Info) | Suggestions for better practices |

## Recommended Library

### IOOS Compliance Checker

```bash
pip install compliance-checker
# or
conda install -c conda-forge compliance-checker
```

**Why this library?**
- Active development and maintenance
- Clean Python API with JSON output
- Scoring system (points scored / points possible)
- Priority levels map well to VS Code diagnostics
- Supports CF versions 1.6 through latest

### Alternative: CEDA CF-Checker

```bash
pip install cfchecker
```

Less recommended due to older API, but still functional.

## Implementation Plan

### File Structure

```
src/
├── python/
│   └── cfChecker.ts           # Python script executor
├── providers/
│   └── CFComplianceProvider.ts # Optional: tree view provider
└── views/
    └── complianceReportView.ts # HTML report webview

check_cf_compliance.py          # Python script (root level)
```

### Phase 1: Python Script

Create `check_cf_compliance.py`:

```python
#!/usr/bin/env python3
"""CF Compliance checker for NetCDF Viewer extension."""

import sys
import json
from compliance_checker.runner import ComplianceChecker, CheckSuite

def check_compliance(filepath: str, cf_version: str = "latest") -> dict:
    """
    Run CF compliance check and return structured results.

    Args:
        filepath: Path to NetCDF file
        cf_version: CF version to check against (e.g., "1.8", "latest")

    Returns:
        Dictionary with score, summary, and issues
    """
    check_suite = CheckSuite()
    check_suite.load_all_available_checkers()

    # Determine checker name
    checker_name = "cf" if cf_version == "latest" else f"cf:{cf_version}"

    # Run check with JSON output to capture results
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        temp_path = f.name

    try:
        return_value, errors = ComplianceChecker.run_checker(
            path=filepath,
            checker_names=[checker_name],
            verbose=0,
            criteria='normal',
            output_filename=temp_path,
            output_format='json_new'
        )

        with open(temp_path, 'r') as f:
            raw_results = json.load(f)

        return transform_results(raw_results, checker_name)
    finally:
        os.unlink(temp_path)


def transform_results(raw: dict, checker_name: str) -> dict:
    """Transform compliance-checker output to extension-friendly format."""

    # Extract the CF results (key varies by version)
    cf_key = None
    for key in raw.keys():
        if key.startswith('cf'):
            cf_key = key
            break

    if not cf_key or cf_key not in raw:
        return {"error": "No CF results found"}

    cf_data = raw[cf_key]

    # Build summary
    high_passed = cf_data.get('high_count', 0)
    medium_passed = cf_data.get('medium_count', 0)
    low_passed = cf_data.get('low_count', 0)

    scored = cf_data.get('scored_points', 0)
    possible = cf_data.get('possible_points', 0)
    percentage = (scored / possible * 100) if possible > 0 else 0

    # Extract issues from all_priorities
    issues = []
    high_failed = 0
    medium_failed = 0
    low_failed = 0

    for check in cf_data.get('all_priorities', []):
        value = check.get('value', [0, 0])
        if isinstance(value, list) and len(value) == 2:
            passed, total = value
            if passed < total:  # Has failures
                weight = check.get('weight', 2)
                severity = 'high' if weight >= 3 else ('medium' if weight >= 2 else 'low')

                if severity == 'high':
                    high_failed += (total - passed)
                elif severity == 'medium':
                    medium_failed += (total - passed)
                else:
                    low_failed += (total - passed)

                for msg in check.get('msgs', []):
                    issues.append({
                        'severity': severity,
                        'category': categorize_check(check.get('name', '')),
                        'variable': extract_variable(msg),
                        'message': msg,
                        'checkName': check.get('name', '')
                    })

    return {
        'cfVersion': checker_name.replace('cf:', '').replace('cf', 'latest'),
        'score': {
            'scored': scored,
            'possible': possible,
            'percentage': round(percentage, 1)
        },
        'summary': {
            'high': {'passed': high_passed, 'failed': high_failed},
            'medium': {'passed': medium_passed, 'failed': medium_failed},
            'low': {'passed': low_passed, 'failed': low_failed}
        },
        'issues': issues
    }


def categorize_check(name: str) -> str:
    """Categorize a check by its name."""
    name_lower = name.lower()
    if 'unit' in name_lower:
        return 'units'
    elif 'coord' in name_lower or 'lat' in name_lower or 'lon' in name_lower:
        return 'coordinates'
    elif 'attr' in name_lower or 'convention' in name_lower:
        return 'attributes'
    elif 'name' in name_lower:
        return 'naming'
    elif 'time' in name_lower:
        return 'time'
    elif 'grid' in name_lower or 'crs' in name_lower:
        return 'grid_mapping'
    else:
        return 'general'


def extract_variable(msg: str) -> str | None:
    """Try to extract variable name from message."""
    # Common patterns: "Variable 'foo'", "variable foo", etc.
    import re
    match = re.search(r"[Vv]ariable ['\"]?(\w+)['\"]?", msg)
    if match:
        return match.group(1)
    return None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file provided'}))
        sys.exit(1)

    filepath = sys.argv[1]
    cf_version = sys.argv[2] if len(sys.argv) > 2 else 'latest'

    try:
        result = check_compliance(filepath, cf_version)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
```

### Phase 2: TypeScript Integration

Create `src/python/cfChecker.ts`:

```typescript
import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CFComplianceResult {
  cfVersion: string;
  score: {
    scored: number;
    possible: number;
    percentage: number;
  };
  summary: {
    high: { passed: number; failed: number };
    medium: { passed: number; failed: number };
    low: { passed: number; failed: number };
  };
  issues: CFIssue[];
  error?: string;
}

export interface CFIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  variable?: string;
  message: string;
  checkName?: string;
}

export async function checkCFCompliance(
  context: vscode.ExtensionContext,
  filePath: string,
  cfVersion: string = 'latest'
): Promise<CFComplianceResult> {
  const scriptPath = path.join(context.extensionPath, 'check_cf_compliance.py');
  const config = vscode.workspace.getConfiguration('netcdfViewer');
  const pythonPath = config.get<string>('pythonPath', 'python');

  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,
      [scriptPath, filePath, cfVersion],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(`Python error: ${stderr || err.message}`);
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch (e) {
            reject(`Failed to parse output: ${stdout.slice(0, 500)}`);
          }
        }
      }
    );
  });
}
```

### Phase 3: Webview Report

Create `src/views/complianceReportView.ts` following the pattern in `datasetHtmlView.ts`:

- Use VS Code CSS variables for theme support
- Show score prominently at top
- Group issues by severity with expandable sections
- Color-code: red (high), yellow (medium), blue (low)

### Phase 4: Command Registration

In `extension.ts`:

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('netcdf-viewer.checkCFCompliance', async () => {
    const stored = context.workspaceState.get<StoredNetCDF>('lastNetCDF');
    if (!stored?.uri) {
      vscode.window.showWarningMessage('No NetCDF file loaded');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Checking CF Compliance...',
        cancellable: false
      },
      async () => {
        const result = await checkCFCompliance(context, stored.uri.fsPath);
        showComplianceReport(context, result, stored.uri);
      }
    );
  })
);
```

## Configuration Options

Add to `package.json`:

```json
{
  "netcdfViewer.cfVersion": {
    "type": "string",
    "default": "latest",
    "enum": ["latest", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11"],
    "description": "CF Conventions version to check against"
  }
}
```

## References

### Official Documentation
- [CF Conventions](https://cfconventions.org/)
- [CF Conventions Specification](https://cfconventions.org/cf-conventions/cf-conventions.html)
- [CF Conformance Requirements](https://cfconventions.org/Data/cf-documents/requirements-recommendations/conformance-1.9.html)
- [CF Standard Names Table](https://cfconventions.org/Data/cf-standard-names/current/build/cf-standard-name-table.html)

### Libraries
- [IOOS Compliance Checker](https://github.com/ioos/compliance-checker) - Recommended
- [IOOS Compliance Checker Docs](https://ioos.github.io/compliance-checker/)
- [CEDA CF-Checker](https://github.com/cedadev/cf-checker) - Alternative

### Related Standards
- [UDUNITS](https://www.unidata.ucar.edu/software/udunits/) - Units validation
- [COARDS](https://ferret.pmel.noaa.gov/Ferret/documentation/coards-netcdf-conventions) - Predecessor to CF
