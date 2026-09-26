## third-party-tree-policy. "Skip third-party trees" is written three times, and the copies disagree

**Priority:** P3
**Status:** open

### Problem

Three walks over the repository each decide, on their own, which
directories hold other people's files and are not entered:

```js
// fjs/dev/module.f.mjs, allFiles — what `fjs test` discovers
name.startsWith('.') ? 'skip'
: isDirectory ? (name === 'node_modules' ? 'skip' : 'descend')
// fjs/dev/clean/module.f.mjs, classify
: name.startsWith('.') || name === 'node_modules' || name === 'target' ? 'skip'
// fjs/website/module.f.mjs, ignored
const ignored = name =>
    name.startsWith('.') || name === 'node_modules' || name === 'target'
```

They have drifted: `clean` and `website` skip `target`, and `allFiles`
does not, so the test runner walks the Rust build tree — the very case the
website module's comment names as the reason to skip it, "`target` alone
can hold more files than the repository has". A rule about what the
repository is made of has one right answer, and three sites is how it
came to have two.

The website also carries its own recursive `readdir` walk, `walk`, folded
with `foldStep`, beside the `walk(root, classify)` that `fjs/dev` exports
and `clean` already uses. The one difference is that the website sorts
its entries.

Two smaller things in `fjs/dev/module.f.mjs` sit on the same seam:
`isSourceFile` is called by nothing but its own proof, and
`loadModuleMap`'s documentation describes a `predicate` parameter it no
longer takes.

### Proposal

`fjs/dev` owns the policy beside the walk it applies to:

```ts
/** A name that holds no file of this repository: a dot-name, `node_modules`, `target`. */
export const isThirdParty: (name: string) => boolean
```

`allFiles`, `clean`'s `classify` and the website's `ignored` call it, and
`fjs test` stops walking `target`. The website walks with `fjs/dev`'s
`walk` and sorts the result, so there is one recursion over `readdir`.
`isSourceFile` goes, and `loadModuleMap`'s doc says what it takes.

### Tasks

- [ ] `isThirdParty` in `fjs/dev/module.f.mjs`, with a proof; the three
      sites import it.
- [ ] `fjs/website` walks through `fjs/dev`'s `walk`.
- [ ] Delete `isSourceFile`; correct `loadModuleMap`'s doc.
- [ ] `tsc`, `fjs test`.

### Related

- [`../clean/module.f.mjs`](../clean/module.f.mjs) — already walks through
  `walk`; only its policy is a copy.
