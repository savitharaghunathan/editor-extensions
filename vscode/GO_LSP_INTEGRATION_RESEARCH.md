# Go LSP Integration Research

## Overview

This document contains comprehensive research on integrating Go language support into the Kai analyzer using VS Code's built-in commands and the Go extension, avoiding the need to spawn additional gopls processes.

## Goal

Add Go language support to Kai analyzer using Generic External Provider while reusing VS Code Go extension's existing gopls instance through a translation bridge.

## Architecture

```
Kai Analyzer ←→ Named Pipe (RPC) ←→ VS Code Extension ←→ VS Code Built-in Commands ←→ Go Extension ←→ gopls
```

## Research Process

### Initial Investigation

**Problem**: How to access Go extension's gopls instance without spawning extra processes.

**Discovery**: Unlike Java extension which exposes `java.execute.workspaceCommand`, Go extension doesn't provide a generic command proxy. However, VS Code provides universal built-in commands that work with any language extension.

### Key Breakthrough

VS Code built-in commands like `vscode.executeDefinitionProvider` automatically route to the appropriate language extension (Go, Java, etc.) without needing extension-specific APIs.

## VS Code Command Testing

### Test Results ✅

Successfully tested these VS Code commands with Go extension:

```typescript
// Workspace symbols: 100 found
await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", "main");

// Document symbols: 19 found
await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri);

// Definitions: 1 found
await vscode.commands.executeCommand("vscode.executeDefinitionProvider", uri, position);

// References: 2 found
await vscode.commands.executeCommand("vscode.executeReferenceProvider", uri, position);
```

### Response Format

VS Code commands return JavaScript objects (not JSON):

```javascript
// Definition response example
[
  {
    uri: Uri {
      scheme: "file",
      path: "/Users/sraghuna/local_dev/analyzer-lsp/lsp/base_service_client/base_service_client.go"
    },
    range: Range {
      start: Position { line: 36, character: 5 },
      end: Position { line: 36, character: 27 }
    }
  }
]
```

## LSP to VS Code Command Mappings

### Core Navigation Commands

| LSP Method                   | VS Code Command                       | Return Type                      |
| ---------------------------- | ------------------------------------- | -------------------------------- |
| `textDocument/definition`    | `vscode.executeDefinitionProvider`    | `Location[]` \| `LocationLink[]` |
| `textDocument/references`    | `vscode.executeReferenceProvider`     | `Location[]`                     |
| `textDocument/hover`         | `vscode.executeHoverProvider`         | `Hover[]`                        |
| `textDocument/signatureHelp` | `vscode.executeSignatureHelpProvider` | `SignatureHelp`                  |

### Symbol & Search Commands

| LSP Method                       | VS Code Command                           | Return Type                                 |
| -------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `textDocument/documentSymbol`    | `vscode.executeDocumentSymbolProvider`    | `DocumentSymbol[]` \| `SymbolInformation[]` |
| `workspace/symbol`               | `vscode.executeWorkspaceSymbolProvider`   | `SymbolInformation[]`                       |
| `textDocument/documentHighlight` | `vscode.executeDocumentHighlightProvider` | `DocumentHighlight[]`                       |

### Code Intelligence Commands

| LSP Method                     | VS Code Command                        | Return Type                            |
| ------------------------------ | -------------------------------------- | -------------------------------------- |
| `textDocument/completion`      | `vscode.executeCompletionItemProvider` | `CompletionList` \| `CompletionItem[]` |
| `textDocument/codeAction`      | `vscode.executeCodeActionProvider`     | `CodeAction[]`                         |
| `textDocument/codeLens`        | `vscode.executeCodeLensProvider`       | `CodeLens[]`                           |
| `textDocument/formatting`      | `vscode.executeFormatDocumentProvider` | `TextEdit[]`                           |
| `textDocument/rangeFormatting` | `vscode.executeFormatRangeProvider`    | `TextEdit[]`                           |
| `textDocument/rename`          | `vscode.executeDocumentRenameProvider` | `WorkspaceEdit`                        |

### Advanced Features

| LSP Method                          | VS Code Command                        | Return Type                      |
| ----------------------------------- | -------------------------------------- | -------------------------------- |
| `textDocument/implementation`       | `vscode.executeImplementationProvider` | `Location[]` \| `LocationLink[]` |
| `textDocument/typeDefinition`       | `vscode.executeTypeDefinitionProvider` | `Location[]` \| `LocationLink[]` |
| `textDocument/declaration`          | `vscode.executeDeclarationProvider`    | `Location[]` \| `LocationLink[]` |
| `textDocument/prepareCallHierarchy` | `vscode.prepareCallHierarchy`          | `CallHierarchyItem[]`            |
| `callHierarchy/incomingCalls`       | `vscode.provideIncomingCalls`          | `CallHierarchyIncomingCall[]`    |
| `callHierarchy/outgoingCalls`       | `vscode.provideOutgoingCalls`          | `CallHierarchyOutgoingCall[]`    |

