# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

