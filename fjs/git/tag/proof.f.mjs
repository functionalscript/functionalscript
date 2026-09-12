/**
 * @import { Tag } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { toHex } from '../oid/module.f.mjs'
import { latin1, tagPayload } from '../testlib.f.mjs'
import { name, object, tagger, tryObject, tryRead, tryTarget, tryTargetAt, tryType, type, validate, write } from './module.f.mjs'

/** @type {(input: readonly number[]) => Tag} */
const read = input => {
    const t = tryRead(input)
    assert(t !== null)
    return t
}

/** @type {(lines: readonly string[]) => Tag} */
const tag = lines => read(latin1(lines.join('\n')))

/** @type {(bytes: readonly number[]) => string} */
const text = codePointListToString

const id = /** @type {const} */ ('9fed27590671460cacf76884f17cd2a4b17f7220')

const validate20 = validate(20)

/**
 * The headers every rule below starts from: a tag `git fsck` accepts.
 *
 * @type {readonly string[]}
 */
const lines = [`object ${id}`, 'type commit', 'tag v1', 'tagger A <a@b> 1 +0000', '', 'm']

/** @type {(i: number, line: string) => Tag} */
const replaced = (i, line) => tag(lines.map((l, j) => j === i ? line : l))

export const proof = {
    // The real signed tag: four headers by position, the signature part
    // of the message, vouched for, and written back to the same bytes.
    signed: () => {
        const t = read(tagPayload)
        assertStructurallySame(t.headers.map(([k]) => text(toArray(k))), ['object', 'type', 'tag', 'tagger'])
        assertEq(text(toArray(toHex(object(t)))), id)
        assertEq(type(t), 'commit')
        assertEq(text(toArray(name(t))), 'v2')
        const who = tagger(t)
        assert(who !== null)
        assertEq(text(toArray(who.name)), 'Proof')
        assertEq(text(toArray(who.email)), 'proof@example.com')
        assertEq(who.time, 1700000000n)
        assertEq(who.tz, '+0100')
        const message = text(toArray(t.message)).split('\n')
        assertEq(message[0], 'Version two, signed')
        assertEq(message[1], '-----BEGIN SSH SIGNATURE-----')
        assertEq(message[6], '-----END SSH SIGNATURE-----')
        assertStructurallySame(validate20(t), ['ok', t])
        assertStructurallySame(toArray(write(t)), tagPayload)
    },
    // A tag without `tagger`, as very old tags are: read, vouched for, and
    // `tagger` is `null`.
    old: () => {
        const t = tag([`object ${id}`, 'type blob', 'tag old', '', ''])
        assertEq(tagger(t), null)
        assertEq(type(t), 'blob')
        assertStructurallySame(validate20(t), ['ok', t])
    },
    // The other id width, and each width refuses the other's id.
    sha256: () => {
        const t = tag([`object ${'ab'.repeat(32)}`, 'type tree', 'tag x', '', ''])
        assertStructurallySame(validate(32)(t), ['ok', t])
        assertStructurallySame(validate20(t), ['error', 'not an id'])
        assertStructurallySame(validate(32)(tag(lines)), ['error', 'not an id'])
    },
    // What `fsck` only notes passes: a header after `tagger`, and a
    // capital letter in the id, which Git reads.
    noted: () => {
        const extra = tag([...lines.slice(0, 4), 'note x', ...lines.slice(4)])
        assertStructurallySame(validate20(extra), ['ok', extra])
        const capital = replaced(0, `object ${id.toUpperCase()}`)
        assertStructurallySame(validate20(capital), ['ok', capital])
        assertEq(text(toArray(toHex(object(capital)))), id)
    },
    // The id the tag names without the panic, at the repository's width:
    // the id, or `null` where the first header is not `object`, its value
    // is no hex id, or the id is of the other width. For a caller peeling
    // a tag it has not vouched for, so it refuses where `object` would
    // panic.
    tryObject: () => {
        const t = tag(lines)
        const o = tryObject(20)(t)
        assert(o !== null)
        assertEq(text(toArray(toHex(o))), id)
        assertEq(tryObject(32)(t), null)
        assertEq(tryObject(20)(replaced(0, 'object zz')), null)
        assertEq(tryObject(20)(replaced(0, 'type commit')), null)
    },
    // The type the tag declares for its target without the panic: the
    // type, or `null` where the second header is not `type` or its value
    // names none of the four. For a caller peeling a tag it has not
    // vouched for, which checks the object it reaches against this.
    tryType: () => {
        assertEq(tryType(tag(lines)), 'commit')
        assertEq(tryType(replaced(1, 'tag v1')), null)
        assertEq(tryType(replaced(1, 'type commits')), null)
        // The value is a C string to Git, so it ends at its first NUL and
        // what follows is not read. Measured on Git 2.43.0: a tag whose
        // type line is `type blob` and a NUL peels to the blob, and so does
        // one with bytes after the NUL, where a value beginning with a NUL
        // is `unknown tag type ''`.
        assertEq(tryType(replaced(1, 'type blob\0')), 'blob')
        assertEq(tryType(replaced(1, 'type blob\0junk')), 'blob')
        assertEq(tryType(replaced(1, 'type \0blob')), null)
        // A continuation folded into the value leaves an LF in it, and
        // that is no type: Git reads the `type` line and then wants `tag `
        // on the line after, which the continuation is not. Without this
        // the NUL cut would hide the continuation and accept a tag Git
        // refuses — measured on Git 2.43.0, where `type blob<NUL>` with a
        // continuation before `tag` is `Not a valid object name`.
        assertEq(tryType(tag([`object ${id}`, 'type blob\0', ' cont', 'tag v1', '', 'm'])), null)
        assertEq(tryType(tag([`object ${id}`, 'type blob', ' cont', 'tag v1', '', 'm'])), null)
    },
    // What a tag names and what it says that object is, taken together as
    // Git's own parse takes them: the `object` header first naming an id of
    // the width, `type` second naming one of the four, and `tag` third. A
    // tag with no `tagger` parses, as it does for Git; one missing its `tag`
    // header, or holding `type` after it, does not.
    tryTarget: () => {
        const t = tryTarget(20)(tag(lines))
        assert(t !== null)
        assertEq(text(toArray(toHex(t.id))), id)
        assertEq(t.type, 'commit')
        assertEq(tryTarget(32)(tag(lines)), null)
        assertEq(tryTarget(20)(replaced(0, 'object zz')), null)
        assertEq(tryTarget(20)(replaced(1, 'type commits')), null)
        assertEq(tryTarget(20)(replaced(2, 'tagger A <a@b> 1 +0000')), null)
        assert(tryTarget(20)(tag(lines.slice(0, 3).concat(['', 'm', '']))) !== null)
    },
    // The same of a tag's bytes, where the length is. Git's parse refuses a
    // payload shorter than the hexadecimal id plus 24 before it reads a
    // header at all, so 64 bytes is the least a SHA-1 tag may be and 88 the
    // least a SHA-256 one may be. Measured on Git 2.43.0: a 63-byte tag
    // over a real target is `Not a valid object name` and the same tag one
    // byte longer peels; at SHA-256 the edge is 87 and 88. Nothing under
    // the floor could have held the three headers, so nothing the floor
    // refuses is lost.
    tryTargetAt: () => {
        const head = `object ${id}\ntype blob\ntag `
        const least = `${head}t\n`
        assertEq(latin1(least).length, 64)
        assertEq(latin1(`${head}\n`).length, 63)
        assert(tryTargetAt(20)(latin1(least)) !== null)
        assertEq(tryTargetAt(20)(latin1(`${head}\n`)), null)
        // The floor moves with the width: 88 at SHA-256, where the id is
        // 64 hexadecimal digits rather than 40.
        const wide = `object ${'a'.repeat(64)}\ntype blob\ntag `
        assertEq(latin1(`${wide}t\n`).length, 88)
        assert(tryTargetAt(32)(latin1(`${wide}t\n`)) !== null)
        assertEq(tryTargetAt(32)(latin1(`${wide}\n`)), null)
        // A tag that ends at its last header's LF has no message and is the
        // tag Git reads, message or not.
        assertStructurallySame(
            tryTargetAt(20)(latin1(lines.slice(0, 3).join('\n') + '\n')),
            tryTargetAt(20)(latin1(lines.join('\n'))))
        // Past the floor and still no tag: a header block the reader
        // refuses, and a block it reads whose headers are not a tag's.
        assertEq(tryTargetAt(20)(latin1(`${'x'.repeat(70)}\n`)), null)
        assertEq(tryTargetAt(20)(latin1(`object ${id}\ntype commits\ntag v1\n`)), null)
        // And bytes that are no bytes.
        assertEq(tryTargetAt(20)([...latin1(least), 256]), null)
    },
    // Each refusal, one per rule, on a tag the reader reads.
    validate: () => {
        assertStructurallySame(validate20(replaced(0, `type commit`)), ['error', 'no object'])
        assertStructurallySame(validate20(tag(['', ''])), ['error', 'no object'])
        assertStructurallySame(validate20(replaced(0, `object ${id.slice(1)}`)), ['error', 'not an id'])
        assertStructurallySame(validate20(replaced(0, `object ${id.slice(2)}zz`)), ['error', 'not an id'])
        assertStructurallySame(validate20(replaced(1, 'tag v1')), ['error', 'no type'])
        assertStructurallySame(validate20(tag(lines.slice(0, 1).concat(['', '']))), ['error', 'no type'])
        assertStructurallySame(validate20(replaced(1, 'type commits')), ['error', 'unknown type'])
        assertStructurallySame(validate20(replaced(1, 'type Commit')), ['error', 'unknown type'])
        assertStructurallySame(validate20(replaced(2, 'tagger A <a@b> 1 +0000')), ['error', 'no tag name'])
        assertStructurallySame(validate20(replaced(3, 'tagger A <a<b> 1 +0000')), ['error', 'not a tagger'])
        assertStructurallySame(validate20(replaced(3, 'tagger A <a@b> 9223372036854775808 +0000')), ['error', 'not a tagger'])
        // A NUL in any header, the tagger's value or a header after it, is
        // refused before anything else is looked at; one in the message is
        // not a header's.
        assertStructurallySame(validate20(replaced(3, 'tagger A <a@b> 1 +0000\0')), ['error', 'NUL in header'])
        assertStructurallySame(validate20(tag([...lines.slice(0, 4), 'note \0', ...lines.slice(4)])), ['error', 'NUL in header'])
        assertStructurallySame(validate20(tag([...lines.slice(0, 4), 'no\0te x', ...lines.slice(4)])), ['error', 'NUL in header'])
        assertStructurallySame(validate20(tag(['', 'm\0'])), ['error', 'no object'])
        assertStructurallySame(validate20(replaced(5, 'm\0'))[0], 'ok')
    },
    // A tag's name is a ref name, so `validate` asks `fjs/git/refname`
    // whether it is one and reports `bad tag name` where it is not. Which
    // names those are is that module's rule and its proof walks the table;
    // here it is the wiring and the message, one name each way.
    name: () => {
        assertStructurallySame(validate20(replaced(2, 'tag release/1.0'))[0], 'ok')
        assertStructurallySame(validate20(replaced(2, 'tag a..b')), ['error', 'bad tag name'])
        assertStructurallySame(validate20(replaced(3, 'tagger A <a@b> 1 +000')), ['error', 'not a tagger'])
        assertStructurallySame(validate20(replaced(3, 'tagger A')), ['error', 'not a tagger'])
    },
    // The well-known fields panic on a tag `validate` refuses.
    throw: {
        noObject: () => object(tag(['', ''])),
        notAnId: () => object(replaced(0, 'object zz')),
        noType: () => type(tag(lines.slice(0, 1).concat(['', '']))),
        unknownType: () => type(replaced(1, 'type Commit')),
        noName: () => name(replaced(2, 'name v1')),
        notATagger: () => tagger(replaced(3, 'tagger A')),
    },
}
