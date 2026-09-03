import { GiteaAPI } from "../../platforms/gitea";
import { Logger } from "../../logger";
import { HttpClient } from "../../platforms/http-client";

jest.mock("../../platforms/http-client");

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

// Shape returned by Gitea for GET /git/refs/tags/<name>: an ARRAY of every ref
// whose name starts with <name>. Matching this shape is the point of these tests —
// the previous suite mocked a single object and so never exercised prefix matching.
const refsFor = (...names: string[]) =>
  names.map((n) => ({
    ref: `refs/tags/${n}`,
    object: { type: "tag", sha: `sha-${n}` },
  }));

describe("GiteaAPI", () => {
  let api: GiteaAPI;
  let http: jest.Mocked<HttpClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    http = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;
    (HttpClient as jest.Mock).mockImplementation(() => http);
    api = new GiteaAPI(
      { owner: "owner", repo: "repo", platform: "gitea" },
      {
        type: "gitea",
        token: "t",
        ignoreCertErrors: false,
        verbose: false,
        baseUrl: "https://git.example.com",
      },
      mockLogger,
    );
  });

  describe("tagExists", () => {
    it("returns true on an exact match", async () => {
      http.get.mockResolvedValue(refsFor("v1.2.3"));
      await expect(api.tagExists("v1.2.3")).resolves.toBe(true);
    });

    it("returns false when only a longer tag shares the prefix", async () => {
      // Gitea answers GET /git/refs/tags/v1 with refs/tags/v1.2.3 — 200, non-empty.
      // Treating that as "v1 exists" makes the action skip creating the floating tag.
      http.get.mockResolvedValue(refsFor("v1.2.3"));
      await expect(api.tagExists("v1")).resolves.toBe(false);
    });

    it("returns true when the exact tag is among several prefix matches", async () => {
      http.get.mockResolvedValue(refsFor("v1.2.3", "v1", "v1.2"));
      await expect(api.tagExists("v1")).resolves.toBe(true);
    });

    it("returns false on 404", async () => {
      http.get.mockRejectedValue(new Error("HTTP 404 Not Found"));
      await expect(api.tagExists("v1")).resolves.toBe(false);
    });
  });

  describe("deleteTag", () => {
    it("uses the tags endpoint, not the git refs endpoint", async () => {
      // DELETE /git/refs/tags/<t> answers 405 on Gitea and leaves the tag in place.
      http.delete.mockResolvedValue(undefined);
      await api.deleteTag("v1.0.0");
      expect(http.delete).toHaveBeenCalledWith("/repos/owner/repo/tags/v1.0.0");
    });

    it("treats 404 as already gone", async () => {
      http.delete.mockRejectedValue(new Error("HTTP 404 Not Found"));
      await expect(api.deleteTag("v1.0.0")).resolves.toBeUndefined();
    });

    it("throws on 405 instead of reporting a delete that never happened", async () => {
      http.delete.mockRejectedValue(new Error("HTTP 405 Method Not Allowed"));
      await expect(api.deleteTag("v1.0.0")).rejects.toThrow(/405/);
    });
  });

  describe("updateTag", () => {
    const opts = {
      tagName: "v1",
      sha: "newsha",
      message: "new",
      gpgSign: false,
      force: true,
      verbose: false,
    };

    it("deletes the old tag exactly once before recreating it", async () => {
      http.get.mockImplementation(async (p: string) =>
        p.startsWith("/repos/owner/repo/tags/")
          ? { name: "v1", message: "old", commit: { sha: "oldsha" } }
          : [],
      );
      http.delete.mockResolvedValue(undefined);
      http.post.mockResolvedValue({});

      await api.updateTag(opts);
      expect(http.delete).toHaveBeenCalledTimes(1);
    });

    it("restores the previous tag when recreation fails", async () => {
      http.get.mockImplementation(async (p: string) =>
        p.startsWith("/repos/owner/repo/tags/")
          ? { name: "v1", message: "old", commit: { sha: "oldsha" } }
          : [],
      );
      http.delete.mockResolvedValue(undefined);
      http.post.mockRejectedValueOnce(
        new Error("HTTP 500 Internal Server Error"),
      );

      await expect(api.updateTag(opts)).rejects.toThrow(/500/);

      // The old tag must be put back at its original commit, not left destroyed.
      expect(http.post).toHaveBeenCalledWith(
        "/repos/owner/repo/tags",
        expect.objectContaining({ tag_name: "v1", target: "oldsha" }),
      );
    });

    it("reports updated, not created", async () => {
      http.get.mockImplementation(async (p: string) =>
        p.startsWith("/repos/owner/repo/tags/")
          ? { name: "v1", message: "old", commit: { sha: "oldsha" } }
          : [],
      );
      http.delete.mockResolvedValue(undefined);
      http.post.mockResolvedValue({});

      const r = await api.updateTag(opts);
      expect(r.updated).toBe(true);
      expect(r.created).toBe(false);
      expect(r.exists).toBe(true);
    });
  });
});
