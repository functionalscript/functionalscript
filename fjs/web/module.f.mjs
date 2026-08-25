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
 * | `GET`/`HEAD` on a missing, dot-prefixed, or non-regular path | `404` |
 * | any other method                               | `405` with `Allow` |
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
 * @import { Refusal, Resolve, Respond, WebOp } from './types.ts'
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
import { length, maxLengthBytes } from '../types/bit_vec/module.f.mjs'
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

/** The one character no file system path can carry.
 *
 * @type {string}
 */
const nul = '\u0000'

/** Whether `segment` is one a client is not shown.
 *
 * @type {(segment: string) => boolean}
 */
const isHidden = segment => segment.startsWith('.')

/** @type {(status: number) => (message: string) => Result<never, Refusal>} */
const refuse = status => message => error({ status, message })

/**
 * The directory a `root` argument names.
 *
 * An **empty** `root` is the working directory, not the file system root.
 * `join('', 'etc')` is `/etc` — a leading empty segment reads as absolute — so
 * without this, `fjs web ''` would serve `/etc/passwd` on request. The
 * argument's default cannot catch it: a destructuring default replaces
 * `undefined`, and `''` is a value the caller passed.
 *
 * @type {(root: string) => string}
 */
const served = root => root === '' ? '.' : root

/**
 * Maps a request URL to a path under `root`, or explains why none exists.
 *
 * A directory request — a path ending in `/`, including the bare `/` — is
 * answered with its `index.html`, which is what makes a generated site browsable
 * at all.
 *
 * An empty `root` is read as the working directory — see {@link served}.
 *
 * **Dot-prefixed segments are not served.** `.git/config`, `.env` and
 * `.ssh/id_rsa` are the files whose exposure the loopback binding exists to
 * prevent, and a static server that hands them to anyone who asks has the
 * boundary in the wrong place. The answer is `404` rather than `403`: whether
 * such a file exists is itself the thing not being disclosed.
 *
 * **A NUL is a malformed URL, not a host error.** `%00` decodes to a byte no
 * path can contain; left to the file system it comes back as an
 * `ERR_INVALID_ARG_VALUE` and a `500`, reporting a host failure for what is
 * plainly a bad request.
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
    const base = served(root)
    const path = urlPath(url)
    const decoded = percentDecode(path)
    if (decoded === null || decoded.includes(nul)) { return refuse(400)('malformed request URL') }
    const segments = parse(decoded)
    if (segments.includes('..')) { return refuse(400)('request path escapes the served root') }
    if (segments.some(isHidden)) { return refuse(404)('not found') }
    const isDirectory = segments.length === 0 || decoded.endsWith('/')
    return ok(join(base, ...(isDirectory ? [...segments, 'index.html'] : segments)))
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

/**
 * An entry that is not a regular file — a FIFO, a device, a socket. It exists,
 * so this is not a missing path, and it is not something this server will read.
 *
 * @typedef {readonly['notRegular']} _NotRegular
 */

/** @type {_NotRegular} */
const notRegular = ['notRegular']

/**
 * A response frame carrying `body`, with its length declared.
 *
 * `Content-Length` is written here rather than left to the runner, because the
 * runner does not write one: Node sends an unmeasured body with
 * `Transfer-Encoding: chunked`, and for a `HEAD` request — where it drops the
 * body but keeps these headers — that leaves the client with neither the bytes
 * nor their count, which is the one thing a `HEAD` is asked for.
 *
 * @type {(status: number) => (contentType: string) => (body: Vec) => ServerResponse}
 */
const response = status => contentType => body => ({
    status,
    headers: {
        'content-type': contentType,
        'content-length': `${length(body) >> 3n}`,
        // The `Content-Type` above is derived from a file name, and a browser
        // that sniffs past it decides for itself what a served file is — which
        // is the one thing this server has already answered.
        'x-content-type-options': 'nosniff',
    },
    body,
})

/** @type {(status: number) => (message: string) => ServerResponse} */
const plainText = status => message =>
    response(status)('text/plain; charset=utf-8')(utf8(`${message}\n`))

/** The methods this server answers.
 *
 * @type {string}
 */
const allow = 'GET, HEAD'

