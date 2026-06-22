import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DrumoBackend } from "./backend";

describe("DrumoBackend", () => {
  let directory: string;
  let dataFile: string;
  let backend: DrumoBackend;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "drumo-backend-"));
    dataFile = path.join(directory, "drumo-data.json");
    backend = new DrumoBackend(dataFile);
    await backend.initialize();
  });

  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  it("creates the forced-change admin with a hashed password", async () => {
    const session = await backend.login({ username: "admin", password: "admin" });
    expect(session.user).toMatchObject({ username: "admin", role: "admin", mustChangePassword: true });
    const stored = JSON.parse(await fs.readFile(dataFile, "utf8")) as { users: Array<{ password: unknown }> };
    expect(stored.users[0].password).toEqual(expect.objectContaining({ salt: expect.any(String), hash: expect.any(String) }));
    expect(stored.users[0].password).not.toBe("admin");
  });

  it("lets a visitor create only a normal user account", async () => {
    const session = await backend.register({ username: "nouveau", password: "motdepasse-1", role: "admin" });
    expect(session.user).toMatchObject({ username: "nouveau", role: "user", active: true, mustChangePassword: false });
    expect(backend.me(session.token).user.role).toBe("user");
    await expect(backend.register({ username: "nouveau", password: "motdepasse-2" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces admin permissions and preserves an active administrator", async () => {
    const admin = await backend.login({ username: "admin", password: "admin" });
    await backend.createUser(admin.token, { username: "alice", password: "password-1", role: "user" });
    const alice = await backend.login({ username: "alice", password: "password-1" });
    expect(() => backend.listUsers(alice.token)).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => backend.updateUser(admin.token, { id: admin.user.id, role: "user", active: true })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("blocks normal users during maintenance while keeping admin access", async () => {
    const admin = await backend.login({ username: "admin", password: "admin" });
    await backend.createUser(admin.token, { username: "bob", password: "password-2", role: "user" });
    const bob = await backend.login({ username: "bob", password: "password-2" });
    await backend.updateConfig(admin.token, { maintenance: true });
    expect(() => backend.listCourses(bob.token)).toThrowError(expect.objectContaining({ code: "MAINTENANCE" }));
    expect(backend.listCourses(admin.token).length).toBeGreaterThan(0);
  });

  it("persists private MIDI projects and restores their editing data", async () => {
    const admin = await backend.login({ username: "admin", password: "admin" });
    await backend.createUser(admin.token, { username: "claire", password: "password-3", role: "user" });
    await backend.createUser(admin.token, { username: "david", password: "password-4", role: "user" });
    const claire = await backend.login({ username: "claire", password: "password-3" });
    const david = await backend.login({ username: "david", password: "password-4" });
    const saved = await backend.saveScore(claire.token, { title: "Mon groove", description: "Test", midiBytes: [77, 84, 104, 100], projectData: { marker: 42 } });
    expect(backend.listScores(claire.token)).toHaveLength(1);
    expect(backend.getScore(claire.token, saved.id)).toMatchObject({ midiBytes: [77, 84, 104, 100], projectData: { marker: 42 } });
    expect(() => backend.getScore(david.token, saved.id)).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));

    const reloaded = new DrumoBackend(dataFile);
    await reloaded.initialize();
    const nextSession = await reloaded.login({ username: "claire", password: "password-3" });
    expect(reloaded.listScores(nextSession.token)).toHaveLength(1);
  });
});
