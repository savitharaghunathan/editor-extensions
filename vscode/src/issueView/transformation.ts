import { Incident, RuleSet } from "@editor-extensions/shared";
import { Immutable } from "immer";

export const allIncidents = (ruleSets: Immutable<RuleSet[]>): Incident[] =>
  ruleSets
    .flatMap((r) => Object.values(r.violations ?? {}))
    .flatMap((v) => v?.incidents ?? [])
    // ensure basic properties are valid
    .filter(
      (it) =>
        // allow empty messages (they will be grouped together)
        typeof it.message === "string" &&
        typeof it.uri === "string" &&
        // expect non-empty path in format file:///some/file.ext
        it.uri.startsWith("file://"),
    )
    .map((it) => ({
      ...it,
      // line numbers are optional - use first line as fallback
      // expect 1-based numbering (vscode.Position is zero-based)
      lineNumber: Number.isInteger(it.lineNumber) && it.lineNumber! > 0 ? it.lineNumber : 1,
    }));
