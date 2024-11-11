import { Uri } from "vscode";
import { KONVEYOR_SCHEME } from "./constants";
import path from "path";

export const fromRelativeToKonveyor = (relativePath: string) =>
  Uri.from({ scheme: KONVEYOR_SCHEME, path: path.posix.sep + relativePath });
