## Release policy after 1.0

**Priority:** P3
**Status:** open

### Problem

The release policy after 1.0 remains undecided and is outside the pre-1.0
policy implementation. Discuss it when needed; this task adopts no future rule.

Open questions include whether mandatory breaking-change notices return and how
release branches, major versions, features, and fixes should work. One possible
direction is to continue releases on branches, introduce breaking changes with
major-version updates (`Mj.?.?`), and add features within a major version
(`Mj.Mi.?`). This is tentative, not an adopted policy.

### Related

- [Current pre-1.0 versioning](../changelog/README.md#breaking-changes-and-versioning)
- [Release procedure](../changelog/RELEASE.md)
