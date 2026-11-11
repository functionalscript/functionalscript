# Reuse JSON string quoting in DataJS vector diagnostics

**Priority:** P2
**Status:** wip

## Problem

`media/datajs/vectors` calls native `JSON.stringify` only to quote string
values, object keys and diagnostic paths. Our JSON serializer already writes
those literals through `js/string_escape`'s `stringLiteral`.

## Direction

Reuse that existing writer directly and preserve diagnostic text, including
control characters, quotes, backslashes and unpaired surrogates. The module
remains `.f.mjs` while the imported string writer uses `new Map`; this task
does not change that lookup implementation.

## Tasks

- [ ] Replace native string quoting and verify diagnostic compatibility.
- [ ] Refresh the dependency leaf audit and run scoped checks.
