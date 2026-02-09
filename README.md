# Git Create/Update Tag Action

[![CI](https://github.com/LiquidLogicLabs/git-action-tag-create-update/actions/workflows/ci.yml/badge.svg)](https://github.com/LiquidLogicLabs/git-action-tag-create-update/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

A GitHub Action that creates or updates Git tags on local or remote repositories. Supports multiple Git hosting platforms including GitHub, Gitea, Bitbucket, and generic Git hosts with optional GPG signing and certificate error handling for self-hosted instances.

## Features

- **Multi-Platform Support**: Works with GitHub (cloud and Enterprise), Gitea (cloud and self-hosted), Bitbucket (cloud and self-hosted), and any generic Git host
- **Automatic Platform Detection**: Automatically detects the platform from repository URLs
- **Local and Remote Operations**: Works with both local Git repositories and remote-only operations via platform APIs
- **Tag Types**: Supports both annotated tags (with message) and lightweight tags (without message)
- **Tag Updates**: Can update existing tags by deleting and recreating them
- **GPG Signing**: Optional GPG signing for annotated tags
- **Self-Hosted Support**: Full support for self-hosted instances with custom base URLs
- **Certificate Handling**: Option to ignore SSL certificate errors for self-hosted instances
- **Verbose Logging**: Debug mode for troubleshooting

## Usage

### Basic Example

```yaml
- name: Create tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
```

### Annotated Tag

```yaml
- name: Create annotated tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    tag-sha: ${{ github.sha }}
```

### Lightweight Tag

```yaml
- name: Create lightweight tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    # No tagMessage = lightweight tag
```

### Update Existing Tag

```yaml
- name: Update existing tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1'
    tag-message: 'Updated major version tag'
    update-existing: true
```

### GPG Signed Tag

```yaml
- name: Create GPG signed tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    gpg-sign: true
    gpg-key-id: 'YOUR_GPG_KEY_ID'  # Optional
```

### GitHub Example

```yaml
- name: Create GitHub tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    repository: 'owner/repo'
    token: ${{ secrets.GITHUB_TOKEN }}
    repo-type: 'github'
```

### Gitea Self-Hosted Example

```yaml
- name: Create Gitea tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    repository: 'https://gitea.example.com/owner/repo'
    token: ${{ secrets.GITEA_TOKEN }}
    repo-type: 'gitea'
    base-url: 'https://gitea.example.com/api/v1'
    skip-certificate-check: true  # For self-signed certificates
```

### Bitbucket Example

```yaml
- name: Create Bitbucket tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    repository: 'owner/repo'
    token: ${{ secrets.BITBUCKET_TOKEN }}
    repo-type: 'bitbucket'
```

### Remote Repository (Without Cloning)

```yaml
- name: Create tag on remote repository
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    repository: 'owner/repo'
    tag-sha: 'abc123def456...'  # Required when not in local repo
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Create Tag Without Pushing

```yaml
- name: Create tag locally without pushing
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    push-tag: false
```

### Custom Git User Configuration

```yaml
- name: Create tag with custom git user
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    git-user-name: 'My Name'
    git-user-email: 'myemail@example.com'
```

### Verbose Logging

```yaml
- name: Create tag with verbose logging
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    tag-message: 'Release version 1.0.0'
    verbose: true
```

## Workflow permissions

When pushing tags to the remote (`push-tag: true`, default), the job must have `contents: write`. For local-only use or `push-tag: false`, `contents: read` is sufficient.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `tag-name` | Name of the tag to create/update | Yes | - |
| `tag-message` | Message for annotated tags. If provided, creates an annotated tag; if omitted, creates a lightweight tag | No | - |
| `tag-sha` | Commit SHA to tag (defaults to current HEAD when in local repo) | No | Current HEAD |
| `repository` | Repository URL or owner/repo format (defaults to current repo) | No | Current repo |
| `token` | Authentication token (defaults to GITHUB_TOKEN) | No | `${{ secrets.GITHUB_TOKEN }}` |
| `update-existing` | Whether to update existing tags (default: false) | No | `false` |
| `gpg-sign` | Whether to GPG sign the tag (default: false) | No | `false` |
| `gpg-key-id` | GPG key ID to use for signing | No | - |
| `repo-type` | Repository type ('github', 'gitea', 'bitbucket', 'generic', 'git', 'auto'). Default: 'auto' (auto-detect from repository URL). 'git' and 'generic' are equivalent aliases for local Git CLI operations. | No | `auto` |
| `base-url` | Base URL for self-hosted instances | No | Platform default |
| `skip-certificate-check` | Ignore SSL certificate errors (default: false) | No | `false` |
| `force` | Force update even if tag exists (default: false) | No | `false` |
| `verbose` | Enable verbose/debug logging (default: false) | No | `false` |
| `push-tag` | Push the tag to the remote repository after creating/updating (default: true). Only applies when using local Git CLI. | No | `true` |
| `git-user-name` | Git user name for annotated tags. Auto-detected from GITHUB_ACTOR/GITEA_ACTOR if not provided. Falls back to local git config. | No | Auto-detected |
| `git-user-email` | Git user email for annotated tags. Auto-detected from GITHUB_ACTOR/GITEA_ACTOR if not provided. Falls back to local git config. | No | Auto-detected |

## Outputs

| Output | Description |
|-------|-------------|
| `tag-name` | Name of the tag that was created/updated |
| `tag-sha` | SHA of the commit that was tagged |
| `tag-exists` | Whether the tag already existed (true/false) |
| `tag-updated` | Whether an existing tag was updated (true/false) |
| `tag-created` | Whether a new tag was created (true/false) |
| `platform` | Detected or specified platform (same as repo-type input or detected value) |

## Platform Detection

The action automatically detects the platform from the repository URL:

- `github.com` or `github.enterprise.com` → GitHub
- `gitea.com` or custom domain → Gitea
- `bitbucket.org` or `bitbucket.server.com` → Bitbucket
- Unknown → Generic (uses Git CLI)

You can also explicitly specify the platform using the `repo-type` input.

## Local vs Remote Operations

The action intelligently chooses between local Git CLI operations and platform APIs:

- **Local Repository**: If running in a checked-out Git repository, uses Git CLI for all operations
- **Remote Repository**: If targeting a remote repository without cloning, uses platform APIs

## Tag Types

- **Annotated Tags**: Created when `tag-message` is provided. Include metadata and can be GPG signed.
- **Lightweight Tags**: Created when `tag-message` is omitted. Simple pointer to a commit.

## Git User Configuration

For annotated tags, Git requires `user.name` and `user.email` to be configured. The action automatically handles this:

- **Auto-detection**: Automatically detects from environment variables:
  - `GITHUB_ACTOR` or `GITEA_ACTOR` for user name
  - Constructs email from actor and server URL:
    - **GitHub**: `actor@users.noreply.github.com` (or `actor@users.noreply.{hostname}` for GitHub Enterprise)
    - **Gitea**: `actor@noreply.{hostname}` (e.g., `actor@noreply.git.ravenwolf.org`)
    - **Other platforms**: `actor@noreply.{hostname}`
- **Manual override**: You can provide `git-user-name` and `git-user-email` inputs to override auto-detection
- **Local config fallback**: If git user is already configured locally, it uses those values
- **Default fallback**: If nothing is detected, uses "GitHub Actions" and "actions@github.com"

The git config is set locally (repository-scoped) only when needed, so it won't affect your global git configuration.

## GPG Signing

GPG signing is only supported for annotated tags (when `tag-message` is provided). You can specify a specific GPG key ID using `gpg-key-id`, or let Git use the default signing key.

## Self-Hosted Instances

For self-hosted instances, provide the `base-url` input with the API base URL:

- **Gitea**: `https://your-gitea-instance.com/api/v1`
- **GitHub Enterprise**: `https://your-github-enterprise.com/api/v3`
- **Bitbucket Server**: `https://your-bitbucket-server.com/rest/api/1.0`

If you're using self-signed certificates, set `skip-certificate-check: true`.

## Security Considerations

- **Token Handling**: Tokens are automatically masked in logs using `core.setSecret()`
- **Certificate Validation**: By default, SSL certificate errors are not ignored. Only set `skip-certificate-check: true` if absolutely necessary for self-hosted instances with self-signed certificates
- **Token Storage**: Store tokens in GitHub Secrets and reference them via `${{ secrets.SECRET_NAME }}`
- **GPG Keys**: GPG keys should be properly configured in the runner environment

## Debugging

Enable verbose logging to troubleshoot issues:

```yaml
- uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: 'v1.0.0'
    verbose: true
```

Verbose mode will log:
- HTTP requests and responses
- Git commands being executed
- Platform detection details
- Detailed error information

### Gitea: No output when repo debug is enabled

On Gitea, enabling "Enable debug" in repository or runner settings may **not** set `ACTIONS_STEP_DEBUG` or `RUNNER_DEBUG` for job steps. If the action step shows no output (or only a failure message), force verbose logs by setting **`verbose: true`** in the action inputs. The action also prints a first line (`Git Create/Update Tag action started`) as soon as it runs so the step is never completely silent.

### Input value not received (e.g. `tag-name`)

The action reads `tag-name` from the workflow and accepts it whether the runner exposes it as `INPUT_TAG_NAME` or `INPUT_TAGNAME`. If the value still doesn’t appear:

1. **Step never runs** – Some runners (e.g. Gitea/act) validate required inputs before starting the action. If they expect a different env key than the one set from your `with: tag-name: ...`, they may fail the step with “Input required and not supplied” before the action runs. Ensure you’re on a recent action version (v1.1.1+) that reads both keys.
2. **Expression is empty** – If you use `tag-name: ${{ steps.someId.outputs.name }}`, ensure the step `id` and output name are correct and that the step ran and set the output. Add a prior step that logs the value (e.g. “Log tag: …”) to confirm it’s set.

With step debug enabled (`ACTIONS_STEP_DEBUG` or `verbose: true`), the action logs which env key provided the value (`INPUT_TAGNAME` or `INPUT_TAG_NAME`) to help troubleshoot.

## Examples

### Release Workflow

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get version
        id: version
        run: echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT

      - name: Create release tag
        uses: LiquidLogicLabs/git-action-tag-create-update@v1
        with:
          tag-name: v${{ steps.version.outputs.version }}
          tag-message: Release version ${{ steps.version.outputs.version }}
          update-existing: true
```

### Major Version Tag

```yaml
- name: Create/update major version tag
  uses: LiquidLogicLabs/git-action-tag-create-update@v1
  with:
    tag-name: v1
    tag-message: Major version 1
    update-existing: true
```

## Local Testing with Act

You can test this action locally using [act](https://github.com/nektos/act), which runs GitHub Actions workflows in Docker containers.

### Setup

1. **Install act**:
   ```bash
   # macOS
   brew install act
   
   # Linux
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash -s -- -b /usr/local/bin
   
   # Windows
   scoop install act
   ```

2. **Configure environment variables** (optional):
   ```bash
   cp .act.env.example .act.env
   # Edit .act.env with your values
   ```

3. **Configure secrets** (optional):
   ```bash
   cp .act.secrets.example .act.secrets
   # Edit .act.secrets with your tokens (uncomment and set values)
   ```

### Usage

Use the provided `act-build.sh` script:

```bash
# Test release workflow (default - includes lint, test, build)
./act-build.sh

# Test CI workflow only
./act-build.sh --event push

# Run specific job
./act-build.sh --event tag --job lint
./act-build.sh --event push --job test

# Verbose output
./act-build.sh --verbose
```

Or use act directly:

```bash
# List available workflows
act --list

# Run CI workflow
act push

# Run release workflow
act push -e .github/workflows/release.yml
```

### Notes

- Make sure Docker is running before using act
- The `.act.env` and `.act.secrets` files are gitignored (use the `.example` files as templates)
- You can also configure secrets in `~/.actrc` instead of using `.act.secrets`

## Documentation

For developers and contributors:

- **[Development Guide](docs/DEVELOPMENT.md)** - Setup, development workflow, and contributing guidelines
- **[Testing Guide](docs/TESTING.md)** - Complete testing documentation

## License

MIT

## Credits

This action is inspired by similar actions in the GitHub Actions marketplace, including:
- [joutvhu/create-tag](https://github.com/marketplace/actions/create-or-update-tag)
- [rickstaa/action-create-tag](https://github.com/marketplace/actions/create-update-tag)

