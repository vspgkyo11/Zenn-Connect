import * as vscode from 'vscode';
import PreviewViewManager from './preview/previewViewManager';
import { ZennTeeViewManager } from './treeView/zennTreeViewManager';
import { ZennCli } from './zenncli/zennCli';
import Uri from './util/uri';
import ZennVersion from './zenncli/zennVersion';
import { PreviewDocument } from './preview/previewDocument';

const treeViewManager = ZennTeeViewManager.create();

export function activate(context: vscode.ExtensionContext) {
    vscode.commands.executeCommand('setContext', 'zenn-editor.activated', true);
    vscode.commands.executeCommand('setContext', 'zenn-editor.previewable-language-ids', ['markdown', 'yaml']);
    context.subscriptions.push(
        treeViewManager.openTreeView(context),
        vscode.commands.registerCommand('zenn-editor.refresh-tree-view', () => treeViewManager.refresh()),
        vscode.commands.registerCommand('zenn-editor.open-tree-view-item', openTreeViewItem()),
        vscode.commands.registerCommand('zenn-editor.preview', previewDocument(context)),
        vscode.commands.registerCommand('zenn-editor.create-new-article', createNewArticle()),
        vscode.commands.registerCommand('zenn-editor.create-new-book', createNewBook()),
        vscode.commands.registerCommand('zenn-editor.open-image-uploader', openImageUploader()),
        vscode.window.onDidChangeActiveTextEditor(editor => onDidChangeActiveTextEditor(editor)),
        vscode.workspace.onDidCreateFiles(() => onDidCreateFiles()),
        vscode.workspace.onDidDeleteFiles(() => onDidDeleteFiles()),
        vscode.workspace.onDidRenameFiles(() => onDidRenameFiles()),
        vscode.workspace.onDidSaveTextDocument(d => onDidSaveTextDocument(d)),
    );
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    console.log('zenn-editor-local is now active');
}

export function deactivate() {}

const previewViewManager = PreviewViewManager.create();

function previewDocument(context: vscode.ExtensionContext) {
    return (uri?: vscode.Uri) => {
        if (uri) {
            const documentUri = Uri.of(uri);
            checkZennCliVersion(documentUri.workspaceDirectory());
            previewViewManager.openPreview(documentUri, context);
        }
    };
}

async function checkZennCliVersion(workspace: Uri | undefined) {
    if (workspace) {
        const zennCli = await ZennCli.create(workspace);
        const version = await zennCli.version();
        const requireVersion = ZennVersion.create('0.1.143');
        if (version.compare(requireVersion) < 0) {
            vscode.window.showWarningMessage(`zenn-cli の更新を推奨します（現在のバージョン: ${version.displayVersion}）`);
        }
    }
}

function createNewArticle() {
    return async () => {
        const workspace = await treeViewManager.activeWorkspace();
        const cli = await ZennCli.create(workspace.rootDirectory);
        const newArticle = await cli.createNewArticle();
        await treeViewManager.refresh(newArticle.articleUri);
        try {
            const doc = await vscode.workspace.openTextDocument(newArticle.articleUri.underlying);
            return await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        } catch (e: any) {
            vscode.window.showErrorMessage(e.toString());
        }
    };
}

function createNewBook() {
    return async () => {
        const workspace = await treeViewManager.activeWorkspace();
        const cli = await ZennCli.create(workspace.rootDirectory);
        const newBook = await cli.createNewBook();
        await treeViewManager.refresh(newBook.configUri);
        try {
            const doc = await vscode.workspace.openTextDocument(newBook.configUri.underlying);
            return await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        } catch (e: any) {
            vscode.window.showErrorMessage(e.toString());
        }
    };
}

function openImageUploader() {
    return () => {
        vscode.env.openExternal(vscode.Uri.parse('https://zenn.dev/dashboard/uploader'));
    };
}

function openTreeViewItem() {
    return async (uri?: vscode.Uri) => {
        if (uri) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                return await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, true);
            } catch (e) {
                vscode.commands.executeCommand('vscode.open', uri, { viewColumn: vscode.ViewColumn.One });
            }
        }
    };
}

async function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor) {
        const uri = Uri.of(editor.document.uri);
        const document = PreviewDocument.create(uri);
        vscode.commands.executeCommand('setContext', 'zenn-editor.active-text-editor-is-previewable', document.isPreviewable());
        const item = await treeViewManager.selectItem(uri, 1);
        if (item) {
            checkZennCliVersion(uri.workspaceDirectory());
            await previewViewManager.changePreviewDocument(editor.document);
        }
    }
}

async function onDidSaveTextDocument(document: vscode.TextDocument): Promise<void> {
    return treeViewManager.refresh(Uri.of(document.uri));
}

async function onDidCreateFiles(): Promise<void> {
    return treeViewManager.refresh();
}

async function onDidDeleteFiles(): Promise<void> {
    return treeViewManager.refresh();
}

async function onDidRenameFiles(): Promise<void> {
    return treeViewManager.refresh();
}
