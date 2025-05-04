// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface PostfixDefinition {
    postfix: string;
    description: string;
    template: string;
}

function getDefaultPostfixDefinitions(): PostfixDefinition[] {
    return [
        { postfix: 'ap', description: 'append', template: '${expr} = append(${expr}, )' },
        { postfix: 'flen', description: 'for len loop', template: 'for i:=0;i<len(${expr});i++{}' },
        { postfix: 'nil', description: 'nil check', template: 'if ${expr} == nil {}' },
        { postfix: 'notnil', description: 'not nil check', template: 'if ${expr} != nil {}' },
        { postfix: 'print', description: 'fmt.Println', template: 'fmt.Println(${expr})' },
        { postfix: 'err', description: 'error check', template: 'if err := ${expr}; err != nil {\n\treturn err\n}' }
    ];
}

function loadPostfixDefinitions(context: vscode.ExtensionContext): PostfixDefinition[] {
    // Always open the editor UI when referencing .vscode/gopostfix.json
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let defPath = '';
    if (workspaceFolders && workspaceFolders.length > 0) {
        defPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'gopostfix.json');
    } else {
        defPath = path.join(context.extensionPath, '.vscode', 'gopostfix.json');
    }
    let defs = [];
    if (!fs.existsSync(defPath)) {
        // Create file with default definitions if not exists
        const defaultDefs = getDefaultPostfixDefinitions();
        fs.mkdirSync(path.dirname(defPath), { recursive: true });
        fs.writeFileSync(defPath, JSON.stringify(defaultDefs, null, 2), 'utf8');
        return defaultDefs;
    }
    if (fs.existsSync(defPath)) {
        defs = JSON.parse(fs.readFileSync(defPath, 'utf8'));
    }
    const panel = vscode.window.createWebviewPanel(
        'gopostfixEdit',
        'Go Postfix Definition Editor',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    panel.webview.html = getWebviewContent(defs);
    panel.webview.onDidReceiveMessage(async msg => {
        if (msg.type === 'save' && Array.isArray(msg.data)) {
            fs.writeFileSync(defPath, JSON.stringify(msg.data, null, 2), 'utf8');
            vscode.window.showInformationMessage('gopostfix.json has been saved');
            registerGoPostfixProvider(context); // Re-register provider on save
            // Reload Webview with latest definitions
            const latestDefs = JSON.parse(fs.readFileSync(defPath, 'utf8'));
            panel.webview.html = getWebviewContent(latestDefs);
        } else if (msg.type === 'close') {
            panel.dispose();
        }
    });
    return defs;
}

class GoPostfixCompletionProvider implements vscode.CompletionItemProvider {
    private definitions: PostfixDefinition[];

    constructor(definitions: PostfixDefinition[]) {
        this.definitions = definitions;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
        const line = document.lineAt(position).text.substring(0, position.character);

        const items: vscode.CompletionItem[] = [];

        for (const def of this.definitions) {
            const dotIndex = line.lastIndexOf('.');
            if (dotIndex === -1) continue;

            const expr = line.substring(0, dotIndex).trim();
            const typed = line.substring(dotIndex + 1, position.character);

            if (def.postfix.startsWith(typed)) {
                const insertText = def.template.replace(/\$\{expr\}/g, expr);

                const item = new vscode.CompletionItem(def.postfix, vscode.CompletionItemKind.Snippet);

                item.detail = def.description || insertText.replace(/\n/g, ' ').slice(0, 80);

                item.documentation = new vscode.MarkdownString(
                    `**Preview:**\n\n\`\`\`go\n${insertText}\n\`\`\``
                );

                item.insertText = new vscode.SnippetString(insertText);

                const startCharacter = line.length - (expr.length + typed.length + 1); // +1 for '.'
                item.range = new vscode.Range(
                    position.line,
                    startCharacter,
                    position.line,
                    position.character
                );

                item.filterText = line;
                item.preselect = true;
                items.push(item);
            }
        }

        return items;
    }
}
let providerDisposable: vscode.Disposable | undefined;

function registerGoPostfixProvider(context: vscode.ExtensionContext) {
    if (providerDisposable) {
        providerDisposable.dispose();
    }
    const definitions = loadPostfixDefinitions(context);
    providerDisposable = vscode.languages.registerCompletionItemProvider(
        { language: 'go', scheme: 'file' },
        new GoPostfixCompletionProvider(definitions),
        '.'
    );
    context.subscriptions.push(providerDisposable);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Register provider with the latest definitions on activation
    registerGoPostfixProvider(context);

    const disposable = vscode.commands.registerCommand('go-postfix.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Go Postfix Completion!');
    });

    context.subscriptions.push(disposable);

    // Command to edit gopostfix.json in a webview
    const editDefDisposable = vscode.commands.registerCommand('go-postfix.editDefinitions', (uri?: vscode.Uri) => {
        // Always use workspace .vscode/gopostfix.json for Webview
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let defPath = '';
        if (workspaceFolders && workspaceFolders.length > 0) {
            defPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'gopostfix.json');
        } else {
            defPath = path.join(context.extensionPath, '.vscode', 'gopostfix.json');
        }
        let defs = [];
        if (fs.existsSync(defPath)) {
            defs = JSON.parse(fs.readFileSync(defPath, 'utf8'));
        }
        const panel = vscode.window.createWebviewPanel(
            'gopostfixEdit',
            'Go Postfix Definition Editor',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel.webview.html = getWebviewContent(defs);
        panel.webview.onDidReceiveMessage(async msg => {
            if (msg.type === 'save' && Array.isArray(msg.data)) {
                fs.writeFileSync(defPath, JSON.stringify(msg.data, null, 2), 'utf8');
                vscode.window.showInformationMessage('gopostfix.json has been saved');
                registerGoPostfixProvider(context); // Re-register provider on save
                // Reload Webview with latest definitions
                const latestDefs = JSON.parse(fs.readFileSync(defPath, 'utf8'));
                panel.webview.html = getWebviewContent(latestDefs);
            } else if (msg.type === 'close') {
                panel.dispose();
            }
        });
    });
    context.subscriptions.push(editDefDisposable);
}

