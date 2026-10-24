# Tooling

**Status:** implemented

The files the repository's tooling reads, and the responses its website reads
from GitHub, are schemas too:

- the generated CI workflows, in [`ci/common`](../../../../ci/common/module.f.mjs).
  Closed: CI reads its own generated workflows back, so a key the schema does
  not name is generator drift;
- the site's funding manifest, in
  [`website/funding`](../../../../website/funding/module.f.mjs). `open` at
  every level: the footer reads only the funding channels;
- the GitHub responses the website reads: the sign-in exchange in
  [`website/github`](../../../../website/github/module.f.mjs), and the open
  pull requests with their checks in
  [`website/prs`](../../../../website/prs/module.f.mjs). `open` at every
  object, because GitHub adds fields.

## Examples

The demo on this page offers three schemas: a GitHub Actions workflow, the
funding channels, and the open pull requests, each with a value it accepts.
They are defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists them among all the others.

## Where it is implemented

The modules linked above.
