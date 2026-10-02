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
 * {@link isWholeName} is the rule for a name that stands on its own, with no
 * prefix above it: {@link isName}, and not `@` alone. That is what a
 * `packed-refs` entry and a symbolic ref's target must each pass, and it is
 * `git check-ref-format --allow-onelevel`.
 *
 * One rule that sounds like it belongs here does not: `check-ref-format`
 * *without* `--allow-onelevel` also demands at least two components, which
 * is why a bare `main` is refused there. No ref file imposes that. A
 * `packed-refs` line naming `master`, and a symbolic ref pointing at it, are
 * both accepted by Git 2.43.0, so the two-component rule is that command's
 * default and not a fact about the files.
 *
 * The name is never held: every rule is decided in one forward pass over its
 * bytes, with a state of fixed size, so a check holds nothing proportional to
 * the name. Holding it as a dense array would cost eight bytes
 * of heap per byte; a packed vector would be smaller but caps at 128 KiB, and
 * a name is as long as its author made it.
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

import { assert } from '../../asserts/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import {
    commercialAt as at, fullStop as dot, leftCurlyBracket as brace, solidus as slash, space,
} from '../../text/ascii/module.f.mjs'
import { fold, sameItems } from '../../types/list/module.f.mjs'
import { isByte } from '../../types/number/module.f.mjs'

const del = /** @type {const} */ (0x7F)

/** The bytes a ref name may not hold, besides the control characters. */
const forbidden = ascii(' ~^:?*[\\')

/**
 * The suffix no component of a ref name may end in, and so the one a writer's
 * lock file may safely carry: `refs/heads/x.lock` is a file the walk of `refs/`
 * skips and a name {@link isWholeName} refuses, which is what makes it a
 * write in progress rather than a ref.
 *
 * Exported as the text a path is built from, with the bytes below derived from
 * it, so the two spellings cannot drift —
 * [`fjs/git/refstore`](../refstore/module.f.mjs)'s writer names the lock.
 */
export const lockSuffix = /** @type {const} */ ('.lock')

const lock = ascii(lockSuffix)

/**
 * Where a pass over a name stands after some of its bytes: the byte before,
 * or `null` before the first; the last bytes of the current component, at
 * most as many as {@link lock} has; whether every byte rule has held so far;
 * and whether every component closed so far was one.
 *
 * Of the rules, `..` and `@{` need the byte before, the empty component and
 * the leading `.` need to know whether a component starts here — which the
 * byte before says too — and `.lock` needs the component's last bytes, read
 * when a slash or the end of the name closes it.
 */
const init = {
    /** @type {number | null} */
    prev: null,
    /** @type {readonly number[]} */
    tail: [],
    bytes: true,
    components: true,
}

/** @type {(prev: number | null) => boolean} */
const atStart = prev => prev === null || prev === slash

/**
 * Whether the component a pass is in, closed here, is one: not empty, not
 * ending in `.lock`. Not beginning with `.` is checked as its first byte
 * arrives.
 *
 * @type {(state: typeof init) => boolean}
 */
const closes = ({ prev, tail }) =>
    !atStart(prev) && !(tail.length === lock.length && tail.every((b, i) => b === lock[i]))

/**
 * One byte of a name, read into the pass.
 *
 * @throws If `b` is not a byte. `fold` meets a hole in a sparse array as
 * `undefined`, so a hole is refused too rather than stepped over.
 *
 * @type {(b: number) => (state: typeof init) => typeof init}
 */
const step = b => state => {
    assert(isByte(b), ['not bytes', b])
    const { prev, tail, bytes, components } = state
    const isSlash = b === slash
    return {
        prev: b,
        tail: isSlash ? [] : [...tail, b].slice(-lock.length),
        bytes: bytes
            && b >= space && b !== del && !forbidden.includes(b)
            && !(prev === dot && b === dot)
            && !(prev === at && b === brace),
        components: components
            && (isSlash ? closes(state) : !(atStart(prev) && b === dot)),
    }
}

/**
 * A name read in one pass: whether every byte rule holds, a trailing `.`
 * included, and whether every component between slashes is one.
 *
 * @throws If `name` is not a list of bytes.
 *
 * @type {(name: Bytes) => { readonly bytes: boolean, readonly components: boolean }}
 */
const check = name => {
    const state = fold(step)(init)(name)
    return {
        bytes: state.bytes && state.prev !== dot,
        components: state.components && closes(state),
    }
}

