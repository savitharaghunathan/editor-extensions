import { RuleSet } from "@shared/types";

const isString = (obj: unknown): obj is string => typeof obj === "string";
const isEmpty = (obj: unknown) => isObject(obj) && Object.keys(obj).length === 0;
const isObject = (obj: unknown): obj is object => typeof obj === "object";

export function isSolution(object: unknown): object is Solution {
  if (!object || typeof object !== "object") {
    return false;
  }

  const { errors, changes, ...rest } = object as Solution;

  return (
    Array.isArray(errors) &&
    Array.isArray(changes) &&
    isEmpty(rest) &&
    errors.every(isString) &&
    changes.every(isObject) &&
    changes.every(
      ({ diff, originalPath, modifiedPath, ...rest }) =>
        isEmpty(rest) && isString(diff) && isString(originalPath) && isString(modifiedPath),
    )
  );
}

export interface Solution {
  errors: string[];
  changes: { diff: string; originalPath: string; modifiedPath: string }[];
}

export function isAnalysis(obj: unknown): obj is RuleSet {
  const knownKeys: { [key in keyof RuleSet]: string } = {
    name: "string",
    description: "string",
    tags: "object",
    violations: "object",
    insights: "object",
    errors: "object",
    unmatched: "object",
    skipped: "object",
  };

  return (
    isObject(obj) &&
    !isEmpty(obj) &&
    Object.entries(obj).every(
      ([key, value]) => typeof value === (knownKeys as Record<string, string>)[key],
    )
  );
}
