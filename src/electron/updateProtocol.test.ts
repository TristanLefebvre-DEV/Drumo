import { describe, expect, it } from "vitest";
import { compareVersions, parseUpdateManifest } from "./updateProtocol";

describe("update protocol", () => {
  it("compares semantic versions", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
  });

  it("accepts an HTTPS manifest and resolves its installer URL", () => {
    const manifest = parseUpdateManifest({ version: "1.2.0", windows: { url: "Drumo-Setup.exe", sha256: "a".repeat(64) } }, "https://updates.drumo.app/latest.json");
    expect(manifest.windows.url).toBe("https://updates.drumo.app/Drumo-Setup.exe");
  });

  it("rejects insecure remote installers", () => {
    expect(() => parseUpdateManifest({ version: "1.2.0", windows: { url: "http://example.com/update.exe", sha256: "a".repeat(64) } }, "https://updates.drumo.app/latest.json")).toThrow();
  });
});