function getWebviewContent(defs: any[]): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Go Postfix Definition Editor</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: sans-serif; margin: 0; padding: 16px; }
        #list { float: left; width: 30%; border-right: 1px solid #ccc; height: 400px; overflow-y: auto; }
        #detail { float: left; width: 68%; margin-left: 2%; }
        .item { cursor: pointer; padding: 4px; border-bottom: 1px solid #eee; }
        .item.selected { background: #e0f0ff; }
        label { display: block; margin-top: 8px; }
        input, textarea { width: 100%; }
        #buttons { margin-top: 16px; }
        #deleteBtn { color: #fff; background: #d00; border: none; margin-left: 8px; }
        .header { font-weight: bold; background: linear-gradient(#336699, #224466); color: white; padding: 6px; border-bottom: 2px solid #ccc; }
        .row { display: grid; grid-template-columns: 1fr 1fr; padding: 4px 10px; align-items: center; }
        .row span:nth-child(1) { border-right: 1px solid #aaa; padding-right: 6px; }
        .row span:nth-child(2) { padding-left: 6px; text-align: left; }
        #error { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div id="list">
        <div class="header row"><span>Postfix</span><span>Description</span></div>
        <div id="listItems"></div>
        <div class="item row" onclick="openNewEditor()"><span style="color:#888;">＋ Add New</span><span></span></div>
    </div>
    <div id="detail">
        <div id="detailForm" style="display:none;">
            <div id="error"></div>
            <label>Postfix:<input id="postfix" /></label>
            <label>Description:<input id="description" /></label>
            <label>Template:<textarea id="template" rows="4"></textarea></label>
            <div id="buttons">
                <button onclick="saveEdit()">Save</button>
                <button onclick="cancelEdit()">Cancel</button>
                <button id="deleteBtn" onclick="deleteDef()">Delete</button>
            </div>
        </div>
        <div id="noSelect">Please select or add a definition to edit.</div>
    </div>
    <script>
    const vscode = acquireVsCodeApi();
    let defs = ${JSON.stringify(defs)};
    let selected = -1;
    let editingNew = false;

    function renderList() {
        const container = document.getElementById('listItems');
        container.innerHTML = defs.map((d, i) => {
            const display = d.postfix || '(empty)';
            const desc = d.description || '';
            return '<div class="item row' + (i === selected ? ' selected' : '') +
                '" onclick="selectDef(' + i + ')"><span>' + escapeHtml(display) + '</span><span>' + escapeHtml(desc) + '</span></div>';
        }).join('');
        setTimeout(function() {
            var delBtn = document.getElementById('deleteBtn');
            if (delBtn) delBtn.onclick = deleteDef;
        }, 0);
    }

    function selectDef(idx) {
        selected = idx;
        editingNew = false;
        const def = defs[idx];
        showEditor(def.postfix, def.description, def.template);
    }

    function openNewEditor() {
        selected = -1;
        editingNew = true;
        showEditor('', '', '');
    }

    function showEditor(pf, desc, tmpl) {
        document.getElementById('postfix').value = pf;
        document.getElementById('description').value = desc;
        document.getElementById('template').value = tmpl;
        document.getElementById('error').innerText = '';
        document.getElementById('detailForm').style.display = '';
        document.getElementById('noSelect').style.display = 'none';
        var delBtn = document.getElementById('deleteBtn');
        if (delBtn) delBtn.onclick = deleteDef;
    }

    function saveEdit() {
        const pf = document.getElementById('postfix').value.trim();
        const desc = document.getElementById('description').value;
        const tmpl = document.getElementById('template').value;
        if (!pf) {
            showError('Postfix is required.');
            return;
        }
        const dup = defs.findIndex((d, i) => d.postfix === pf && i !== selected);
        if (dup >= 0) {
            showError('Duplicate postfix.');
            return;
        }
        if (editingNew) {
            defs.push({ postfix: pf, description: desc, template: tmpl });
        } else {
            defs[selected] = { postfix: pf, description: desc, template: tmpl };
        }
        vscode.postMessage({ type: 'save', data: defs });
        closeEditor(); // Just close the editor, do not close the whole webview
    }

    function deleteDef() {
        if (selected < 0) return;
        defs[selected] = { postfix: '', description: '', template: '' };
        defs = defs.filter(d => d.postfix !== '' || d.description !== '' || d.template !== '');
        vscode.postMessage({ type: 'save', data: defs }); // Save after delete
        closeEditor();
        renderList();
    }

    function cancelEdit() {
        closeEditor();
    }

    function closeEditor() {
        selected = -1;
        editingNew = false;
        document.getElementById('detailForm').style.display = 'none';
        document.getElementById('noSelect').style.display = '';
        document.getElementById('error').innerText = '';
        renderList();
    }

    function showError(msg) {
        document.getElementById('error').innerText = msg;
    }

    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, function (m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m];
        });
    }

    renderList();
    </script>
</body>
</html>
    `;
}

function escapeHtml(str: string): string {
    return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','\"':'&quot;'}[c]||c));
}

// This method is called when your extension is deactivated
export function deactivate() {}
