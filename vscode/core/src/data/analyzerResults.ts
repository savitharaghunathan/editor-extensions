import * as vscode from "vscode";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { RuleSet, Category, EnhancedIncident, DiagnosticSource } from "@editor-extensions/shared";
import { Immutable } from "immer";

//Assuming that output is in form of yaml
export function readYamlFile(filePath: string): RuleSet[] | undefined {
  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data = yaml.load(fileContents);
    if (Array.isArray(data)) {
      return data as RuleSet[];
    } else {
      console.error("YAML content is not an array of rulesets");
      return undefined;
    }
  } catch (e) {
    console.error("Error reading YAML file:", e);
    return undefined;
  }
}

function getSeverityFromCategory(category: Category | undefined): vscode.DiagnosticSeverity {
  switch (category) {
    case "mandatory":
      return vscode.DiagnosticSeverity.Error;
    case "optional":
      return vscode.DiagnosticSeverity.Warning;
    case "potential":
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

export const processIncidents = (
  incidents: Immutable<EnhancedIncident[]>,
): ReadonlyArray<[vscode.Uri, vscode.Diagnostic[]]> =>
  incidents
    .filter((incident) => incident.uri)
    .map((incident, index) => {
      const uri = vscode.Uri.parse(incident.uri);
      const line = (incident.lineNumber || 1) - 1;
      const range = new vscode.Range(line, 0, line, 0);

      // Create a detailed message with all available context
      const message = [
        incident.message || "No message provided",
        `\n\nContext:`,
        `- Ruleset: ${incident.ruleset_name ?? "Unknown Ruleset"}`,
        `- Ruleset Description: ${incident.ruleset_description ?? "No description available"}`,
        `- Violation: ${incident.violation_name ?? "Unknown Violation"}`,
        `- Violation Description: ${incident.violation_description ?? "No description available"}`,
        `- Category: ${incident.violation_category ?? "Uncategorized"}`,
        incident.violation_labels?.length
          ? `- Labels: ${incident.violation_labels.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const diagnostic = new vscode.Diagnostic(
        range,
        message,
        getSeverityFromCategory(incident.violation_category),
      );
      diagnostic.source = DiagnosticSource;
      diagnostic.code = `${index}`;

      return [uri, [diagnostic]];
    });
