/**
 * TypeScript interfaces for NetCDF dataset structures.
 * These mirror the JSON output from inspect_netcdf.py
 */

/**
 * Represents a single variable (coordinate or data variable) in a NetCDF dataset.
 */
export interface NetCDFVariable {
  /** Dimension names for this variable */
  dims: string[];
  /** Shape of the array (size of each dimension) */
  shape: number[];
  /** Data type (e.g., 'float32', 'int64', 'datetime64[ns]') */
  dtype: string;
  /** Variable attributes (units, long_name, etc.) */
  attrs: Record<string, unknown>;
  /** First N sample values from the variable */
  sample_data: (number | string | null)[];
  /** Encoding information (compression, fill value, etc.) */
  encoding: Record<string, unknown>;
}

/**
 * Represents a complete NetCDF dataset as returned by inspect_netcdf.py
 */
export interface NetCDFDataset {
  /** Dimension names mapped to their sizes */
  dims: Record<string, number>;
  /** Coordinate variables */
  coords: Record<string, NetCDFVariable>;
  /** Data variables */
  data_vars: Record<string, NetCDFVariable>;
  /** Global attributes */
  attrs?: Record<string, unknown>;
}

/**
 * Response from the Python inspection script.
 * Either contains a valid dataset or an error message.
 */
export type InspectResult =
  | NetCDFDataset
  | { error: string };

/**
 * Helper type guard to check if the result is an error
 */
export function isInspectError(result: InspectResult): result is { error: string } {
  return 'error' in result && typeof result.error === 'string';
}

/**
 * Stored state for a loaded NetCDF file
 */
export interface StoredNetCDF {
  /** URI of the opened file */
  uri: { fsPath: string };
  /** Parsed dataset */
  dataset: NetCDFDataset;
}

/**
 * Variable with name attached (used when passing to webviews)
 */
export interface NamedVariable extends NetCDFVariable {
  /** Variable name */
  name: string;
  /** Optional label for display */
  label?: string;
}
