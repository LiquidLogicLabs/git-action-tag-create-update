# E2E Testing Guide

This document describes how to set up and run end-to-end (E2E) tests for the git-action-tag-create-update action.

## Overview

E2E tests verify the complete action workflow by executing real API calls to GitHub, Gitea, and Bitbucket platforms, as well as testing local Git CLI operations. These tests run in a separate workflow that executes after CI and before releases.

## Test Structure

E2E tests are organized by platform:

- `src/__tests__/github.e2e.test.ts` - Tests GitHub API integration
- `src/__tests__/gitea.e2e.test.ts` - Tests Gitea API integration  
- `src/__tests__/bitbucket.e2e.test.ts` - Tests Bitbucket API integration
- `src/__tests__/generic.e2e.test.ts` - Tests local Git CLI operations

## Required Environment Variables

E2E tests require environment variables to be set with test repository credentials. These should be configured as GitHub Secrets in the repository settings.

### GitHub Platform

Required secrets for the `e2e-github` environment:

- `TEST_GITHUB_REPOSITORY` (optional) - Repository in `owner/repo` format. Default: `LiquidLogicLabs/git-action-release-tests` (shared e2e test repo).
- `TEST_GITHUB_TOKEN` - GitHub personal access token with `repo` scope (or set `GITHUB_TOKEN`).
- `TEST_TAG_PREFIX` (optional) - Prefix for test tags (default: `test-`)

**Note**: If `TEST_GITHUB_REPOSITORY` is not set, tests use `LiquidLogicLabs/git-action-release-tests`. If `TEST_GITHUB_TOKEN` is not set, tests use `GITHUB_TOKEN`.

### Gitea Platform

Required secrets for the `e2e-gitea` environment:

- `TEST_GITEA_REPOSITORY` - Repository in `owner/repo` format (e.g., `myorg/test-repo`)
- `TEST_GITEA_TOKEN` - Gitea personal access token with `repo` scope
- `TEST_GITEA_BASE_URL` (optional) - Gitea API base URL (e.g., `https://gitea.com/api/v1` or `https://gitea.example.com/api/v1`)
- `TEST_TAG_PREFIX` (optional) - Prefix for test tags (default: `test-`)

**Note**: If Gitea secrets are not configured, the tests will be skipped gracefully.

### Bitbucket Platform

Required secrets for the `e2e-bitbucket` environment:

- `TEST_BITBUCKET_REPOSITORY` - Repository in `owner/repo` format (e.g., `myorg/test-repo`)
- `TEST_BITBUCKET_TOKEN` - Bitbucket app password or access token with repository write permissions
- `TEST_BITBUCKET_BASE_URL` (optional) - Bitbucket API base URL (default: `https://api.bitbucket.org/2.0`)
- `TEST_TAG_PREFIX` (optional) - Prefix for test tags (default: `test-`)

**Note**: If Bitbucket secrets are not configured, the tests will be skipped gracefully.

### Generic Platform

No additional secrets required. Tests use local Git repositories created in temporary directories.

## Setting Up GitHub Environments

1. Go to repository Settings → Environments
2. Create environments: `e2e-github`, `e2e-gitea`, `e2e-bitbucket`
3. Add the required secrets to each environment
4. Configure environment protection rules if needed (e.g., require approval for production-like environments)

## Running E2E Tests

### Locally

E2E tests can be run locally, but require valid credentials:

```bash
# Set environment variables
export TEST_GITHUB_REPOSITORY="owner/repo"
export TEST_GITHUB_TOKEN="ghp_your_token_here"
export TEST_TAG_PREFIX="local-test-"

# Run GitHub E2E tests
npm run test:e2e -- --testPathPattern=github.e2e

# Run all E2E tests
npm run test:e2e
```

### In CI/CD

E2E tests run automatically:

- **After CI passes**: E2E tests run as part of the release workflow
- **Manual trigger**: E2E workflow can be triggered manually with platform selection

To manually trigger E2E tests:

1. Go to Actions → E2E Tests
2. Click "Run workflow"
3. Select platform: `all`, `github`, `gitea`, `bitbucket`, or `generic`
4. Click "Run workflow"

## Test Scenarios

Each platform E2E test suite covers:

1. **Create new tag** - Creates a tag via platform API and verifies it exists
2. **Update existing tag** - Updates an existing tag and verifies the update
3. **Platform detection** - Verifies automatic platform detection from repository URL
4. **Output verification** - Verifies all action outputs are set correctly

Generic platform tests additionally cover:

- **Annotated vs lightweight tags** - Tests tag type creation
- **Force update** - Tests updating existing tags with `force=true`
- **Push tag behavior** - Tests `push_tag` input behavior

## Cleanup

E2E tests automatically clean up test tags after each test. Tags are created with a unique timestamp-based suffix to avoid conflicts between parallel test runs.

If cleanup fails (e.g., due to network issues), tags may remain in the test repository. These can be safely deleted manually using the test tag prefix.

## Troubleshooting

### Tests are skipped

If tests show a "skipped" message, check:

1. Environment variables are set correctly
2. Repository format is correct (`owner/repo`)
3. Token has correct permissions

### Tests fail with authentication errors

1. Verify token is valid and not expired
2. Check token has `repo` scope (GitHub/Gitea) or write permissions (Bitbucket)
3. For self-hosted instances, verify base URL is correct

### Tests fail with "tag already exists"

This can happen if:
- Previous test run failed to clean up
- Multiple test runs are executing in parallel

Solution: Delete the test tag manually or wait for cleanup

## Best Practices

1. **Use dedicated test repositories** - Don't use production repositories for E2E tests
2. **Use test-specific tokens** - Create tokens specifically for E2E testing with minimal required permissions
3. **Monitor test tags** - Periodically clean up any leftover test tags in test repositories
4. **Run tests before releases** - Always ensure E2E tests pass before creating a release
