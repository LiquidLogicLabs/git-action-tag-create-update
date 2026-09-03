import { waitForTag } from "./e2e/helpers";
import { PlatformAPI } from "../types";

describe("waitForTag", () => {
  it("returns true as soon as the tag appears", async () => {
    let calls = 0;
    const api = {
      tagExists: async () => ++calls >= 3,
    } as unknown as PlatformAPI;
    await expect(
      waitForTag(api, "v1", { timeoutMs: 2000, intervalMs: 10 }),
    ).resolves.toBe(true);
    expect(calls).toBe(3);
  });

  it("still returns false when the tag never appears", async () => {
    // The helper must remove the race, not the assertion.
    const api = { tagExists: async () => false } as unknown as PlatformAPI;
    await expect(
      waitForTag(api, "v1", { timeoutMs: 200, intervalMs: 20 }),
    ).resolves.toBe(false);
  });
});
