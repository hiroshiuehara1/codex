import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface PersistedState {
  keys: string[];
}

export class IdempotencyStore {
  private readonly keys = new Set<string>();

  constructor(private readonly statePath: string) {}

  async load(): Promise<void> {
    try {
      const content = await readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(content) as PersistedState;
      for (const key of parsed.keys) {
        this.keys.add(key);
      }
    } catch {
      await this.persist();
    }
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  async add(key: string): Promise<void> {
    this.keys.add(key);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.statePath), { recursive: true }).catch(() => undefined);

    const payload: PersistedState = { keys: [...this.keys] };
    await writeFile(this.statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  }
}
