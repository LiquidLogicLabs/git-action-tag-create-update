import { PlatformAPI } from "../../types";

/**
 * Wait for a tag to become readable, then assert it is there.
 *
 * GitHub's ref API is eventually consistent: a GET of /git/refs/tags/<name> that answered
 * 404 before the tag was created can keep answering 404 for a short window afterwards,
 * even though the create returned 201. Reproduced with plain curl outside this suite at
 * roughly 1 run in 10, so it is GitHub's behaviour and not the action's.
 *
 * This polls instead of sleeping a fixed amount, and still fails if the tag never shows
 * up — it removes the race, not the assertion.
 */
export async function waitForTag(
  api: PlatformAPI,
  tagName: string,
  {
    timeoutMs = 10000,
    intervalMs = 250,
  }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await api.tagExists(tagName)) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
