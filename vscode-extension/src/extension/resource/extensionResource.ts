import * as vscode from 'vscode';
import * as path from 'path';

export default class ExtensionResource {

    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public uri(...pathElements: string[]): vscode.Uri {
        return vscode.Uri.file(
            path.join(this.context.extensionPath, path.join(...pathElements))
        );
    }
}
