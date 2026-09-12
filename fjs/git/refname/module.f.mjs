/**
 * What names a ref takes, by the rules `git check-ref-format` applies.
 *
 * A ref name is bytes, not text: Git compares and stores it byte for byte,
 * so the rules are stated over bytes here and no decoding happens on the
 * way. The rules split in two, and which one a caller wants depends on
 * whether it holds a whole ref name or a piece of one:
 *
 * - {@link isComponent} is the rule for one component, between slashes.
 * - {@link isName} is the rule for a name below a known prefix, which is
 *   every byte rule plus every component being one — `git fsck`'s reading
 *   of a tag's `tag` header, where the ref is `refs/tags/<name>`.
 *
 * The rule for a *whole* ref name is neither of these: it adds that the
 * name has at least two components and is not `@` alone, both of which are
 * about the name's own shape rather than the bytes in it. It is not here
 * because nothing in this repository reads a whole ref name yet;
 * [`todo/refs.md`](../todo/refs.md) is the step that will.
 *
 * Measured against Git 2.43.0 rather than read off the manual page, since
 * two of the rules are not where a reader would guess. `.lock` is refused
 * at the end of *any* component, so `refs/a.lock/b` is refused; a trailing
 * `.` is refused only at the end of the whole name, so `refs/heads/a./b`
 * passes and `refs/heads/a/b.` does not. `@` is fine as a component and
 * refused as a whole name: `refs/heads/@` and `refs/@/x` both pass.
 *
 * @module
 */

import { ascii } from '../../ebnf/byte/module.f.mjs'

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
export const isComponent = component =>
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
export const components = name => {
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
 * @type {(name: readonly number[]) => boolean}
 */
export const isName = name =>
    name.every(b => b >= 0x20 && b !== del && !forbidden.includes(b))
    && !holdsPair(name, dot, dot)
    && !holdsPair(name, at, brace)
    && name[name.length - 1] !== dot
    && components(name).every(isComponent)
