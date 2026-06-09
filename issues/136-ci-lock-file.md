# 136. CI should have all tools and image versions in a specific file.

**Priority:** P3
**Status:** done

CI should have all tools and image versions in a specific file. This file is a kind of `lock` file for the CI. The lock file will be periodically updated. We will also need instructions on how to check the newest tool version in `README.md`.

## Resolution

Implemented as [`fs/ci/config/module.f.ts`](../fs/ci/config/module.f.ts), which
centralizes CI runner images, tool versions, and GitHub Action versions used by
the CI generator.

The follow-up direction of making the CI lock loadable as JSON is tracked
separately by [i668-ci-lock](./668-ci-lock.md).