/**
 * Whether every component of a name is one a ref name may hold: none empty,
 * none beginning with `.`, none ending in `.lock`.
 *
 * This is the half of {@link isName} that Git's *walk* of `refs/` applies as a
 * file-name convention rather than as a ref-name rule, and the difference
 * matters to a reader of the directory. Measured on Git 2.43.0 by writing a
 * valid id into each name under `refs/heads/` and asking `git show-ref`: a file
 * called `.hidden` or `x.lock` is skipped without a word and the command exits
 * 0, while `bad.`, `a..b`, `a@{b`, `has space`, `tilde~x` and `caret^x` — every
 * one of them refused by `check-ref-format` too — make it exit 128 with
 * `bad ref refs/heads/<name>`. So the two conventions are skipped and every
 * other broken name refuses the listing, which is exactly what Git does with a
 * loose file whose *contents* are no ref.
 *
 * It is also the half that is safe to apply to a *prefix*. A component keeps
 * its shape however a name is extended, so no valid ref name can sit under a
 * component this refuses — where a whole name may fail {@link isName} on its
 * last byte and still be a directory full of valid names: `refs/heads/bad.` is
 * no ref name and `refs/heads/bad./v1` is one, both measured with
 * `check-ref-format`. A walk that skipped the first by the whole-name rule
 * would lose the second without a word.
 *
 * @throws If `name` is not a list of bytes.
 *
 * @type {(name: Bytes) => boolean}
 */
export const hasRefComponents = name => check(name).components

/**
 * Whether a name is one a ref takes below a prefix, by the rules of
 * `git check-ref-format` over `<prefix>/<name>`: no control character, no
 * space and none of `~ ^ : ? * [ \`, no `..` and no `@{`, not ending in
 * `.`, and every component between slashes one {@link hasRefComponents}
 * takes.
 *
 * Every item is checked to be a byte as the pass reads it, so a caller that
 * hands something that is no byte list panics rather than being told its
 * value is a ref name. That is not belt and braces: a value above `0xFF`
 * satisfies every rule, since no rule has an upper bound, and so would a
 * hole in a sparse array if it were stepped over. Both are a caller's bug
 * rather than a name that is not one.
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
export const isName = name => {
    const { bytes, components } = check(name)
    return bytes && components
}

/**
 * Whether a whole ref name is one Git takes: {@link isName}, and not `@`
 * alone.
 *
 * This is the name a `packed-refs` entry carries and the name a symbolic ref
 * points at, and it is `git check-ref-format --allow-onelevel`. One level is
 * enough, which is the part a reader would get wrong: measured on Git 2.43.0,
 * a `packed-refs` line naming `master`, `a`, `a/b`, `refs` or `HEAD` is read
 * by `git show-ref`, and a symbolic ref pointing at `master` or `a/b`
 * resolves. What is refused is `@` alone, which Git reports as
 * `packed refname is dangerous`, along with everything {@link isName}
 * already refuses.
 *
 * `@` is the whole difference from {@link isName}, because `@` is a fine
 * component and no ref name on its own.
 *
 * Two rules that are *not* here, each because it belongs to something else:
 *
 * - **At least two components.** `check-ref-format` demands it without
 *   `--allow-onelevel`, and no ref file does.
 * - **A target under `refs/`.** `HEAD` does need that, and it is not a rule
 *   about ref names: writing `ref: a/b` into `.git/HEAD` stops Git treating
 *   the directory as a repository at all, where the same target in
 *   `refs/heads/sym` resolves. So it is a rule about what `HEAD` may say, and
 *   it belongs to a reader that knows it is reading `HEAD`.
 *
 * `FETCH_HEAD` and `MERGE_HEAD` behave differently again as symbolic
 * *targets*, and not in a way any name rule can express: Git resolves a
 * symbolic ref pointing at either one when that file exists and refuses it
 * when it does not, while `ORIG_HEAD` resolves either way. So the answer
 * depends on the state of the repository rather than on the name, which is
 * why it is neither checked here nor in `fjs/git/ref` — see that module, and
 * [`fjs/git/refstore`](../refstore/module.f.mjs)'s `tryResolve`, which has the
 * effects to look.
 *
 * @throws If `name` is not a list of bytes.
 *
 * @type {(name: Bytes) => boolean}
 */
export const isWholeName = name => isName(name) && !sameItems(name)([at])

/**
 * Whether two names are the same bytes: `fjs/types/list`'s `sameItems`,
 * which is byte-for-byte equality and nothing more. A name is bytes,
 * compared as they are — no case folding, no normalisation, since Git
 * compares them so and two names differing by either are two names. It
 * stops at the first byte that differs, and materialises neither name to
 * get there.
 *
 * The one comparison of names in `fjs/git`: a tree entry's name in
 * [`fjs/git/walk`](../walk/module.f.mjs), a ref's in
 * [`fjs/git/refstore`](../refstore/module.f.mjs), a header's key in
 * [`fjs/git/header`](../header/module.f.mjs) and an object type's name in
 * [`fjs/git/object`](../object/module.f.mjs) all ask it.
 *
 * @type {(a: Bytes) => (b: Bytes) => boolean}
 */
export const sameBytes = sameItems