## TypeScript Type Definitions

### Core Types

```typescript
interface Location {
  uri: Uri;
  range: Range;
}

interface LocationLink {
  originSelectionRange?: Range;
  targetUri: Uri;
  targetRange: Range;
  targetSelectionRange?: Range;
}

interface Range {
  start: Position;
  end: Position;
}

interface Position {
  line: number; // 0-based
  character: number; // 0-based
}

interface Uri {
  scheme: string; // "file"
  path: string; // "/path/to/file.go"
  fsPath: string; // OS-specific path
}
```

### Symbol Types

```typescript
interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

interface SymbolInformation {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
}

enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}
```

### Other Key Types

```typescript
interface Hover {
  contents: MarkdownString[] | MarkedString[];
  range?: Range;
}

interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string | MarkdownString;
  insertText?: string;
  range?: Range;
}

interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}
```

## Data Conversion Requirements

### JavaScript Objects to LSP JSON

VS Code commands return JavaScript objects that need conversion to LSP JSON format:

```typescript
// VS Code response (JavaScript objects)
const vsCodeResult = await vscode.commands.executeCommand(
  "vscode.executeDefinitionProvider",
  uri,
  pos,
);

// Convert to LSP format
const lspResponse = {
  jsonrpc: "2.0",
  id: requestId,
  result: vsCodeResult.map((location) => ({
    uri: location.uri.toString(), // Convert Uri to string
    range: {
      start: {
        line: location.range.start.line,
        character: location.range.start.character,
      },
      end: {
        line: location.range.end.line,
        character: location.range.end.character,
      },
    },
  })),
};
```

### Key Conversion Points

1. **Uri objects** → `uri.toString()` or `uri.path`
2. **Position/Range objects** → Extract `.line` and `.character` properties
3. **Class instances** → Plain objects with extracted properties
4. **Wrap in LSP envelope** → Add `jsonrpc`, `id`, `result` fields

## Implementation Plan

### Phase 1: Extend RPC Handler ✅

Modify the existing `workspace/executeCommand` handler in `analyzerClient.ts` to support Go commands alongside Java commands.

### Phase 2: Translation Bridge

Create translation logic to map LSP requests to VS Code commands:

```typescript
async function translateLspToVsCode(method: string, params: any): Promise<any> {
  switch (method) {
    case "textDocument/definition":
      return await vscode.commands.executeCommand(
        "vscode.executeDefinitionProvider",
        vscode.Uri.parse(params.textDocument.uri),
        new vscode.Position(params.position.line, params.position.character),
      );

    case "textDocument/references":
      return await vscode.commands.executeCommand(
        "vscode.executeReferenceProvider",
        vscode.Uri.parse(params.textDocument.uri),
        new vscode.Position(params.position.line, params.position.character),
      );

    // ... more cases
  }
}
```

### Phase 3: Response Serialization

Convert VS Code responses back to LSP format for transmission to Kai analyzer.

### Phase 4: Generic External Provider Setup

Configure Kai analyzer to use Generic External Provider with the VS Code translation bridge.

## File Modifications Made

### 1. package.json

- Added `"golang.go"` to `extensionDependencies` for automatic Go extension installation

### 2. extension.ts

- Added `checkGoExtensionInstalled()` method similar to Java extension detection
- Added `hasGoFiles()` utility to detect Go projects via `go.mod` presence
- Added conditional Go extension checking only when Go files are detected
- Integrated Go extension status into extension initialization flow

### 3. analyzerClient.ts (existing structure)

- Contains RPC communication pattern with `workspace/executeCommand` handler
- Uses named pipe for bidirectional communication with external providers
- Ready for extension to handle Go commands alongside Java commands

## Current Status

✅ **Completed:**

- Go extension dependency added to package.json
- Go extension detection implemented in extension.ts
- VS Code Go commands successfully tested and validated
- Command mappings and return types documented
- Data conversion requirements identified

🔄 **Next Steps:**

- Implement translation bridge in VS Code extension
- Extend RPC handler for Go-specific commands
- Test with actual Kai analyzer using Generic External Provider
- Performance optimization and error handling

## Key Insights

1. **Universal Commands**: VS Code built-in commands work with any language extension, eliminating the need for extension-specific APIs
2. **No Socket Access**: VS Code deliberately abstracts transport layers for security, making command-based approach the correct solution
3. **Object vs JSON**: VS Code returns JavaScript objects that require serialization to LSP JSON format
4. **Position-based**: Success depends on cursor position being on actual symbols (not whitespace/comments)
5. **Automatic Routing**: VS Code handles language detection and routing to appropriate extensions automatically

This research validates that the VS Code command-based approach is both feasible and optimal for integrating Go support into Kai analyzer.
