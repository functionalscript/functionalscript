# Changelog

All notable changes to this project are documented in this directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Layout

```
changelog/
  README.md        this file
  unreleased/
    <PR>.md        entries not released yet, one file per pull request
  <version>/
    <PR>.md        one directory per released version, entry files kept as-is
  <version>.md     one file per released version (releases through 0.44.0)
```

A pull request adds `changelog/unreleased/<PR>.md` named by its own number, so
two pull requests can never conflict on the same lines. A pull request with
several entries puts them all in its one file. Releasing renames
`changelog/unreleased/` to `changelog/<version>/`, keeping the entry files
exactly as they are. Git does not track empty directories, so `unreleased/`
simply does not exist between a release and the next pull request that adds an
entry — that pull request recreates it by adding its file.

Releases through `0.44.0` predate the directory-per-version layout: each is a
single `<version>.md` file whose entries were concatenated in descending
pull-request-number order. They stay as they are; a renderer of the changelog
reads both forms.

Entries are therefore ordered by pull-request number, not by merge order — a
pull request opened earlier can merge after one opened later. The deviation is
accepted: pull-request order is deterministic and conflict-free.

An entry file holds only Markdown list items — the version or pull-request
number is the file name, never a heading inside the file. Entries stay in a
small Markdown subset: paragraphs, list items, inline code, bold, and links.
That subset is a convention rather than an accident, so the changelog can be
rendered on the website by a self-hosted parser. A `<version>.md` file that is
empty retrofits a released section that recorded no entries.

## Versioning

While the package is pre-1.0, the minor position carries the meaning the major
one will carry after 1.0: `0.Y` is bumped **only** by a release containing
`**BREAKING CHANGES:**`, and every other release — new features included — is a
patch bump. So `0.Y` is the API-compatibility boundary, which is also the
boundary `^0.Y.Z` and `~0.Y.Z` ranges already enforce: a patch upgrade is always
safe, and crossing `0.Y` always means reading the entries of the versions
crossed. Releases through `0.41.0` predate this convention and used a minor bump
for feature-only releases as well.

## Entries

New entries are at most a few lines and contain no links: the file name is the
pull-request number, so repeating it — or linking it — inside the file is
redundant, and a renderer derives the PR link from the name. Entries written
before the directory-per-version layout end with an inline PR link (and a few
of the oldest have none) — they are kept as history, not rewritten. The full
rules are in [AGENTS.md §8.3](../AGENTS.md#83-changelog).
