/**
 * A ref name's two spellings: the bytes Git stores it as, and the text a host
 * path is.
 *
 * **A ref name is bytes and a path is text, joined by UTF-8 in both
 * directions.** A directory entry called `é` is the name `0xC3 0xA9`, and that
 * name reads back as the path `é`. Reading a byte as a code point instead
 * spells the same name `Ã©`, which is a file no repository has — so the
 * listing and the lookup would disagree about one ref, each right about its
 * own half.
 *
 * The join is lossless only for a name that *is* UTF-8, and Git requires no
 * such thing: `refs/heads/\x80` is a name `git check-ref-format` accepts and
 * `rev-parse` resolves, measured. {@link nameText} answers `null` for one, and
 * what each half of [`fjs/git/refstore`](../module.f.mjs) makes of that is
 * argued in that module's header.
 *
 * Nothing here runs an effect. The store asks these of every name before it
 * opens a file, and [`../write`](../write/module.f.mjs) before it writes one;
 * which of the two directories a name's file sits in is
 * [`../scope`](../scope/module.f.mjs)'s question, not this module's.
 *
 * @module
 *
 * @import { Nullable } from '../../../types/nullable/types.ts'
 * @import { Bytes } from '../../types.ts'
 */

import { byteArray } from '../../../ebnf/byte/module.f.mjs'
import { fromVec, stringToU8List } from '../../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../../text/utf16/module.f.mjs'
import { maxLengthBytes, u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { isWholeName } from '../../refname/module.f.mjs'

/**
 * A ref name as the bytes Git stores it as, from the text a path is.
 *
 * A loose ref's name is a file name, which the host hands over as a string
 * because node decodes a directory entry as UTF-8. A `packed-refs` name
 * never leaves the byte world. Encoding back to UTF-8 here makes the two one
 * name, which is what lets a loose ref shadow a packed one, and it
 * round-trips for every name node decoded from valid UTF-8 bytes.
 *
 * @type {(s: string) => readonly number[]} */
export const nameBytes = s => toArray(stringToU8List(s))

/**
 * A ref name as a string that stands for its bytes, for use as a key.
 *
 * One code unit per byte, which is **not** a decoding and never becomes a path —
 * {@link nameText} is the decoding, and it is UTF-8. This is only an injective
 * encoding: two names give the same key exactly when they are the same bytes, so
 * a `Map` or a `Set` over it answers what
 * [`fjs/types/list`](../../../types/list/module.f.mjs)'s `sameItems` answers, in
 * one lookup rather than a pass per name.
 *
 * That matters at the size a repository reaches. Comparing every packed line
 * against every other is quadratic in the count and allocates a tail array per
 * line, where this is one pass and a lookup each: measured over 20,000 names,
 * the pairwise shape is two orders of magnitude slower, and `git pack-refs` on
 * a busy repository writes more lines than that.
 *
 * @type {(name: Bytes) => string}
 */
export const nameKey = name => codePointListToString(toArray(name))

/** The one ref name whose target Git constrains. */
export const head = /** @type {const} */ ('HEAD')

/** The ref name `HEAD` is, as the bytes the store compares. */
export const headName = nameBytes(head)

/** The prefix `HEAD`'s target must carry. */
export const refsPrefix = /** @type {const} */ ('refs/')

/**
 * The text of a ref name, for the path its loose file sits at, or `null` where
 * the bytes are no UTF-8.
 *
 * Decoded as UTF-8 and not a byte per code point, which is the inverse of
 * {@link nameBytes} and has to be: a name of the two bytes `0xC3 0xA9` is the
 * one character `é` on the filesystem, and reading each byte as a code point
 * would ask the host for `Ã©` instead and miss the file. Bytes that are no
 * UTF-8 name no file node could have handed us, so they answer `null` rather
 * than a path built from replacement characters.
 *
 * `null` means *no path can be built*, not that the name is bad. A ref name is
 * bytes and Git takes any byte the name rule allows —
 * `git check-ref-format refs/heads/\x80` is accepted, and `show-ref` and
 * `rev-parse` both handle such a ref, measured. What cannot carry one is this
 * host's path: node reads a directory entry as UTF-8 with replacement, so the
 * same byte comes back as U+FFFD and a `readFile` of that string answers
 * `ENOENT`, measured. The consequence for a *lookup* is {@link askable}'s to
 * state, and it is a refusal;
 * [`todo/byte-ref-names.md`](../todo/byte-ref-names.md) has the rest.
 *
 * **A name past `maxLengthBytes` is `null` too**, and the check has to come
 * before the conversion: `Bytes` is unbounded and `u8ListToVecMsb` asserts, so one
 * byte over escaped both [`tryWrite`](../write/module.f.mjs) and
 * [`tryResolve`](../module.f.mjs) as a bare `'assertion failed'` rather than as
 * an answer — measured, at 131,073 bytes. Found by review of
 * [#2115](https://github.com/functionalscript/functionalscript/pull/2115).
 *
 * `null` rather than a code of its own because it is the same *kind* of answer:
 * there is no string to build a path from. It is **not** that the name is too
 * long for a filesystem — that is a different refusal and comes from one. A
 * name of 300 bytes converts, spells a path, and is refused by the host with
 * `ENAMETOOLONG`; measured, `git update-ref` is refused the same way and five
 * bytes earlier than `NAME_MAX` would suggest, because the lock file is what
 * fails: a last component of 250 bytes succeeds and 251 gives
 * `Unable to create '….lock': File name too long`. The writer inherits that
 * limit from the same `.lock`, which is parity rather than narrowness. Neither
 * bound is the other's, and only the conversion one is decided here.
 *
 * @type {(name: readonly number[]) => Nullable<string>}
 */
export const nameText = name =>
    name.length > Number(maxLengthBytes) ? null : fromVec(u8ListToVecMsb(name))

/**
 * Whether a name sits under {@link refsPrefix}, as `HEAD`'s target must: `false`
 * for a name {@link nameText} cannot spell.
 *
 * @type {(name: Bytes) => boolean}
 */
export const isUnderRefs = name => nameText(byteArray(name))?.startsWith(refsPrefix) === true

/**
 * The path spelling of a name the store can answer for, or `null` where it
 * cannot — which is one answer and not two, because both reasons mean the same
 * thing to a caller: no file of this repository is that ref's.
 *
 * Asked *before* anything is read, by both of the store's callers.
 * [`tryResolve`](../module.f.mjs) promises that a name which is no ref name is
 * `null` "before any file is opened", and that promise was not kept: the
 * `packed-refs` read came first, so a `packed-refs` the host refuses for any
 * reason other than absence made the answer for `../secret` a channel error
 * rather than `null` — a value known not to be a ref, answered out of the
 * filesystem's state.
 *
 * @type {(name: Bytes) => Nullable<string>}
 */
export const askable = name => {
    const dense = byteArray(name)
    // A name that is no ref name never reaches the filesystem. `..` is
    // one of the byte pairs `isWholeName` refuses, so this is also what
    // keeps `../secret` from being joined below either directory and read: a path
    // that leaves the repository is not a ref this can answer for, and
    // the file at the other end of it could begin with something that
    // looks like an id.
    if (!isWholeName(dense)) { return null }
    // No path can name this ref's loose file, so whether one exists is not a
    // question this host can put to the filesystem — and a loose file
    // shadows a packed line by existing, so the packed line is the answer
    // only if there is no loose file. Unknowable, not absent: answering the
    // packed line would be a stale id whenever the loose file is there, and
    // that state cannot even be constructed in a proof here, since the
    // virtual filesystem spells a directory entry as a string too.
    // Refused instead. See {@link nameText} and `todo/byte-ref-names.md`.
    return nameText(dense)
}

/**
 * A name for a message, which a ref name is not always: one that is no UTF-8
 * names no file and cannot be written as a path, so it is written as its bytes
 * in hex instead. See {@link nameText}.
 *
 * @type {(name: Bytes) => string}
 */
export const nameForMessage = name => {
    const dense = byteArray(name)
    return nameText(dense) ?? dense.map(b => b.toString(16).padStart(2, '0')).join('')
}
