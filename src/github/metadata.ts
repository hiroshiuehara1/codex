import type { PRMetadata } from "../types/contracts.js";

const START = "<!-- agent-metadata:start -->";
const END = "<!-- agent-metadata:end -->";

export function renderMetadataBlock(metadata: PRMetadata): string {
  return `${START}\n${JSON.stringify(metadata, null, 2)}\n${END}`;
}

export function parseMetadataBlock(body: string): PRMetadata | null {
  const startIndex = body.indexOf(START);
  const endIndex = body.indexOf(END);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  const payload = body.slice(startIndex + START.length, endIndex).trim();
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as PRMetadata;
  } catch {
    return null;
  }
}

export const METADATA_MARKERS = { START, END };
