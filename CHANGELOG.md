# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### [1.0.18](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v1.0.17...v1.0.18) (2026-01-28)


### Bug Fixes

* prevent CI cancellation on tag releases ([ba46a54](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/ba46a5441078df36e84e0601d9dfe6dd32e11eb6))

### [1.0.17](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v1.0.16...v1.0.17) (2026-01-28)


### Bug Fixes

* make packaging deterministic ([bc1fba6](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/bc1fba6cd6af5731d3917f2d4feb026990034f83))

### [1.0.16](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v1.0.15...v1.0.16) (2026-01-28)


### Bug Fixes

* treat repo_type git as generic ([38756b3](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/38756b3b38f396c96b11a03353e9c0165a82cc89))

## [1.0.0] - 2025-01-XX

### Added
- Initial implementation of Git tag creation and update functionality
- Support for multiple platforms: GitHub, Gitea, Bitbucket, and generic Git
- Automatic platform detection from repository URL
- Support for both local and remote repository operations
- Annotated and lightweight tag support (determined by presence of tag_message)
- Optional GPG signing for annotated tags
- Tag update functionality (delete and recreate existing tags)
- Tag existence reporting in outputs
- Self-hosted instance support with custom base URLs
- SSL certificate error handling option for self-hosted instances
- Verbose/debug logging mode
- Comprehensive input validation and error handling
