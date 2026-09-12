/**
 * What names a ref takes, by the rules `git check-ref-format` applies.
 *
 * A ref name is bytes, not text: Git compares and stores it byte for byte,
 * so the rules are stated over bytes here and no decoding happens on the
 * way. The rules split in two, and which one a caller wants depends on
 * whether it holds a whole ref name or a piece of one:
 *
 * {@link isName} is the rule for a name below a known prefix: every byte
 * rule, plus every component between slashes being one. That is `git fsck`'s
 * reading of a tag's `tag` header, where the ref is `refs/tags/<name>`. The
 * per-component rule is not exported on its own, because nothing needs a
 * component without the name around it.
 *
 * The rule for a *whole* ref name is neither of these: it adds that the
 * name has at least two components and is not `@` alone, both of which are
 * about the name's own shape rather than the bytes in it. It is not here
 * because nothing in this repository reads a whole ref name yet;
 * [`todo/refs.md`](../todo/refs.md) is the step that will.
 *
 * The name is materialised to be read, which costs eight bytes of heap per
 * byte of name and is avoidable rather than merely shrinkable: every rule
 * below is decidable in one forward pass with an accumulator of fixed size.
 * [`todo/one-pass-name-check.md`](./todo/one-pass-name-check.md) has the
 * measurements, and why neither a packed vector nor a hex string is the fix —
 * a bit vector caps at 128 KiB and so cannot carry a payload of arbitrary
 * size at all.
 *
 * Measured against Git 2.43.0 rather than read off the manual page, since
 * two of the rules are not where a reader would guess. `.lock` is refused
 * at the end of *any* component, so `refs/a.lock/b` is refused; a trailing
 * `.` is refused only at the end of the whole name, so `refs/heads/a./b`
 * passes and `refs/heads/a/b.` does not. `@` is fine as a component and
 * refused as a whole name: `refs/heads/@` and `refs/@/x` both pass.
 *
 * @module
 *
 * @import { Bytes } from '../types.ts'
 */

import { ascii, byteArray } from '../../ebnf/byte/module.f.mjs'

const dot = /** @type {const} */ (0x2E)

const slash = /** @type {const} */ (0x2F)

const at = /** @type {const} */ (0x40)

const brace = /** @type {const} */ (0x7B)

const del = /** @type {const} */ (0x7F)

/** The bytes a ref name may not hold, besides the control characters. */
const forbidden = ascii(' ~^:?*[\\')

const lock = ascii('.lock')

/**
 * Whether two bytes sit next to each other in a name, in that order.
 *
 * @type {(name: readonly number[], a: number, b: number) => boolean}
 */
const holdsPair = (name, a, b) => name.some((x, i) => i !== 0 && name[i - 1] === a && x === b)

/**
 * Whether a component of a ref name, between slashes, is one: not empty,
 * not beginning with `.`, not ending in `.lock`.
 *
 * @type {(component: readonly number[]) => boolean}
 */
const isComponent = component =>
    component.length !== 0
    && component[0] !== dot
    && !(component.length >= lock.length && lock.every((b, i) => component[component.length - lock.length + i] === b))

/**
 * The components of a name, between its slashes: the bytes before the
 * first, between each two, and after the last, so a name with none is one
 * component and `a//b` has an empty one. Sliced once each, not grown byte
 * by byte, since a name is as long as its author made it.
 *
 * @type {(name: readonly number[]) => readonly (readonly number[])[]}
 */
const components = name => {
    const slashes = name.flatMap((b, i) => b === slash ? [i] : [])
    /** @type {readonly number[]} */
    const starts = [0, ...slashes.map(i => i + 1)]
    /** @type {readonly number[]} */
    const ends = [...slashes, name.length]
    return starts.map((start, i) => name.slice(start, ends[i]))
}

/**
 * Whether a name is one a ref takes below a prefix, by the rules of
 * `git check-ref-format` over `<prefix>/<name>`: no control character, no
 * space and none of `~ ^ : ? * [ \`, no `..` and no `@{`, not ending in
 * `.`, and every component between slashes one {@link isComponent} takes.
 *
 * The name is read through {@link byteArray} first, so a caller that hands
 * something that is no byte list panics rather than being told its value is
 * a ref name. That is not belt and braces: `every` and `flatMap` step over
 * a hole in a sparse array, so `new Array(1)` would satisfy every rule
 * below without a single byte being looked at, and a value above `0xFF`
 * satisfies them too since no rule has an upper bound. Both are a caller's
 * bug rather than a name that is not one, and {@link byteArray} is where
 * this repository already refuses them.
 *
 * A name that is `@` alone passes, since the ref it names is
 * `<prefix>/@` — `refs/heads/@` and `refs/tags/@` are both names
 * `check-ref-format` accepts, and only a whole ref name of `@` is refused.
 *
 * This is the rule `git fsck` applies to a tag's `tag` header, where it
 * only warns — as `badTagName` — and exits clean, and the rule
 * `git mktag` applies, strict by default, where it refuses to write the
 * object. A reader refuses it too, since a name no ref takes names
 * nothing.
 *
 * @throws If `name` is not a list of bytes.
 *
 * @type {(name: Bytes) => boolean}
 */
export const isName = input => {
    const name = byteArray(input)
    return name.every(b => b >= 0x20 && b !== del && !forbidden.includes(b))
        && !holdsPair(name, dot, dot)
        && !holdsPair(name, at, brace)
        && name[name.length - 1] !== dot
        && components(name).every(isComponent)
}
