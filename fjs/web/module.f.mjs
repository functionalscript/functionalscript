/**
 * A static file server: `fjs web [root] [port]` maps each request path to a
 * file under `root` and answers with its bytes.
 *
 * The module is split so that the decision is pure and the socket handling is a
 * thin shell around it. `resolve` turns a URL into a path and does every check
 * that can be made without touching the disk; `respond` reads the file that
 * path names and builds the response frame, performing IO but no networking;
 * `main` is the only part that creates a server, listens, and blocks. That is
 * why `respond` can be proven end to end against an in-memory file system.
 *
 * ## Responses
 *
 * | case                                          | status |
 * |-----------------------------------------------|--------|
 * | file found                                     | `200`  |
 * | `GET`/`HEAD` on a missing path                 | `404`  |
 * | any other method                               | `405`  |
 * | a path that escapes `root`, or an undecodable URL | `400`  |
 * | a file larger than one `Vec`                   | `413`  |
 * | any other host failure                         | `500`  |
 *
 * Failures carry a `text/plain` body. Nothing else is configurable in this
 * version — no directory listing, no range requests, no compression, no caching
 * headers, no TLS.
 *
 * See `./README.md` for what is deliberately absent, and `./types.ts` for the
 * type-level API.
 *
 * @module
 *
 * @import { Effect } from '../effects/types.ts'
 * @import { FileStat, IoChannel, Program, ReadFile, ServerResponse } from '../effects/node/types.ts'
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { Resolve, Respond, WebOp } from './types.ts'
 */

import { pureError, pureOk, resultMapStep, step } from '../effects/module.f.mjs'
import {
    createServer, errorExit, errorSummary, exitStep, forever, isNotFound, listen, log, readFile,
    stat,
} from '../effects/node/module.f.mjs'
import { detectPath } from '../media/type/module.f.mjs'
import { join, parse } from '../path/module.f.mjs'
import { isValidCodePoint } from '../text/code_point/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { fromCodePointList, toCodePointList } from '../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../text/utf16/module.f.mjs'
import { maxLengthBytes } from '../types/bit_vec/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'

// ── Routing ───────────────────────────────────────────────────────────────────

/** @type {string} */
const hexDigits = '0123456789abcdef'

/** The value of one hexadecimal digit, or `-1` for anything else.
 *
 * @type {(c: string) => number}
 */
const hexDigit = c => hexDigits.indexOf(c.toLowerCase())

/** The UTF-8 bytes of `s`.
 *
 * @type {(s: string) => readonly number[]}
 */
const utf8Bytes = s => toArray(fromCodePointList(stringToCodePointList(s)))

/** Reads `bytes` back as a string, or `null` if they are not valid UTF-8.
 *
 * @type {(bytes: readonly number[]) => Nullable<string>}
 */
const utf8String = bytes => {
    const codePoints = toArray(toCodePointList(bytes))
    for (const c of codePoints) {
        if (!isValidCodePoint(c)) { return null }
    }
    return codePointListToString(codePoints)
}

/**
 * Percent-decodes `s`: each `%XX` becomes the byte it names, every other
 * character contributes its own UTF-8 bytes, and the whole byte sequence is
 * then read back as UTF-8 — so `%D0%9F` is one letter rather than two mangled
 * ones. Decoding per escape could not do that: a multi-byte character arrives
 * as several escapes, and no one of them is a character on its own.
 *
 * `null` when an escape is not two hexadecimal digits, or when the bytes they
 * spell are not valid UTF-8.
 *
 * @type {(s: string) => Nullable<string>}
 */
const percentDecode = s => {
    const [literal, ...escaped] = s.split('%')
    let bytes = utf8Bytes(literal)
    for (const part of escaped) {
        if (part.length < 2) { return null }
        const high = hexDigit(part.charAt(0))
        const low = hexDigit(part.charAt(1))
        if (high < 0 || low < 0) { return null }
        bytes = [...bytes, high * 16 + low, ...utf8Bytes(part.slice(2))]
    }
    return utf8String(bytes)
}

/**
 * The path component of `url`: everything before the first `?` or `#`.
 *
 * Node hands a listener the request target, which never carries a fragment —
 * a client keeps that to itself — but a `respond` called directly might be
 * given one, and dropping it here costs one `split`.
 *
 * @type {(url: string) => string}
 */
const urlPath = url => {
    const [beforeFragment] = url.split('#')
    const [path] = beforeFragment.split('?')
    return path
}