/**
 * `405`, carrying the `Allow` header the status may not omit: a refusal that
 * does not say what *would* be accepted leaves the client to guess, which is
 * why RFC 9110 requires an origin server to list them here.
 *
 * @type {() => ServerResponse}
 */
const methodNotAllowed = () => {
    const answer = plainText(405)('only GET and HEAD are supported')
    return { ...answer, headers: { ...answer.headers, allow } }
}

/**
 * Reads `path`, but only once `stat` has said it is a regular file that fits in
 * one `Vec`.
 *
 * Both questions are asked before the read, and neither is optional. An
 * oversized file must fail loudly rather than be truncated. A **non-regular**
 * entry must not be read at all: `open` on a FIFO with no writer blocks until
 * one appears, so the read would never return and would hold a thread-pool slot
 * while it waited — a served tree with one FIFO in it, and a handful of requests
 * stall every other response. Size cannot stand in for that check, because a
 * FIFO stats as zero bytes and passes every bound.
 *
 * @type {(path: string) => (s: FileStat) => Effect<ReadFile, Vec, IoChannel | _TooLarge | _NotRegular>}
 */
const readBounded = path => ({ size, isFile }) => {
    if (!isFile) { return pureError(notRegular) }
    return BigInt(size) > maxLengthBytes ? pureError(tooLarge(size)) : readFile(path)
}

/**
 * The response frame for whatever reading `path` produced. This is where the
 * error channel ends: every failure becomes a status code, which is what lets
 * a `RequestListener` declare `never`.
 *
 * @type {(path: string) => (r: Result<Vec, IoChannel | _TooLarge | _NotRegular>) => ServerResponse}
 */
const fileResponse = path => r => {
    if (r[0] === 'ok') { return response(200)(detectPath(path))(r[1]) }
    const e = r[1]
    // A name that is not a regular file is answered as absent, for the reason a
    // dot-prefixed one is: what it *is* would be a disclosure of its own.
    if (e[0] === 'notRegular') { return plainText(404)('not found') }
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
 * `HEAD` is answered exactly like `GET`, bytes included: Node drops the body of
 * a `HEAD` response itself and keeps the headers, so the one frame serves both
 * — and because {@link response} states `Content-Length`, a `HEAD` client still
 * learns the size it asked for.
 *
 * @type {Respond}
 */
export const respond = root => ({ method, url }) => {
    if (method !== 'GET' && method !== 'HEAD') { return pureOk(methodNotAllowed()) }
    const resolved = resolve(root)(url)
    if (resolved[0] === 'error') {
        const { status, message } = resolved[1]
        return pureOk(plainText(status)(message))
    }
    const path = resolved[1]
    const bytes = step(stat(path), readBounded(path))
    return resultMapStep(bytes, r => ok(fileResponse(path)(r)))
}

// ── The program ───────────────────────────────────────────────────────────────

/** @type {number} */
const maxPort = 0xffff

/**
 * The address the server binds.
 *
 * Loopback, not the unspecified address: this serves whatever directory it was
 * pointed at, which is `.` by default, so binding every interface would publish
 * a working tree — sources, keys, a `.env` — to the whole network because the
 * operator typed two words. Reaching it from another machine is a decision, and
 * it waits for `--host` to be a thing one can write.
 *
 * @type {string}
 */
const loopback = '127.0.0.1'

/**
 * `fjs web [root] [port]` — serve `root` (default `.`) on `port` (default
 * `8080`), bound to {@link loopback}.
 *
 * Both arguments are positional because `fjs/cli` has no notion of a named
 * option yet; `port` becomes `--port` once one exists, and `--host` is what
 * would let a caller bind anything but loopback.
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
    // `0` is excluded with the out-of-range values: Node reads it as "any free
    // port", and the program has no way to ask which one it got, so the URL it
    // prints would name a port nothing is listening on.
    if (!Number.isInteger(port) || port < 1 || port > maxPort) {
        return errorExit(`invalid port "${portArgument}"`)
    }
    const server = createServer(respond(root))
    const listening = step(server, s => listen(s, port, loopback))
    const announced = step(listening, () => log(`serving ${served(root)} on http://${loopback}:${port}/`))
    const ended = step(announced, forever)
    return exitStep(ended)
}
