# Change Log

All notable changes to the "netcdf-viewer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Improved Python environment selection with automatic discovery (#15)
  - Integrates with VS Code Python extension to use the already-selected interpreter
  - Auto-discovers conda environments, workspace virtual environments, and system Python
  - New QuickPick dropdown replaces file browser for easier selection
  - Status bar item shows current Python environment (click to change)
  - Validates dependencies before accepting selection
- Progress notification while loading NetCDF files (#13)
- Configurable sample size setting `netcdfViewer.sampleSize` (1-1000, default 10) (#12)
- VS Code theme support for HTML view using CSS variables for light/dark compatibility (#13)

### Changed

- Python environment selector now shows friendly environment names instead of raw paths
- HTML view now uses CSS classes instead of inline styles for cleaner, maintainable code
- Improved HTML view formatting with type-specific styling for sections, variables, attributes, and values

### Fixed

- Context menu now correctly shows for all supported extensions (.nc, .nc4, .cdf, .h5) (#12)

## [0.0.5] - 2025-06-06

### Added
- Simply added an icon to the extension.

## [0.0.4] - 2025-06-06

### Added

- Improved HTML view: expandable/collapsible tree, array slice notation for sample data.
- Consistent expandable display for `dtype`, `shape`, `dims`, `encoding`, and `sample_data` in the HTML view.
- Sample data branches now show the array slice being displayed.

### Changed

- Enhanced attribute and primitive value display for clarity and consistency.
- Updated VS Code engine compatibility to ^1.89.0.
- Updated dev dependencies for latest VS Code and tooling.

### Fixed

- Fixed command activation and file opening issues.
- Removed orphan values from attributes display.
- Fixed sidebar and HTML view interaction issues.

---


## [0.0.3] - 2024-06-06

### Added

- Improved HTML view with expandable/collapsible tree and array slice notation for sample data.
- Consistent expandable display for dtype, shape, dims, encoding, and sample_data.
- Removed orphan values from attributes display.

### Changed

- Sidebar tree view is now optional; main focus is on the HTML view.

### Fixed

- Command activation and file opening issues.

## [0.0.2] - 2025-06-01

### Added

- Added top level branch with file name.
- New command to set python path for NetCDF Viewer.

## [0.0.1] - 2025-05-20

### Features

- Initial release of the NetCDF Viewer extension for VS Code.

### Changed

- Initial setup with basic command registration and activation logic.

### Deprecated

- No deprecated features in this release.

### Removed

- No features removed in this release.

### Fixed

- Initial setup with basic command registration and activation logic.
