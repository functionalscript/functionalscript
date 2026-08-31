/**
 * Operations more than one host implements. See [`./types.ts`](./types.ts) for
 * why they are not in `../node`.
 *
 * @module
 *
 * @import { Effect, Func, NotImplemented } from '../types.ts'
 * @import { Console, Read, ReadConsoles, Write, WriteConsoles, _UtfList } from './types.ts'
 * @import { Catch, Import, Sandbox, SandboxResult } from './types.ts'
 */

import { do_, pureOk, resultMapStep, step } from '../module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { toCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { reverse } from '../../types/list/module.f.mjs'
import { error as resultError } from '../../types/result/module.f.mjs'

/**
 * Runs `f` in a sandbox, answering what it returned or threw together with how
 * long it took — a {@link SandboxResult}.
 *
 * The measurement is the operation's, not the caller's: a caller that read a
 * clock either side would time the dispatch as well as the call, and every host
 * would time it differently. The handler brackets the function call with
 * nothing in between.
 *
 * Future parameters (time limit, memory limit) can be added to the payload
 * without breaking the API. Worker-based implementations can enforce hard
 * limits via worker termination.
 *
 * @type {Func<Sandbox>}
 */
export const sandbox = do_('sandbox')

/**
 * Runs a pure thunk, answering `ok(v)` for what it returned and `error(e)` for
 * what it threw. See {@link Catch} for why this is not `sandbox`.
 *
 * @type {Func<Catch>}
 */
export const catch_ = do_('catch')

// import

/**
 * Loads the module at `path` and answers its exports. See {@link Import}.
 *
 * `import_` rather than `import`, which is a keyword.
 *
 * @type {Func<Import>}
 */
export const import_ = do_('import')

// write

/** Emits a `Write` effect to the given named stream. */
/** @type {Func<Write>} */
export const write = do_('write')

/**
 * Encodes `s + '\n'` as UTF-8 and emits a `Write` effect to `stream`.
 * Shared implementation for `log` and `error`.
 *
 * @type {(stream: WriteConsoles) => Console}
 */
const writeString = stream => s =>
    write(stream, utf8(s + '\n'))

/** Writes a line to `stdout`. Replaces the retired `Log` effect. */
/** @type {Console} */
export const log = writeString('stdout')

/** Writes a line to `stderr`. Replaces the retired `Error` effect. */
/** @type {Console} */
export const error = writeString('stderr')

/**
 * Writes an error line to `stderr` and fails with exit code `1`. The canonical
 * "report and give up" ending for a program.
 *
 * **It never succeeds, and the type says so.** `E` is `number` and `T` is
 * `never`, so `step`'s continuation takes a `never` and can never run. That is
 * a continuation nobody reaches, not a compile error: writing one still type-
 * checks, because a function accepting `never` accepts anything. What the type
 * buys is that no *value* can be invented for the success branch, so nothing
 * downstream can proceed as if this had succeeded.
 *
 * **The write's own outcome is deliberately discarded**, which is why this is
 * `resultMapStep` rather than `mapStep`. The program is already failing and
 * the exit code is `1` whether or not `stderr` accepted the bytes; propagating
 * here would hand every caller a "failed to report a failure" branch with no
 * better answer available to it than the one taken here.
 *
 * @type {(s: string) => Effect<Write, never, number>}
 */
export const errorExit = s =>
    resultMapStep(error(s), () => resultError(1))

// read

/** Emits a `Read` effect, yielding the next input byte or `null` at EOF. */
/** @type {Func<Read>} */
export const read = do_('read')

/** @type {(bytes: _UtfList) => string} */
const utf8ListToString = bytes =>
    codePointListToString(toCodePointList(bytes))

/** The line-feed byte (`\n`) that terminates a line. */
const lf = 0x0a

/**
 * Reads bytes from `stream` up to and including the next line feed, and answers
 * the line without it.
 *
 * Reading a single byte per step means a line never over-reads past its
 * terminator, so no leftover-byte buffer has to survive between calls — each
 * `readLine` is self-contained. Yields `null` only at EOF with nothing
 * buffered; a final line lacking a trailing newline is returned in full.
 *
 * Bytes accumulate into a cons-list by prepending (O(1) per byte) and are
 * reversed and decoded once at the terminator, so a large line costs O(n)
 * rather than the O(n²) of copying a growing array on every byte.
 *
 * A failed `read` — a runner without the operation — propagates: the line is
 * not silently truncated into a `null` that a caller would read as EOF.
 *
 * @type {(stream: ReadConsoles) => Effect<Read, string | null, NotImplemented>}
 */
export const readLine = stream => {
    /** @type {(acc: _UtfList) => Effect<Read, string | null, NotImplemented>} */
    const loop = acc =>
        step(
            read(stream),
            (/** @type {number | null} */ b) => b === null
                ? pureOk(acc === null ? null : utf8ListToString(reverse(acc)))
                : b === lf
                    ? pureOk(utf8ListToString(reverse(acc)))
                    : loop({ first: b, tail: acc })
        )
    return loop(null)
}
