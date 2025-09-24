# Language Detection & Selection Research

## Overview

Research and brainstorming for implementing Phase 2 of the migration profile programming language feature: Language Detection & Selection.

## VS Code Language APIs - Key Resources

### 1. Core Language Detection APIs

- **`vscode.workspace.textDocuments`** - Get all open documents with their language IDs
- **`vscode.languages.getLanguages()`** - Get all available language identifiers
- **`vscode.workspace.findFiles()`** - Search for files by patterns
- **Document Language ID** - Every TextDocument has a `languageId` property

### 2. File System Analysis APIs

- **`vscode.workspace.workspaceFolders`** - Get workspace root folders
- **`vscode.workspace.fs`** - File system operations
- **`vscode.workspace.createFileSystemWatcher()`** - Watch for file changes

## Language Detection Strategies

### Strategy 1: File Extension Analysis

```typescript
// Scan workspace for dominant file types
const filePatterns = {
  Java: ["**/*.java", "**/pom.xml", "**/build.gradle"],
  Go: ["**/*.go", "**/go.mod", "**/go.sum"],
  Python: ["**/*.py", "**/requirements.txt", "**/setup.py"],
  JavaScript: ["**/*.js", "**/package.json"],
  TypeScript: ["**/*.ts", "**/tsconfig.json"],
};
```

### Strategy 2: Build File Detection

```typescript
// Priority-based detection using build files
const buildFileMarkers = [
  { pattern: "**/pom.xml", language: "Java", weight: 10 },
  { pattern: "**/build.gradle", language: "Java", weight: 10 },
  { pattern: "**/go.mod", language: "Go", weight: 10 },
  { pattern: "**/package.json", language: "JavaScript", weight: 8 },
  { pattern: "**/requirements.txt", language: "Python", weight: 8 },
];
```

### Strategy 3: Content-Based Detection

Using the existing `shared/src/utils/languageMapping.ts` content patterns for ambiguous cases.

## Architecture Design Options

### Option A: Reactive Detection Service

```typescript
class LanguageDetectionService {
  private _onLanguageChanged = new vscode.EventEmitter<string>();
  readonly onLanguageChanged = this._onLanguageChanged.event;

  async detectPrimaryLanguage(): Promise<string>;
  watchForLanguageChanges(): void;
  getLanguageStats(): Promise<LanguageStats>;
}
```

### Option B: On-Demand Detection

```typescript
// Simple utility functions
export async function detectWorkspaceLanguage(): Promise<string>;
export async function getLanguageDistribution(): Promise<Map<string, number>>;
export async function suggestLanguageForProfile(): Promise<string[]>;
```

## UI Integration Points

### 1. Profiles Webview Enhancement

- **Location**: `webview-ui/src/components/ProfilesPage/`
- **Component**: Language selector dropdown in profile creation/edit form
- **Data Flow**: Webview ↔ Extension ↔ Language Detection Service

### 2. Profile Form Updates

```typescript
interface ProfileFormData {
  name: string;
  language: string; // New field
  labelSelector: string;
  customRules: string[];
  useDefaultRules: boolean;
}
```

### 3. Language Auto-Detection UI

- **Smart suggestions** based on workspace analysis
- **Manual override** option for users
- **Language confidence indicator** (High/Medium/Low)

## Implementation Approaches

### Approach 1: Gradual Enhancement

1. Start with simple file extension counting
2. Add build file detection
3. Integrate content-based detection
4. Add ML-based suggestions (future)

### Approach 2: Comprehensive Analysis

1. Multi-strategy detection engine
2. Weighted scoring system
3. Confidence levels
4. Historical learning (profile usage patterns)

## Existing Codebase Integration Points

### Files to Examine:

- `vscode/src/extension.ts` - Main activation point
- `webview-ui/src/components/ProfilesPage/` - UI components
- `vscode/src/webviewMessageHandler.ts` - Webview communication
- `shared/src/utils/languageMapping.ts` - Already has detection utilities!

### Message Passing Protocol:

```typescript
// Extension → Webview
type DetectLanguageMessage = {
  type: "detectLanguage";
  result: {
    primaryLanguage: string;
    suggestions: string[];
    confidence: "high" | "medium" | "low";
  };
};

// Webview → Extension
type RequestLanguageDetectionMessage = {
  type: "requestLanguageDetection";
  workspacePath?: string;
};
```

## Research References

### VS Code API Documentation:

- **Language Features**: https://code.visualstudio.com/api/language-extensions/overview
- **Workspace API**: https://code.visualstudio.com/api/references/vscode-api#workspace
- **File System API**: https://code.visualstudio.com/api/references/vscode-api#FileSystem

### Similar Extensions for Reference:

- **Language detection patterns** used by syntax highlighters
- **Project type detection** in build tool extensions
- **Workspace analysis** in linting extensions

## Implementation Strategy Questions

### Technical Decisions:

1. **Which detection strategy** should we prioritize? (File-based vs Content-based vs Hybrid)
2. **How automatic** should the detection be? (Auto-select vs Suggest vs Manual)
3. **Where in the UI** should language selection appear? (Profile creation vs Global setting vs Both)
4. **Fallback behavior** when detection is uncertain?
5. **Performance considerations** for large workspaces?

### Integration Considerations:

- The existing `languageMapping.ts` utility is a great foundation - we already have comprehensive file extension and content detection patterns!
- Need to coordinate with existing profile service architecture
- Consider impact on existing bundled profiles
- Plan for backward compatibility with profiles without language specified

## Current Implementation Status

### Completed:

- ✅ Added `language?: string` field to `AnalysisProfile` interface
- ✅ Added `getProgrammingLanguage(state)` helper function
- ✅ Updated `commands.ts` to use profile language instead of hardcoded "Java"

### Next Steps:

1. Create language detection utility
2. Update bundled profiles with appropriate languages
3. Add language picker to profiles UI
4. Implement workspace language auto-detection
5. Add language-specific analyzer provider selection

## Related Files

- `/shared/src/types/types.ts` - AnalysisProfile interface
- `/vscode/src/utilities/profiles/profileService.ts` - Profile management
- `/vscode/src/utilities/profiles/bundledProfiles.ts` - Default profiles
- `/shared/src/utils/languageMapping.ts` - Language detection utilities
- `/vscode/src/commands.ts` - Command handling with language integration
- `/webview-ui/src/components/ProfilesPage/` - UI components (to be updated)
