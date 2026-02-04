import * as path from 'path';
import * as vscode from 'vscode';
import { NetCDFDataset, NamedVariable, StoredNetCDF } from '../types';

/** Data attached to tree items - either the full dataset or a named variable */
export type TreeItemData = NetCDFDataset | NamedVariable | undefined;

/**
 * Represents an item in the NetCDF Explorer tree view.
 */
export class NetCDFTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly state: vscode.TreeItemCollapsibleState,
    public readonly data: TreeItemData = undefined,
    public readonly contextValue: string = ''
  ) {
    super(label, state);
    this.contextValue = contextValue;
  }
}

/**
 * Provides data (variables) for the NetCDF Explorer tree view.
 */
export class NetCDFTreeProvider implements vscode.TreeDataProvider<NetCDFTreeItem> {
  private _onDidChange = new vscode.EventEmitter<NetCDFTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  /** Refresh the entire tree */
  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(item: NetCDFTreeItem): vscode.TreeItem {
    return item;
  }

  async getChildren(element?: NetCDFTreeItem): Promise<NetCDFTreeItem[]> {
    const stored = this.context.workspaceState.get<StoredNetCDF>('lastNetCDF');
    if (!stored?.dataset) {
      return [];
    }
    const ds: NetCDFDataset = stored.dataset;
    const fileName = stored.uri ? path.basename(stored.uri.fsPath) : 'NetCDF File';

    // If no element, show the file name as the root
    if (!element) {
      return [new NetCDFTreeItem(fileName, vscode.TreeItemCollapsibleState.Expanded, ds, 'file')];
    }

    // If the element is the file node, show the main branches
    if (element.contextValue === 'file') {
      return [
        new NetCDFTreeItem('Dimensions', vscode.TreeItemCollapsibleState.Collapsed),
        new NetCDFTreeItem('Coordinates', vscode.TreeItemCollapsibleState.Collapsed),
        new NetCDFTreeItem('Data Variables', vscode.TreeItemCollapsibleState.Collapsed),
      ];
    }

    if (element.label === 'Dimensions') {
      return Object.entries(ds.dims || {}).map(
        ([dim, size]) => new NetCDFTreeItem(`${dim} (${size})`, vscode.TreeItemCollapsibleState.None)
      );
    }

    if (element.label === 'Coordinates') {
      return Object.entries(ds.coords || {}).map(([coordName, v]) => {
        const namedVar: NamedVariable = { ...v, name: coordName };
        return new NetCDFTreeItem(coordName, vscode.TreeItemCollapsibleState.Collapsed, namedVar, 'variable');
      });
    }

    if (element.label === 'Data Variables') {
      return Object.entries(ds.data_vars || {}).map(([varName, v]) => {
        const namedVar: NamedVariable = { ...v, name: varName };
        return new NetCDFTreeItem(varName, vscode.TreeItemCollapsibleState.Collapsed, namedVar, 'variable');
      });
    }

    // If this is a variable, show its attributes, sample data, and encoding as children
    if (element.contextValue === 'variable' && element.data) {
      const varData = element.data as NamedVariable;
      return [
        new NetCDFTreeItem('Attributes', vscode.TreeItemCollapsibleState.Collapsed, varData, 'attributes'),
        new NetCDFTreeItem('Sample Data', vscode.TreeItemCollapsibleState.Collapsed, varData, 'sample'),
        new NetCDFTreeItem('Encoding', vscode.TreeItemCollapsibleState.Collapsed, varData, 'encoding'),
      ];
    }

    // Show encoding children
    if (element.contextValue === 'encoding' && element.data) {
      const varData = element.data as NamedVariable;
      return Object.entries(varData.encoding || {}).map(
        ([k, v]) => new NetCDFTreeItem(`${k}: ${JSON.stringify(v)}`, vscode.TreeItemCollapsibleState.None)
      );
    }

    // Show attribute children
    if (element.contextValue === 'attributes' && element.data) {
      const varData = element.data as NamedVariable;
      return Object.entries(varData.attrs || {}).map(
        ([k, v]) => new NetCDFTreeItem(`${k}: ${JSON.stringify(v)}`, vscode.TreeItemCollapsibleState.None)
      );
    }

    // Show sample data children (sample size is configured via netcdfViewer.sampleSize)
    if (element.contextValue === 'sample' && element.data) {
      const varData = element.data as NamedVariable;
      const sampleData = Array.isArray(varData.sample_data) ? varData.sample_data : [];
      return sampleData.map((v, i) => new NetCDFTreeItem(`[${i}]: ${v}`, vscode.TreeItemCollapsibleState.None));
    }

    return [];
  }
}
