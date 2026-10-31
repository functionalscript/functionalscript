## One reader for a file the build refuses to misread

**Priority:** P4
**Status:** open

### Problem

"Read a file, parse it, and stop the build naming the file where it does not
parse" is written three times in [`fjs/website/module.f.mjs`](../module.f.mjs):

```js
// readIssues
step(readUtf8File(path), text => {
    const found = header(text)
    return found[0] === 'error'
        ? pureError(ioError({ message: `${path}: ${found[1]}` }))
        : pureOk([...read, { path, header: found[1] }])
})
```

`writeChangelog` does the same with `tryParse` over the release file, and
`fundingRead` with `parseFunding`. Each carries its own JSDoc paragraph saying
a file that does not parse stops the build naming the file, and each
cross-references the others as giving "the same answer". `readReadme` is the
fourth read-then-parse, differing only in keeping the refusal.

The same file assembles `Build` twice: `_readBuild` computes
`{ commit, branch, funding }` for the rustdoc bars, while `main` and `program`
compute the same record by hand.

### Proposal

One private helper, with the rationale written once:

```ts
readParsed: (path: string) =>
    <T>(parse: (text: string) => Result<T, string>) => Effect<ReadFile, T, IoChannel>
```

`fjs/effects` already exports `refuse`, which is the coded sibling of the
`pureError(ioError(...))` each site writes. `readIssues`, `writeChangelog` and
`fundingRead` become one call each over it, and `main` becomes `program` over
`_readBuild`.

### Tasks

- [ ] Add `readParsed` and rewrite the three sites over it.
- [ ] Build `Build` once, in `_readBuild`, and have `main` use it.

### Related

- [`fjs/effects/node/todo/readjsonfile-writejsonfile-helpers`](../../effects/node/todo/readjsonfile-writejsonfile-helpers.md)
  — a JSON-specific reader returning `Result`; neither refuses nor parses
  anything but JSON.
