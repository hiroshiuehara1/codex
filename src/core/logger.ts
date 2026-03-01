import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { DecisionLogRecord } from "../types/contracts.js";

export class DecisionLogger {
  constructor(private readonly logPath: string) {}

  async log(record: DecisionLogRecord): Promise<void> {
    await mkdir(dirname(this.logPath), { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(record)}\n`, "utf-8");
  }
}
