import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});

test('Extension should be present', () => {
  const ext = vscode.extensions.getExtension('RichardMcDonald.netcdf-viewer');
  assert.ok(ext, 'Extension not found');
});

test('NetCDF Explorer provider should be registered', () => {
  let treeViewCreated = false;
  try {
    vscode.window.createTreeView('netcdfExplorer', {
      treeDataProvider: {
        getChildren: () => [],
        getTreeItem: (item: any) => item,
      },
    });
    treeViewCreated = true;
  } catch (e) {
    treeViewCreated = false;
  }
  assert.ok(treeViewCreated, 'NetCDF Explorer TreeView could not be created');
});

test('NetCDFTreeProvider returns root nodes', async () => {
  const { NetCDFTreeProvider } = await import('../extension');
  const mockContext = {
    workspaceState: {
      get: () => ({
        dataset: {
          dims: { lat: 2, lon: 3 },
          coords: {},
          data_vars: {},
        },
      }),
    },
  };
  const provider = new NetCDFTreeProvider(mockContext as any);
  const roots = await provider.getChildren();
  const labels = roots.map((item: any) => item.label);
  assert.deepStrictEqual(labels, ['NetCDF File']); // or the actual file name if you mock it
});

test('NetCDFTreeProvider returns dimension children', async () => {
  const { NetCDFTreeProvider } = await import('../extension');
  const mockContext = {
    workspaceState: {
      get: () => ({
        uri: { fsPath: '/path/to/test.nc' },
        dataset: {
          dims: { lat: 2, lon: 3 },
          coords: {},
          data_vars: {},
        },
      }),
    },
  };
  const provider = new NetCDFTreeProvider(mockContext as any);
  const roots = await provider.getChildren();
  const fileNode = roots[0];
  const branches = await provider.getChildren(fileNode);
  const dimsNode = branches.find((item: any) => item.label === 'Dimensions');
  const dimChildren = await provider.getChildren(dimsNode);
  const dimLabels = dimChildren.map((item: any) => item.label);
  assert.deepStrictEqual(dimLabels, ['lat (2)', 'lon (3)']);
});

test('NetCDFTreeProvider shows attributes for variables', async () => {
  const { NetCDFTreeProvider } = await import('../extension');
  const mockContext = {
    workspaceState: {
      get: () => ({
        uri: { fsPath: '/path/to/test.nc' },
        dataset: {
          dims: {},
          coords: {
            time: {
              attrs: { standard_name: 'time', axis: 'T' },
              sample_data: [0, 1, 2],
              encoding: {},
            },
          },
          data_vars: {
            temp: {
              attrs: { units: 'K', long_name: 'Temperature' },
              sample_data: [273.15, 274.15],
              encoding: {},
            },
          },
        },
      }),
    },
  };

  test('NetCDFTreeProvider shows file name as root', async () => {
    const { NetCDFTreeProvider } = await import('../extension');
    const mockContext = {
      workspaceState: {
        get: () => ({
          uri: { fsPath: '/path/to/test.nc' },
          dataset: {
            dims: {},
            coords: {},
            data_vars: {},
          },
        }),
      },
    };
    const provider = new NetCDFTreeProvider(mockContext as any);
    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].label, 'test.nc');

    // Check that the children of the file node are the main branches
    const branches = await provider.getChildren(roots[0]);
    const branchLabels = branches.map((item: any) => item.label);
    assert.deepStrictEqual(branchLabels, ['Dimensions', 'Coordinates', 'Data Variables']);
  });

  const provider = new NetCDFTreeProvider(mockContext as any);
  const roots = await provider.getChildren();
  const fileNode = roots[0];
  const branches = await provider.getChildren(fileNode);

  // Test for coordinate variable
  const coordsNode = branches.find((item: any) => item.label === 'Coordinates');
  const coordVars = await provider.getChildren(coordsNode);
  const timeVar = coordVars.find((item: any) => item.label === 'time');
  const timeChildren = await provider.getChildren(timeVar);
  const attrsNode = timeChildren.find((item: any) => item.label === 'Attributes');
  assert.ok(attrsNode, 'Attributes branch not found for coordinate variable');
  const attrChildren = await provider.getChildren(attrsNode);
  const attrLabels = attrChildren.map((item: any) => item.label);
  assert.deepStrictEqual(attrLabels, ['standard_name: "time"', 'axis: "T"']);

  // Test for data variable
  const dataVarsNode = branches.find((item: any) => item.label === 'Data Variables');
  const dataVars = await provider.getChildren(dataVarsNode);
  const tempVar = dataVars.find((item: any) => item.label === 'temp');
  const tempChildren = await provider.getChildren(tempVar);
  const tempAttrsNode = tempChildren.find((item: any) => item.label === 'Attributes');
  assert.ok(tempAttrsNode, 'Attributes branch not found for data variable');
  const tempAttrChildren = await provider.getChildren(tempAttrsNode);
  const tempAttrLabels = tempAttrChildren.map((item: any) => item.label);
assert.deepStrictEqual(tempAttrLabels, ['units: "K"', 'long_name: "Temperature"']);
});

test('NetCDFTreeProvider returns empty array when no dataset', async () => {
  const { NetCDFTreeProvider } = await import('../extension');
  const mockContext = {
    workspaceState: {
      get: () => undefined,
    },
  };

  const provider = new NetCDFTreeProvider(mockContext as any);
  const children = await provider.getChildren();
  assert.deepStrictEqual(children, []);
});
