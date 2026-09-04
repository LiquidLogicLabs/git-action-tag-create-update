## [2.0.9](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.8...v2.0.9) (2026-09-04)



## [2.0.8](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.7...v2.0.8) (2026-09-04)


### Bug Fixes

* encode every value interpolated into an API URL path ([87475e6](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/87475e6d7bd5deb5aa5afb371f8b7cad8d9963c7))



## [2.0.7](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.6...v2.0.7) (2026-09-04)


### Bug Fixes

* reject tag names git would read as an option or a refspec ([3057fbd](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/3057fbd806a0ac173cda4a98b29f0ae030dc2c38))



## [2.0.6](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.5...v2.0.6) (2026-09-03)


### Bug Fixes

* **gitea:** delete tags through the endpoint that actually deletes them ([920aae7](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/920aae7bbce52dcc523412f023e03dd97f63046d))



## [2.0.5](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.4...v2.0.5) (2026-09-03)


### Bug Fixes

* **lint:** quote eslint glob so all of src/ is linted ([8f0843d](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/8f0843d58e168a7ee46320e82789290cdc062289))
* **lint:** resolve errors surfaced by the widened glob ([0874441](https://github.com/LiquidLogicLabs/git-action-tag-create-update/commit/0874441c2feeaa077cf0359e2d51577f57bbcb78))



## [2.0.4](https://github.com/LiquidLogicLabs/git-action-tag-create-update/compare/v2.0.3...v2.0.4) (2026-07-05)



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
