# Git Create/Update Tag Action

[![CI](https://github.com/LiquidLogicLabs/git-create-update-tag-action/actions/workflows/ci.yml/badge.svg)](https://github.com/LiquidLogicLabs/git-create-update-tag-action/actions/workflows/ci.yml)
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
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
```

### Annotated Tag

```yaml
- name: Create annotated tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    tag_sha: ${{ github.sha }}
```

### Lightweight Tag

```yaml
- name: Create lightweight tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    # No tag_message = lightweight tag
```

### Update Existing Tag

```yaml
- name: Update existing tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1'
    tag_message: 'Updated major version tag'
    update_existing: true
```

### GPG Signed Tag

```yaml
- name: Create GPG signed tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    gpg_sign: true
    gpg_key_id: 'YOUR_GPG_KEY_ID'  # Optional
```

### GitHub Example

```yaml
- name: Create GitHub tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    repository: 'owner/repo'
    token: ${{ secrets.GITHUB_TOKEN }}
    repo_type: 'github'
```

### Gitea Self-Hosted Example

```yaml
- name: Create Gitea tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    repository: 'https://gitea.example.com/owner/repo'
    token: ${{ secrets.GITEA_TOKEN }}
    repo_type: 'gitea'
    base_url: 'https://gitea.example.com/api/v1'
    ignore_cert_errors: true  # For self-signed certificates
```

### Bitbucket Example

```yaml
- name: Create Bitbucket tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    repository: 'owner/repo'
    token: ${{ secrets.BITBUCKET_TOKEN }}
    repo_type: 'bitbucket'
```

### Remote Repository (Without Cloning)

```yaml
- name: Create tag on remote repository
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    repository: 'owner/repo'
    tag_sha: 'abc123def456...'  # Required when not in local repo
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Create Tag Without Pushing

```yaml
- name: Create tag locally without pushing
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    push_tag: false
```

### Verbose Logging

```yaml
- name: Create tag with verbose logging
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    tag_message: 'Release version 1.0.0'
    verbose: true
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `tag_name` | Name of the tag to create/update | Yes | - |
| `tag_message` | Message for annotated tags. If provided, creates an annotated tag; if omitted, creates a lightweight tag | No | - |
| `tag_sha` | Commit SHA to tag (defaults to current HEAD when in local repo) | No | Current HEAD |
| `repository` | Repository URL or owner/repo format (defaults to current repo) | No | Current repo |
| `token` | Authentication token (defaults to GITHUB_TOKEN) | No | `${{ secrets.GITHUB_TOKEN }}` |
| `update_existing` | Whether to update existing tags (default: false) | No | `false` |
| `gpg_sign` | Whether to GPG sign the tag (default: false) | No | `false` |
| `gpg_key_id` | GPG key ID to use for signing | No | - |
| `repo_type` | Repository type ('github', 'gitea', 'bitbucket', 'generic', 'auto'). Default: 'auto' (auto-detect from repository URL) | No | `auto` |
| `base_url` | Base URL for self-hosted instances | No | Platform default |
| `ignore_cert_errors` | Ignore SSL certificate errors (default: false) | No | `false` |
| `force` | Force update even if tag exists (default: false) | No | `false` |
| `verbose` | Enable verbose/debug logging (default: false) | No | `false` |
| `push_tag` | Push the tag to the remote repository after creating/updating (default: true). Only applies when using local Git CLI. | No | `true` |

## Outputs

| Output | Description |
|-------|-------------|
| `tag_name` | Name of the tag that was created/updated |
| `tag_sha` | SHA of the commit that was tagged |
| `tag_exists` | Whether the tag already existed (true/false) |
| `tag_updated` | Whether an existing tag was updated (true/false) |
| `tag_created` | Whether a new tag was created (true/false) |
| `platform` | Detected or specified platform (same as repo_type input or detected value) |

## Platform Detection

The action automatically detects the platform from the repository URL:

- `github.com` or `github.enterprise.com` → GitHub
- `gitea.com` or custom domain → Gitea
- `bitbucket.org` or `bitbucket.server.com` → Bitbucket
- Unknown → Generic (uses Git CLI)

You can also explicitly specify the platform using the `repo_type` input.

## Local vs Remote Operations

The action intelligently chooses between local Git CLI operations and platform APIs:

- **Local Repository**: If running in a checked-out Git repository, uses Git CLI for all operations
- **Remote Repository**: If targeting a remote repository without cloning, uses platform APIs

## Tag Types

- **Annotated Tags**: Created when `tag_message` is provided. Include metadata and can be GPG signed.
- **Lightweight Tags**: Created when `tag_message` is omitted. Simple pointer to a commit.

## GPG Signing

GPG signing is only supported for annotated tags (when `tag_message` is provided). You can specify a specific GPG key ID using `gpg_key_id`, or let Git use the default signing key.

## Self-Hosted Instances

For self-hosted instances, provide the `base_url` input with the API base URL:

- **Gitea**: `https://your-gitea-instance.com/api/v1`
- **GitHub Enterprise**: `https://your-github-enterprise.com/api/v3`
- **Bitbucket Server**: `https://your-bitbucket-server.com/rest/api/1.0`

If you're using self-signed certificates, set `ignore_cert_errors: true`.

## Security Considerations

- **Token Handling**: Tokens are automatically masked in logs using `core.setSecret()`
- **Certificate Validation**: By default, SSL certificate errors are not ignored. Only set `ignore_cert_errors: true` if absolutely necessary for self-hosted instances with self-signed certificates
- **Token Storage**: Store tokens in GitHub Secrets and reference them via `${{ secrets.SECRET_NAME }}`
- **GPG Keys**: GPG keys should be properly configured in the runner environment

## Debugging

Enable verbose logging to troubleshoot issues:

```yaml
- uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: 'v1.0.0'
    verbose: true
```

Verbose mode will log:
- HTTP requests and responses
- Git commands being executed
- Platform detection details
- Detailed error information

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
        uses: LiquidLogicLabs/git-create-update-tag-action@v1
        with:
          tag_name: v${{ steps.version.outputs.version }}
          tag_message: Release version ${{ steps.version.outputs.version }}
          update_existing: true
```

### Major Version Tag

```yaml
- name: Create/update major version tag
  uses: LiquidLogicLabs/git-create-update-tag-action@v1
  with:
    tag_name: v1
    tag_message: Major version 1
    update_existing: true
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

## License

MIT

## Credits

This action is inspired by similar actions in the GitHub Actions marketplace, including:
- [joutvhu/create-tag](https://github.com/marketplace/actions/create-or-update-tag)
- [rickstaa/action-create-tag](https://github.com/marketplace/actions/create-update-tag)

