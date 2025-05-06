# Go Postfix Completion

A Visual Studio Code extension that provides postfix completion for the Go language. Definitions are managed in an external JSON file and can be edited via a Webview UI.

## Features
- Postfix completion for Go files (e.g. `a.ap` expands to `a = append(a, )`)
- All postfix definitions are managed in `.vscode/gopostfix.json` in your workspace
- Edit definitions with a user-friendly Webview editor (command: "Go Postfix Definition Editor")
- Right-click `gopostfix.json` in the file explorer to open the editor
- Changes are immediately reflected in completion suggestions

## Usage
1. Open a Go file and type a dot (`.`) followed by a defined postfix (e.g. `ap`, `flen`, etc.) to trigger completion
2. To edit postfix definitions, run the command "Go Postfix Definition Editor" from the Command Palette or right-click `gopostfix.json` in the explorer
3. Add, edit, or delete definitions in the Webview and click Save

## Definition File Example (`.vscode/gopostfix.json`)
```json
[
  {
    "postfix": "ap",
    "description": "append",
    "template": "${expr} = append(${expr}, )"
  },
  {
    "postfix": "flen",
    "description": "for len loop",
    "template": "for i:=0;i<len(${expr});i++"
  },
  {
    "postfix": "nil",
    "description": "nil check",
    "template": "if ${expr} == nil {}"
  },
  {
    "postfix": "err",
    "description": "error check",
    "template": "if err := ${expr}; err != nil {\n\treturn err\n}"
  }
]
```

## Requirements
- VS Code 1.70 or later
- Go extension for VS Code (recommended)

## Known Issues
- Only one workspace folder is supported for definition file location
- The extension only works with Go files (`.go`)

## Release Notes
### 0.1.0
- Initial release: Go postfix completion, external definition file, Webview editor

---

Enjoy Go Postfix Completion!
