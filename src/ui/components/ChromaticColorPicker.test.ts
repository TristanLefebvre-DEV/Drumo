import { describe, expect, it } from "vitest";
import { hexToHsb, hsbToHex } from "./ChromaticColorPicker";

describe("chromatic color conversion", () => {
  it.each(["#ff0000", "#00ff00", "#0000ff", "#0071e3", "#bf5af2", "#f2a35a", "#121827", "#ffffff", "#000000"])(
    "preserves %s through HSB",
    (hex) => expect(hsbToHex(...hexToHsb(hex))).toBe(hex),
  );

  it("normalizes wrapped hues", () => {
    expect(hsbToHex(360, 100, 100)).toBe("#ff0000");
    expect(hsbToHex(-120, 100, 100)).toBe("#0000ff");
  });
});