/**
 * Maps a request URL to a path under `root`, or explains why none exists.
 *
 * A directory request — a path ending in `/`, including the bare `/` — is
 * answered with its `index.html`, which is what makes a generated site browsable
 * at all.
 *
 * **Traversal is rejected in segment space, not by string comparison.**
 * `parse` collapses `.` and `..` the way the file system would, so `..` can only
 * survive it by pointing above the root; that is the whole check. Comparing the
 * joined path against `root` textually would be the weaker test, and it cannot
 * even be written here: `normalize` drops a leading empty segment, so an
 * absolute root would come back relative.
 *
 * @type {Resolve}
 */
export const resolve = root => url => {
    const path = urlPath(url)
    const decoded = percentDecode(path)
    if (decoded === null) { return error('malformed request URL') }
    const segments = parse(decoded)
    if (segments.includes('..')) { return error('request path escapes the served root') }
    const isDirectory = segments.length === 0 || decoded.endsWith('/')
    return ok(join(root, ...(isDirectory ? [...segments, 'index.html'] : segments)))
}

// ── Answering ─────────────────────────────────────────────────────────────────

/**
 * A file too large to answer with. `readFile` yields a single `Vec`, so this is
 * a limit of the effect rather than a policy: see the README.
 *
 * @typedef {readonly['tooLarge', number]} _TooLarge
 */

/** @type {(size: number) => _TooLarge} */
const tooLarge = size => ['tooLarge', size]

/** @type {(status: number) => (message: string) => ServerResponse} */
const plainText = status => message => ({
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: utf8(`${message}\n`),
})

/**
 * Reads `path`, but only after `stat` says it fits in one `Vec` — the size is
 * checked first so an oversized file fails loudly instead of being truncated.
 *
 * @type {(path: string) => (s: FileStat) => Effect<ReadFile, Vec, IoChannel | _TooLarge>}
 */
const readBounded = path => ({ size }) =>
    BigInt(size) > maxLengthBytes ? pureError(tooLarge(size)) : readFile(path)

/**
 * The response frame for whatever reading `path` produced. This is where the
 * error channel ends: every failure becomes a status code, which is what lets
 * a `RequestListener` declare `never`.
 *
 * @type {(path: string) => (r: Result<Vec, IoChannel | _TooLarge>) => ServerResponse}
 */
const fileResponse = path => r => {
    if (r[0] === 'ok') {
        return { status: 200, headers: { 'content-type': detectPath(path) }, body: r[1] }
    }
    const e = r[1]
    if (e[0] === 'tooLarge') {
        return plainText(413)(`file is ${e[1]} bytes; this server cannot answer with more than ${maxLengthBytes}`)
    }
    if (isNotFound(e)) { return plainText(404)('not found') }
    // `errorSummary`, not `errorMessage`: the host puts the absolute path it
    // could not read into the message, and a client is not entitled to the
    // server's filesystem layout.
    return plainText(500)(errorSummary(e))
}

/**
 * Answers one request: resolve, read, and frame the result.
 *
 * `HEAD` is answered exactly like `GET`, bytes included. Node omits the body of
 * a `HEAD` response itself and keeps the headers it was given, so answering the
 * two alike is what makes `Content-Length` right rather than a special case
 * that would have to compute it.
 *
 * @type {Respond}
 */
export const respond = root => ({ method, url }) => {
    if (method !== 'GET' && method !== 'HEAD') {
        return pureOk(plainText(405)('only GET and HEAD are supported'))
    }
    const resolved = resolve(root)(url)
    if (resolved[0] === 'error') { return pureOk(plainText(400)(resolved[1])) }
    const path = resolved[1]
    const bytes = step(stat(path), readBounded(path))
    return resultMapStep(bytes, r => ok(fileResponse(path)(r)))
}

// ── The program ───────────────────────────────────────────────────────────────

/** @type {number} */
const maxPort = 0xffff

/**
 * `fjs web [root] [port]` — serve `root` (default `.`) on `port` (default
 * `8080`).
 *
 * Both arguments are positional because `fjs/cli` has no notion of a named
 * option yet; `port` becomes `--port` once one exists.
 *
 * The chain ends in `forever`, so the program only stops when the process does.
 * A runner that cannot block forever answers `notImplemented` there, which is
 * how the whole program remains runnable — and observable — under the virtual
 * runner.
 *
 * @type {Program<WebOp>}
 */
export const main = ({ args }) => {
    const [root = '.', portArgument = '8080'] = args
    const port = Number(portArgument)
    if (!Number.isInteger(port) || port < 0 || port > maxPort) {
        return errorExit(`invalid port "${portArgument}"`)
    }
    const server = createServer(respond(root))
    const listening = step(server, s => listen(s, port))
    const announced = step(listening, () => log(`serving ${root} on http://localhost:${port}/`))
    const ended = step(announced, forever)
    return exitStep(ended)
}
