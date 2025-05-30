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
    const ext = vscode.extensions.getExtension('rmcd-mscb.netcdf-viewer');
    assert.ok(ext, 'Extension not found');
});

test('NetCDF Explorer provider should be registered', () => {
    let treeViewCreated = false;
    try {
        vscode.window.createTreeView('netcdfExplorer', { treeDataProvider: { getChildren: () => [], getTreeItem: (item: any) => item } });
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
                    data_vars: {}
                }
            })
        }
    };
    const provider = new NetCDFTreeProvider(mockContext as any);
    const roots = await provider.getChildren();
    const labels = roots.map((item: any) => item.label);
    assert.deepStrictEqual(labels, ['Dimensions', 'Coordinates', 'Data Variables']);
});

test('NetCDFTreeProvider returns dimension children', async () => {
    const { NetCDFTreeProvider } = await import('../extension');
    const mockContext = {
        workspaceState: {
            get: () => ({
                dataset: {
                    dims: { lat: 2, lon: 3 },
                    coords: {},
                    data_vars: {}
                }
            })
        }
    };
    const provider = new NetCDFTreeProvider(mockContext as any);
    const roots = await provider.getChildren();
    const dimsNode = roots.find((item: any) => item.label === 'Dimensions');
    const dimChildren = await provider.getChildren(dimsNode);
    const dimLabels = dimChildren.map((item: any) => item.label);
    assert.deepStrictEqual(dimLabels, ['lat (2)', 'lon (3)']);
});