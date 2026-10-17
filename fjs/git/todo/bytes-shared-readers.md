## `fjs/git/bytes` holds the words but not the other readers every format shares

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/bytes`](../bytes/module.f.js) exists for "the fixed-width words and
the prefix test Git's binary formats are read with": `u32be`, `u64be`,
`startsWith`. Three more readings are shared by the formats, and each is
spelled in the module that needed it first, then again in the next one.

**A field ends at its first NUL.** Git hands several values on as C strings,
and five private helpers cut at the NUL with the same two lines, each with its
own paragraph explaining why: `typeOf` in [`tag`](../tag/module.f.mjs) and
`traitsOf` in [`ref`](../ref/module.f.mjs) over bytes, `read` in
[`repo`](../repo/module.f.mjs) over bytes, `tryValue` in
[`config`](../config/module.f.mjs) and `untilNul` in
[`alternates`](../alternates/module.f.mjs) over strings.

```js
// tag.typeOf
const end = bs.indexOf(nulByte)
return typeNamed(end === -1 ? bs : bs.slice(0, end))
// alternates.untilNul
const i = entry.indexOf('\u0000')
return i === -1 ? entry : entry.slice(0, i)
```

**Two byte arrays in Git's order.** The first differing byte decides, and a
proper prefix sorts first. `compare` in [`tree`](../tree/module.f.mjs)
answers a sign for `validate`; `notAfter` in `ref` answers a boolean for
`tryPackedWithout`. Both are a `findIndex` over the shorter length, and
nothing shared says this order: `fjs/types/list` has equality only, and
`fjs/rtti/data`'s `cmpList` is short-lex, a different order.
[packed-refs-sorted](../refstore/todo/packed-refs-sorted.md) proposes
bisecting `packed-refs` on the `sorted` trait — a third site, which must agree
with `notAfter` about what sorted means, or the two halves disagree about one
file.

```js
// tree
const compare = (a, b) => {
    const n = min(a.length, b.length)
    const i = a.findIndex((x, i) => i < n && x !== b[i])
    return i === -1 ? a.length - b.length : a[i] - b[i]
}
// ref
const notAfter = a => b => {
    const i = a.findIndex((x, k) => k >= b.length || x !== b[k])
    return i === -1 || (i < b.length && a[i] < b[i])
}
```

**An id at an offset.** `oidAt` in [`packidx`](../packidx/module.f.mjs), the
`refDelta` branch of `tryEntry` in [`pack`](../pack/module.f.mjs), and the
trailer check `agrees` in [`packstore`](../packstore/module.f.mjs) each slice
`oidBytes` bytes and convert them with `u8ListToVecMsb`.

### Proposal

Three exports in `fjs/git/bytes`, next to the words:

- `cString(b)` — the bytes before the first NUL, or all of them; and
  `untilNul(s)` for the string form, moved from `alternates` and imported by
  `config`. The sentence about Git's C strings is written once, in their doc.
- `cmp(a, b): Sign` — byte-wise lexicographic order. `tree.compare` is it;
  `ref.notAfter(a)(b)` is `cmp(a, b) <= 0`; the bisection in
  packed-refs-sorted imports the same one.
- `oidAt(b, at, width)` — the id of `width` bytes at `at`, as a `Vec`.

A generic `lexicographic(cmpItem)` in `fjs/types/array` would serve `cmp` too;
`bytes` is the smaller change while Git is the only consumer.

### Tasks

- [ ] `cString` and `untilNul` in `bytes`; the five sites import them.
- [ ] `cmp` in `bytes`; `tree` and `ref` import it.
- [ ] `oidAt` in `bytes`; `packidx`, `pack` and `packstore` import it.

### Related

- [packed-refs-sorted](../refstore/todo/packed-refs-sorted.md) — the next
  user of `cmp`.
- [lazy-index-ids](../packidx/todo/lazy-index-ids.md) — keeps ids as bytes in
  `Idx` and compares by byte, which `cmp` is.
- [byte-paths](./byte-paths.md) — names `untilNul` as where the cut sits
  today.
