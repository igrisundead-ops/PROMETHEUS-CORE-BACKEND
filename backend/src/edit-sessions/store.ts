import path from "node:path";
import {mkdir, readFile, writeFile} from "node:fs/promises";

import {editSessionStateSchema, type EditSessionState} from "./types";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

export class EditSessionStore {
  public readonly rootDir: string;

  public constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  public async initialize(): Promise<void> {
    await mkdir(this.sessionsRootDir(), {recursive: true});
  }

  public sessionsRootDir(): string {
    return path.join(this.rootDir, "edit-sessions");
  }

  public sessionDir(sessionId: string): string {
    return path.join(this.sessionsRootDir(), sessionId);
  }

  public sessionFilePath(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "session.json");
  }

  public renderDir(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "render");
  }

  public sourceDir(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "source");
  }

  public async ensureSessionWorkspace(sessionId: string): Promise<void> {
    await mkdir(this.sessionDir(sessionId), {recursive: true});
    await mkdir(this.renderDir(sessionId), {recursive: true});
    await mkdir(this.sourceDir(sessionId), {recursive: true});
  }

  public async createSession(session: EditSessionState): Promise<EditSessionState> {
    await this.ensureSessionWorkspace(session.id);
    await writeJson(this.sessionFilePath(session.id), session);
    return session;
  }

  public async writeSession(session: EditSessionState): Promise<EditSessionState> {
    await this.ensureSessionWorkspace(session.id);
    await writeJson(this.sessionFilePath(session.id), session);
    return session;
  }

  public async readSession(sessionId: string): Promise<EditSessionState> {
    const raw = await readFile(this.sessionFilePath(sessionId), "utf-8");
    return editSessionStateSchema.parse(JSON.parse(raw) as unknown);
  }

  public async sessionExists(sessionId: string): Promise<boolean> {
    try {
      await readFile(this.sessionFilePath(sessionId), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  public async updateSession(
    sessionId: string,
    updater: (current: EditSessionState) => EditSessionState
  ): Promise<EditSessionState> {
    const current = await this.readSession(sessionId);
    const next = editSessionStateSchema.parse(updater(current));
    await writeJson(this.sessionFilePath(sessionId), next);
    return next;
  }
}
