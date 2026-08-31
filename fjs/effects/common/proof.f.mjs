/**
 * @import { RunInstance } from '../mock/types.ts'
 * @import { Catch, Import, Module, Read, Sandbox, Write } from './types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { run as mockRun } from '../mock/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { catch_, error, errorExit, import_, log, read, readLine, sandbox, write } from './module.f.mjs'

/**
 * A runner claiming both operations by the names they are declared under.
 *
 * **The names are the interface.** A host does not import these constructors —
 * it receives whatever command they built and looks it up in a map it wrote
 * itself, so `'sandbox'` and `'catch'` are the only thing the two sides agree
 * on. A renamed command is not a type error anywhere; it is an unclaimed
 * command at runtime, in whichever host is unlucky. Interpreting them through a
 * handler map keyed by those strings is what states the agreement.
 *
 * Neither handler actually catches: this file is `.f.mjs` and FunctionalScript
 * has no `try`/`catch`, which is the same bargain `../node/virtual` makes and
 * the reason {@link Catch} exists as an operation rather than as a function.
 * Proving what a *real* handler does with a thrower belongs to the hosts that
 * can write one — `../node/proof.f.mjs` for the node runner,
 * `../../emergent_testing/catch.proof.mjs` for a caught throw.
 *
 * @type {RunInstance<Catch | Sandbox, null>}
 */
const runner = mockRun(/** @type {Parameters<typeof mockRun<Catch | Sandbox, null>>[0]} */ ({
    sandbox: (/** @type {() => unknown} */ f) => (/** @type {null} */ s) => [s, ok(f())],
    catch: (/** @type {() => unknown} */ f) => (/** @type {null} */ s) => [s, ok(ok(f()))],
}))

/**
 * A runner that resolves one module, by the name `import_` builds its command
 * under.
 *
 * The same point the runner above makes, for the operation that most needs it:
 * `import` is dispatched by *two* hosts now — Node resolves the path against a
 * filesystem, a browser page against its document — so the string is an
 * agreement across three parties rather than two, and nothing type-checks it.
 *
 * @type {RunInstance<Import, null>} */
const loader = mockRun(/** @type {Parameters<typeof mockRun<Import, null>>[0]} */ ({
    import: (/** @type {string} */ path) => (/** @type {null} */ s) =>
        [s, ok(/** @type {Module} */ ({ proof: path }))],
}))

/**
 * A runner that writes into a string, tagging each chunk with the stream it
 * went to — the two facts `log` and `error` decide between them.
 *
 * @type {RunInstance<Write, string>} */
const writer = mockRun(/** @type {Parameters<typeof mockRun<Write, string>>[0]} */ ({
    write: (/** @type {'stdout' | 'stderr'} */ stream, /** @type {Vec} */ data) =>
        (/** @type {string} */ w) => [`${w}${stream}:${utf8ToString(data)}`, ok(undefined)],
}))

/**
 * A runner that hands out one byte per `read` and then EOF, which is the whole
 * of what `readLine` composes over.
 *
 * @type {RunInstance<Read, readonly number[]>} */
const reader = mockRun(/** @type {Parameters<typeof mockRun<Read, readonly number[]>>[0]} */ ({
    read: () => (/** @type {readonly number[]} */ input) =>
        input.length === 0
            ? [input, ok(null)]
            : [input.slice(1), ok(input[0])],
}))

/** @type {(s: string) => readonly number[]} */
const bytes = s => toArray(u8List(msb)(utf8(s)))

// Decoded the way `readLine` decodes, rather than through a second
// round-trip: the assertion is about which bytes are left, and a helper that
// re-encoded them would be testing the helper.
/** @type {(b: readonly number[]) => string} */
const text = b => codePointListToString(toCodePointList(b))

export const proof = {
    sandbox: () => {
        const [, r] = runner(null)(sandbox(() => ({ result: ok(42), duration: 7 })))
        assert(r[0] === 'ok', r)
        // Two `Result`s, one inside the other: the operation's own status, and
        // the sandboxed function's outcome carried as data.
        const { result, duration } = r[1]
        assertEq(result[1], 42)
        assertEq(duration, 7)
    },
    catch: () => {
        const [, r] = runner(null)(catch_(() => 'value'))
        assert(r[0] === 'ok', r)
        assertEq(r[1][1], 'value')
    },
    // The path travels to the handler and the module comes back, which is the
    // whole of what this constructor promises. What a *real* loader does with
    // the path is each host's, and is proven where each one lives:
    // `../node/proof.f.mjs` for the filesystem resolution,
    // `../node/virtual/proof.f.mjs` for the in-memory one.
    import: () => {
        const [, r] = loader(null)(import_('a.f.mjs'))
        assert(r[0] === 'ok', r)
        assertEq(r[1].proof, 'a.f.mjs')
    },
    write: {
        // `log` and `error` differ in the stream and in nothing else, and each
        // terminates its own line — a caller that had to add `\n` would
        // eventually forget on the path that matters.
        logGoesToStdout: () => {
            const [w] = writer('')(log('hello'))
            assertEq(w, 'stdout:hello\n')
        },
        errorGoesToStderr: () => {
            const [w] = writer('')(error('nope'))
            assertEq(w, 'stderr:nope\n')
        },
        // The raw operation writes exactly its bytes: no newline, no encoding
        // opinion. That is what lets `text/sgr` build a TTY-aware writer on it.
        rawWritesWhatItIsGiven: () => {
            const [w] = writer('')(write('stdout', utf8('a')))
            assertEq(w, 'stdout:a')
        },
    },
    errorExit: {
        // Reports on `stderr` and fails with `1`. The failure is the point: a
        // caller cannot chain past it, because there is no success value to
        // chain with.
        reportsAndFails: () => {
            const [w, r] = writer('')(errorExit('doomed'))
            assertEq(w, 'stderr:doomed\n')
            assert(r[0] === 'error', r)
            assertEq(r[1], 1)
        },
    },
    readLine: {
        // The terminator is consumed and not returned.
        upToTheLineFeed: () => {
            const [rest, r] = reader(bytes('ab\ncd'))(readLine('stdin'))
            assert(r[0] === 'ok', r)
            assertEq(r[1], 'ab')
            assertEq(text(rest), 'cd')
        },
        // A last line with no terminator is still a line, not a discarded
        // remainder — the difference between reading a file and losing its end.
        eofEndsTheLastLine: () => {
            const [, r] = reader(bytes('tail'))(readLine('stdin'))
            assert(r[0] === 'ok', r)
            assertEq(r[1], 'tail')
        },
        // EOF with nothing buffered is `null`, which is how a caller tells "no
        // more input" from "an empty line".
        eofWithNothingIsNull: () => {
            const [, r] = reader([])(readLine('stdin'))
            assert(r[0] === 'ok', r)
            assertEq(r[1], null)
        },
        // Multi-byte characters survive: bytes accumulate and are decoded once
        // at the terminator, so a code point split across reads is not two
        // replacement characters.
        decodesUtf8: () => {
            const [, r] = reader(bytes('héllo\n'))(readLine('stdin'))
            assert(r[0] === 'ok', r)
            assertEq(r[1], 'héllo')
        },
    },
    read: {
        // The operation under `readLine`: one byte, or `null` at EOF.
        oneByte: () => {
            const [, r] = reader(bytes('x'))(read('stdin'))
            assert(r[0] === 'ok', r)
            assertEq(r[1], 0x78)
        },
    },
}
