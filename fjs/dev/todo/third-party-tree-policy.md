## third-party-tree-policy. "Skip third-party trees" is written three times, and the copies disagree

**Priority:** P3
**Status:** wip

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

The website also carries its own recursive `readdir` walk, `walk`,
folded with `foldStep`, beside the `walk(root, classify)` that `fjs/dev`
exports and `clean` already uses. The two answer different questions:
`fjs/dev`'s returns the flat list of paths classified `take`, and a
directory it descends is not itself in the answer; the website's
returns one `_Walked` record per directory — its path, its files and its
subdirectories, sorted, an empty directory included — because
`writePages` writes a page for every directory. The recursion over
`readdir` is the same in both; the shape of the answer is not.

Two smaller things in `fjs/dev/module.f.mjs` sit on the same seam:
`isSourceFile` is called by nothing but its own proof, and
`loadModuleMap`'s documentation describes a `predicate` parameter it no
longer takes.

### Proposal

`fjs/dev` owns the policy, beside its `walk`:

```ts
/** A directory this repository does not enter: a dot-name, `node_modules`, `target`. */
export const isThirdParty: (name: string) => boolean
```

It is a rule about directories. Each caller still decides its own
files: test discovery skips a dot-file, the website lists one. The
three sites call it for a directory, and `fjs test` stops walking
`target`. That is the fix, and it stands on its own.

The two recursions over `readdir` are a second, smaller matter. They
answer different shapes — `walk` a flat list in `readdir` order, the
website a record per directory — so folding one into the other is not
free, and the order `walk` answers in is what any shared walk has to
keep. Whether to share the recursion, and how, is the implementer's
call; the policy does not wait on it.

`isSourceFile` goes, and `loadModuleMap`'s doc says what it takes.

### Tasks

- [ ] `isThirdParty` in `fjs/dev/module.f.mjs`, with a proof; the three
      sites call it.
- [ ] Delete `isSourceFile`; correct `loadModuleMap`'s doc.
- [ ] Decide whether the two recursions share a walk; if they do,
      `walk`'s order and the website's tree are unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [`../clean/module.f.mjs`](../clean/module.f.mjs) — already walks through
  `walk`; only its policy is a copy.
