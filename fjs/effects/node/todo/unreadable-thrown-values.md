## Answer a thrown value that cannot be described

**Priority:** P3
**Status:** open

### Problem

`io` in [`../module.mjs`](../module.mjs) turns whatever a handler threw into an
`IoError` by passing it to `toIoError`, with no guard around that call. Reading
the value runs the value's own code, and that code can throw. When it does,
`toIoError` throws and the handler rejects, instead of answering through the
operation's error channel:

```js
throw { toString() { throw 1 } } // String(e) throws
throw { get code() { throw 1 } } // reading `code` throws
throw { get message() { throw 1 } } // reading `message` throws
```

The filesystem, network and subprocess handlers reject only with Node's own
errors, which read cleanly. The `import` operation is different: it evaluates
an arbitrary module, and that module can throw any of the values above.

Such a value is outside every `.f.mjs` function's domain
([fjs/AGENTS.md](../../../AGENTS.md)), so the fix does not belong in
`toIoError`. It belongs at the host boundary that hands values over. The
browser runner's `import` already has that guard: `startBrowserTestSources` in
[`fjs/emergent_testing/browser`](../../../emergent_testing/browser/module.mjs)
catches a failed normalization and answers an `IoError` that names the value as
unreadable.

The first two inputs above already reject on the commit before
[#2671](https://github.com/functionalscript/functionalscript/pull/2671). That
pull request added the third, when `toIoError` started reading `message` off a
non-`Error` ([review](https://github.com/functionalscript/functionalscript/pull/2671#discussion_r4217608078)).

### Proposal

Guard the normalization in `io` the way the browser runner does: if describing
the value throws, answer an `IoError` whose message says the thrown value could
not be read. Decide whether the two runners share that sentence.

### Tasks

- [ ] Guard `toIoError` in `io`, answering an `IoError` when describing the value throws.
- [ ] A proof that imports a module throwing each value above, and gets an `IoError` back.
