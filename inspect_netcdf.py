import contextlib
import sys
import xarray as xr
import json
import math
import numpy as np

def convert(obj):
    if isinstance(obj, (np.integer, np.floating)):
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None  # or str(val)
        return val
    if hasattr(obj, 'tolist'):
        return obj.tolist()
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    with contextlib.suppress(ImportError):
        import cftime
        if isinstance(obj, cftime.datetime):
            return obj.isoformat()
    return str(obj)

if len(sys.argv) < 2:
    print(json.dumps({"error": "No file provided"}))
    sys.exit(1)

try:
    ds = xr.open_dataset(sys.argv[1])
    d = ds.to_dict(data=False)  # Only metadata

    # Add a sample of data and encoding for each variable
    for varname, var in ds.data_vars.items():
        try:
            arr = var.values
            sample = arr.flat[:10] if arr.size > 10 else arr.flat[:]
            d['data_vars'][varname]['sample_data'] = [convert(x) for x in sample]
        except Exception as e:
            d['data_vars'][varname]['sample_data'] = [str(e)]
        # Add encoding
        try:
            d['data_vars'][varname]['encoding'] = {k: convert(v) for k, v in var.encoding.items()}
        except Exception as e:
            d['data_vars'][varname]['encoding'] = {"error": str(e)}

    # Add a sample of data and encoding for each coordinate variable
    for coordname, coord in ds.coords.items():
        try:
            arr = coord.values
            sample = arr.flat[:10] if arr.size > 10 else arr.flat[:]
            d['coords'][coordname]['sample_data'] = [convert(x) for x in sample]
        except Exception as e:
            d['coords'][coordname]['sample_data'] = [str(e)]
        # Add encoding
        try:
            d['coords'][coordname]['encoding'] = {k: convert(v) for k, v in coord.encoding.items()}
        except Exception as e:
            d['coords'][coordname]['encoding'] = {"error": str(e)}

    print(json.dumps(d, default=convert))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)