import * as exec from '@actions/exec';
import { pushTag, deleteTagRemote, deleteTagLocally, createTag, ensureGitUserConfig } from '../git';
import { Logger } from '../logger';

jest.mock('@actions/exec');

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  verboseInfo: jest.fn()
} as unknown as Logger;

/**
 * Two distinct attacks, both reachable through the `tag-name` input.
 *
 * 1. OPTION injection. Passing an argv array stops the SHELL interpreting a value; it does
 *    nothing about git's own option parser, which reads a leading "-" as an option wherever
 *    it appears. Some of those options run commands. Reproduced against real git:
 *
 *      git push origin --delete '--receive-pack=touch /tmp/PWNED' v9   -> the file is created
 *
 *    The trailing real ref matters: without it git aborts with "--delete doesn't make sense
 *    without any refs" and nothing executes.
 *
 * 2. REFSPEC injection. `+` is the force prefix, so `git push origin '+main'` force-updates
 *    the remote BRANCH. `git check-ref-format` accepts `refs/tags/+main` and `git tag` creates
 *    it, so a leading-"-" guard alone does not stop it. Verified against real git: the remote
 *    branch moved to the local HEAD.
 *
 * `git check-ref-format` accepts all of these, and this action takes its tag name from a
 * consuming workflow, so the values are attacker-influenced.
 */
describe('argument injection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (exec.exec as jest.Mock).mockResolvedValue(0);
  });

  const optionLike = ['--receive-pack=touch /tmp/pwned', '--upload-pack=id', '-v1.0.0'];
  const refspecLike = ['+main', '+refs/heads/main', 'v1:refs/heads/main'];
  const hostile = [...optionLike, ...refspecLike];

  describe.each(hostile)('value %s', (payload) => {
    it('is refused as a tag name when pushing', async () => {
      await expect(pushTag(payload, 'origin', undefined, false, logger)).rejects.toThrow();
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('is refused as a tag name when deleting a remote tag', async () => {
      await expect(deleteTagRemote(payload, 'origin', undefined, logger)).rejects.toThrow();
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('is refused as a tag name when deleting a local tag', async () => {
      await expect(deleteTagLocally(payload, logger)).rejects.toThrow();
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('is refused as a tag name when creating a tag', async () => {
      await expect(
        createTag({ tagName: payload, sha: 'abc123', gpgSign: false, force: false, verbose: false }, logger)
      ).rejects.toThrow();
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe.each(optionLike)('value %s', (payload) => {
    it('is refused as a remote name when pushing', async () => {
      await expect(pushTag('v1.0.0', payload, undefined, false, logger)).rejects.toThrow();
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  it('refuses a SHA that git would read as an option', async () => {
    await expect(
      createTag({ tagName: 'v1.0.0', sha: '--upload-pack=id', gpgSign: false, force: false, verbose: false }, logger)
    ).rejects.toThrow();
  });

  it('refuses a git user name that git would read as an option', async () => {
    await expect(ensureGitUserConfig(logger, '--replace-all', undefined)).rejects.toThrow();
  });

  it('pushes a fully-qualified refspec so the tag name cannot be read as one', async () => {
    await pushTag('v1.2.3', 'origin', undefined, false, logger);
    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', 'refs/tags/v1.2.3:refs/tags/v1.2.3'],
      expect.anything()
    );
  });

  it('still accepts ordinary values', async () => {
    await expect(pushTag('v1.2.3', 'origin', undefined, false, logger)).resolves.toBeUndefined();
    expect(exec.exec).toHaveBeenCalled();
  });
});
