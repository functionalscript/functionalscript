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
 * | `GET`/`HEAD` on a missing, dot-prefixed, or non-regular path, or one descending through a file | `404` |
 * | any other method                               | `405` with `Allow` |
 * | a `Host` this server does not answer for       | `403`  |
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
 * @import { FileStat, IoChannel, Program, ReadFile, ServerResponse, Stat } from '../effects/node/types.ts'
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { Refusal, Resolve, Respond, WebOp } from './types.ts'
 */

import { pureError, pureOk, resultMapStep, resultStep, step } from '../effects/module.f.mjs'
import {
    createServer, errorExit, errorMessage, errorSummary, exitStep, forever, isNotFound, listen, log,
    readFile, stat,
} from '../effects/node/module.f.mjs'
import { detectPath } from '../media/type/module.f.mjs'
import { escapes, join, parse } from '../path/module.f.mjs'
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
 * Whether `part` — a piece of a target split on `%` — opens with two hexadecimal
 * digits, which is what makes it an escape rather than a mistake.
 *
 * @type {(part: string) => boolean}
 */
const isEscape = part =>
    part.length >= 2 && hexDigit(part.charAt(0)) >= 0 && hexDigit(part.charAt(1)) >= 0

/**
 * The bytes one escape contributes: the byte it names, then whatever plain text
 * followed it. Total, because {@link isEscape} has already vouched for the part.
 *
 * @type {(part: string) => readonly number[]}
 */
const escapeBytes = part =>
    [hexDigit(part.charAt(0)) * 16 + hexDigit(part.charAt(1)), ...utf8Bytes(part.slice(2))]

/**
 * Percent-decodes `s`: each `%XX` becomes the byte it names, every other
 * character contributes its own UTF-8 bytes, and the whole byte sequence is
 * then read back as UTF-8 — so `%D0%9F` is one letter rather than two mangled
 * ones. Decoding per escape could not do that: a multi-byte character arrives
 * as several escapes, and no one of them is a character on its own.
 *
 * Validating every escape *before* decoding any is what keeps this linear.
 * Growing one byte array per escape — `[...bytes, byte, ...rest]` — copies
 * everything decoded so far on every escape, which is quadratic in the number of
 * escapes: a 15 KB target of 5,000 escapes fits under Node's header limit and
 * cost about 140 ms of event loop, per request, to reach whatever answer it was
 * always going to get. Two linear passes cost one.
 *
 * `null` when an escape is not two hexadecimal digits, or when the bytes they
 * spell are not valid UTF-8.
 *
 * @type {(s: string) => Nullable<string>}
 */
const percentDecode = s => {
    const [literal, ...escaped] = s.split('%')
    if (!escaped.every(isEscape)) { return null }
    return utf8String([...utf8Bytes(literal), ...escaped.flatMap(escapeBytes)])
}

/** What separates a scheme from the authority that follows it.
 *
 * @type {string}
 */
const schemeMark = '://'

/** The schemes an absolute-form target may name.
 *
 * @type {readonly string[]}
 */
const schemes = ['http', 'https']

/** What separates a credential from the host it was offered to.
 *
 * @type {string}
 */
const userInfoMark = '@'

/** What separates a host from its port.
 *
 * @type {string}
 */
const portMark = ':'

/**
 * Reads a request target, or `null` if it is not one this server can act on.
 *
 * Two forms reach an origin server. **Origin-form** (`/main.css?v=2`) is what a
 * browser sends, and its path is the whole target. **Absolute-form**
 * (`http://host/main.css`) is what a client sends to a proxy — RFC 9112 §3.2.2
 * requires an origin server to accept it anyway, and to take the host from *it*
 * rather than from the `Host` header, which is why the authority comes back
 * here instead of being discarded. Treating it as a path was the bug this
 * replaces: `http://host/main.css` resolved to a file named `http:` with `host`
 * inside it, and answered `404` for the wrong reason.
 *
 * Anything else — the asterisk-form `*`, an authority-form `host:port` from a
 * `CONNECT`, an empty target, an authority carrying userinfo — names nothing
 * this server serves.
 *
 * The fragment is stripped although a client keeps it to itself; a `respond`
 * called directly might still be given one, and it costs one `split`.
 *
 * @type {(target: string) => Nullable<{ readonly authority: Nullable<string>, readonly path: string }>}
 */
const parseTarget = target => {
    const [beforeFragment] = target.split('#')
    const [withoutQuery] = beforeFragment.split('?')
    if (withoutQuery.startsWith('/')) { return { authority: null, path: withoutQuery } }
    const mark = withoutQuery.indexOf(schemeMark)
    // A scheme is not "whatever precedes `://`": `://localhost/x` and
    // `1://localhost/x` are malformed targets, and reading them as absolute-form
    // served the file for a request that names no scheme at all. This server
    // speaks two, so it accepts two.
    if (mark < 0 || !schemes.includes(withoutQuery.slice(0, mark).toLowerCase())) { return null }
    const afterScheme = withoutQuery.slice(mark + schemeMark.length)
    const slash = afterScheme.indexOf('/')
    const authority = slash < 0 ? afterScheme : afterScheme.slice(0, slash)
    // Userinfo names a credential, not a host, and an authority carrying one
    // reads as a different host depending on which end you start from — which
    // is what makes it worth refusing outright rather than parsing past.
    if (authority.includes(userInfoMark)) { return null }
    // An `http` URI with an **empty host** is one RFC 9110 §4.2.1 says a
    // recipient must reject as invalid, and the reason is visible here:
    // `http:///index.html` reads as an empty authority and the path
    // `/index.html` to this parser, and as the host `index.html` and the path
    // `/` to a URL parser. Two readings, neither of them the client's, so
    // neither is answered. `http://:80/x` is the same target wearing a port,
    // and `new URL` refuses that one outright.
    if (authority === '' || authority.startsWith(portMark)) { return null }
    return { authority, path: slash < 0 ? '/' : afterScheme.slice(slash) }
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
 * `escapes` folds the path with its root taken off, so a `..` with nothing left
 * to cancel survives to be counted; that is the whole check. `parse` cannot
 * answer it — `parse` folds *with* the root in place, and clamping away such a
 * `..` is precisely what it does, which is why reading its output for one
 * silently stopped working. Nor is taking the root off the same as dropping a
 * leading `/`: the remainder of `///../x` is `//../x`, which reads as rooted
 * again, so the question belongs to `fjs/path` rather than to string surgery
 * here. Comparing the joined path against `root` textually is the weaker test;
 * it became expressible once `normalize` began keeping roots, and is still not
 * what is done.
 *
 * @type {Resolve}
 */
export const resolve = root => url => {
    const base = served(root)
    const target = parseTarget(url)
    if (target === null) { return refuse(400)('malformed request URL') }
    const decoded = percentDecode(target.path)
    if (decoded === null || decoded.includes(nul)) { return refuse(400)('malformed request URL') }
    const segments = parse(decoded)
    // `escapes`, not a `..` among `segments` — see the traversal note above.
    // `/a/../b` collapses and is served; `/../b` escapes and is not.
    if (escapes(decoded)) { return refuse(400)('request path escapes the served root') }
    if (segments.some(isHidden)) { return refuse(404)('not found') }
    const isDirectory = segments.length === 0 || decoded.endsWith('/')
    return ok(join(base, ...(isDirectory ? [...segments, 'index.html'] : segments)))
}

// ── Answering ─────────────────────────────────────────────────────────────────

/**
 * A file too large to answer with. `readFile` yields a single `Vec`, so this is
 * a limit of the effect rather than a policy: see the README.
 *
 * @type {(size: number) => readonly['tooLarge', number]}
 */
const tooLarge = size => ['tooLarge', size]

/**
 * An entry that is not a regular file — a FIFO, a device, a socket. It exists,
 * so this is not a missing path, and it is not something this server will read.
 *
 * @type {readonly['notRegular']}
 */
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
 * The names this server will answer *for*, which is not the same question as
 * what it binds.
 *
 * Binding loopback stops another machine from reaching the socket; it does not
 * stop a browser on this one from being *told* that a name the attacker owns
 * lives at `127.0.0.1`. That is DNS rebinding: a page from `attacker.example`
 * whose DNS answer flips to loopback, and whose fetches then arrive here
 * carrying `Host: attacker.example`. Served, the browser files the response
 * under the attacker's origin and hands the working tree to their JavaScript.
 * The request looks ordinary at every layer below this one — right socket,
 * right port, real client — and the `Host` header is the only place the lie is
 * written down.
 *
 * @type {readonly string[]}
 */
const servedHosts = ['localhost', '127.0.0.1', '[::1]']

/**
 * The largest port a number names — the one an authority may carry, and the one
 * `main` may bind.
 *
 * @type {number}
 */
const maxPort = 0xffff

/** Whether `s` is a decimal number, and a non-empty one.
 *
 * @type {(s: string) => boolean}
 */
const isDigits = s => s !== '' && [...s].every(c => c >= '0' && c <= '9')

/**
 * Whether `s` names a port.
 *
 * Digits **in range**: `65536` is a number and not a port, and a URL parser
 * agrees — `new URL('http://localhost:65536/')` throws where
 * `http://localhost:8099/` does not. The digits are read as a number rather
 * than counted, because a parser reads `00008099` as `8099` and a length test
 * would not. Past what a number can hold the read is `Infinity`, which is out
 * of range like every other value that large.
 *
 * @type {(s: string) => boolean}
 */
const isPort = s => isDigits(s) && Number(s) <= maxPort

/** Whether what follows a host name is nothing, or a port.
 *
 * @type {(rest: string) => boolean}
 */
const isPortSuffix = rest =>
    rest === '' || (rest.startsWith(portMark) && isPort(rest.slice(portMark.length)))

/**
 * The name an authority names, or `null` if it does not name one.
 *
 * Lower case, because a host name is case-insensitive and `LOCALHOST` is not a
 * different machine. Without a trailing root dot, because `localhost.` is not
 * one either.
 *
 * **And nothing after the name is discarded.** Reading the prefix and dropping
 * the rest made `localhost:bad`, `localhost:8080:999` and `[::1]evil` all read
 * as names this server answers for — a check that ignores what it does not
 * understand is not a check. What may follow a name is a port and nothing else;
 * an IPv6 literal is bracketed, and its brackets are part of the name.
 *
 * @type {(host: string) => Nullable<string>}
 */
const hostName = host => {
    const lower = host.toLowerCase()
    if (lower.startsWith('[')) {
        const end = lower.indexOf(']')
        if (end < 0 || !isPortSuffix(lower.slice(end + 1))) { return null }
        return lower.slice(0, end + 1)
    }
    const colon = lower.indexOf(':')
    if (colon >= 0 && !isPortSuffix(lower.slice(colon))) { return null }
    const name = colon < 0 ? lower : lower.slice(0, colon)
    return name.endsWith('.') ? name.slice(0, -1) : name
}

/**
 * Whether this server answers for `host`.
 *
 * An absent `Host` is not served: HTTP/1.1 requires one, every browser sends
 * one, and accepting the absence would leave the check with a hole shaped
 * exactly like a client that omits it deliberately.
 *
 * Neither is one carrying **userinfo**. `127.0.0.1:8080@attacker.example` is an
 * authority whose host is `attacker.example` — the part before the `@` is a
 * credential, not a name — and reading it left-to-right finds a loopback
 * address that was never the host at all. RFC 9110 §4.2.4 deprecates userinfo in
 * an `http` URI and says a sender must not generate one, so refusing is both
 * correct and the only reading that cannot be walked backwards into.
 *
 * @type {(host: string | undefined) => boolean}
 */
const isServedHost = host => {
    if (host === undefined || host.includes(userInfoMark)) { return false }
    const name = hostName(host)
    return name !== null && servedHosts.includes(name)
}

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
 * @type {(path: string) => (s: FileStat) => Effect<ReadFile, Vec, IoChannel | readonly['tooLarge', number] | readonly['notRegular']>}
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
 * @type {(path: string) => (r: Result<Vec, IoChannel | readonly['tooLarge', number] | readonly['notRegular']>) => ServerResponse}
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
 * What a POSIX host reports for a path that descends through a name which is
 * not a directory — `GET /README.md/`, whose `index.html` is under a regular
 * file. Windows reports `ENOENT` for the same request, so this is the one
 * request whose status differed by host.
 *
 * @type {string}
 */
const notDirectory = 'ENOTDIR'

/**
 * Whether `s` describes a directory this server can serve from. A `stat` that
 * failed describes nothing, and `isFile === false` is not the question:
 * a FIFO, a device and a socket answer that too.
 *
 * @type {(s: Result<FileStat, IoChannel>) => boolean}
 */
const isServableRoot = s => s[0] === 'ok' && s[1].isDirectory

/**
 * The response frame for whatever reading `path` produced — {@link fileResponse}
 * for every case but one, and that one is why this is an effect rather than a
 * function.
 *
 * **`ENOTDIR` is `404`.** A path that descends through a regular file names
 * nothing, which is client-caused in exactly the way a missing name is, so it
 * belongs with the `404` answers rather than in the channel reserved for the
 * host failing at something it should have managed. It is also a disclosure
 * while it is a `500`: `/README.md/` and `/nope.md/` answer differently, which
 * is precisely the enumeration the identical `404`s elsewhere are written to
 * deny.
 *
 * **Unless the root itself is the non-directory**, which is why the answer
 * cannot be read off the error alone. `fjs web README.md` makes *every* request
 * stat a path descending through a file, and answering `404` to all of them
 * would tell a visitor the file is missing and the operator nothing at all.
 * {@link main} refuses such a root at startup, but a root replaced while the
 * server runs would otherwise turn one operator mistake into a lie told to
 * every visitor for the life of the process — so the root is re-checked here,
 * and only a root that is still a directory earns the `404`.
 *
 * The re-check costs a `stat` on the `ENOTDIR` path and nothing on any other,
 * and what it leaves is the request-local race
 * [stat-then-read](./todo/stat-then-read.md) already describes: a wrong status
 * in a vanishing window rather than a wrong status forever.
 *
 * @type {(root: string) => (path: string) => (r: Result<Vec, IoChannel | readonly['tooLarge', number] | readonly['notRegular']>) => Effect<Stat, ServerResponse, never>}
 */
const answer = root => path => r => {
    const hostAnswer = fileResponse(path)(r)
    /** @type {Effect<Stat, ServerResponse, never>} */
    const framed = r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === notDirectory
        ? resultMapStep(stat(served(root)), s =>
            ok(isServableRoot(s) ? plainText(404)('not found') : hostAnswer))
        : pureOk(hostAnswer)
    return framed
}

/**
 * Answers one request: resolve, read, and frame the result.
 *
 * The host is checked first, against the loopback names this server answers for
 * — see {@link servedHosts} for why binding loopback is not enough on its own.
 * An absolute-form target names its own host, and RFC 9112 §3.2.2 says to
 * believe that over the `Host` header.
 *
 * `HEAD` is answered exactly like `GET`, bytes included: Node drops the body of
 * a `HEAD` response itself and keeps the headers, so the one frame serves both
 * — and because {@link response} states `Content-Length`, a `HEAD` client still
 * learns the size it asked for.
 *
 * @type {Respond}
 */
export const respond = root => ({ method, url, headers }) => {
    // Before anything else, including what method it is: a request for a name
    // this server does not answer for is not a request to be interpreted.
    //
    // An absolute-form target carries the name itself, and RFC 9112 §3.2.2 says
    // an origin server must believe *it* over the `Host` header — a proxy
    // rewrites one and not the other, so the target is the one the client meant.
    const target = parseTarget(url)
    const host = target === null || target.authority === null ? headers.host : target.authority
    if (!isServedHost(host)) { return pureOk(plainText(403)('host not served')) }
    if (method !== 'GET' && method !== 'HEAD') { return pureOk(methodNotAllowed()) }
    const resolved = resolve(root)(url)
    if (resolved[0] === 'error') {
        const { status, message } = resolved[1]
        return pureOk(plainText(status)(message))
    }
    const path = resolved[1]
    const bytes = step(stat(path), readBounded(path))
    // `resultStep`, not `resultMapStep`: framing the result is pure for every
    // case but `ENOTDIR`, which asks the file system one more question — see
    // {@link answer}.
    return resultStep(bytes, answer(root)(path))
}

// ── The program ───────────────────────────────────────────────────────────────

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
 * **The root is checked before the socket is.** A root that is not a directory
 * — a mistyped name, or `fjs web README.md` — is a command-line mistake, and it
 * is reported like the port's: on `stderr`, with exit code `1`, at the moment it
 * was made rather than on some visitor's request. Without it the mistake is
 * silent until then, and differently silent per host: a POSIX `stat` under such
 * a root fails `ENOTDIR` and answered `500` to everything, while Windows reports
 * `ENOENT` and answered `404` to everything.
 *
 * It stats {@link served}`(root)`, never the argument as written: `fjs web ''`
 * is a supported invocation naming the working directory, and `stat('')` fails
 * `ENOENT` on every host.
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
    const base = served(root)
    const server = createServer(respond(root))
    const listening = step(server, s => listen(s, port, loopback))
    const announced = step(listening, () => log(`serving ${base} on http://${loopback}:${port}/`))
    const ended = step(announced, forever)
    return resultStep(stat(base), s => {
        // Bound rather than returned inline, for the reason `exitStep` binds
        // its own: the branches are two different `Effect`s and `step` would
        // infer neither from the union.
        //
        // `errorMessage`, not `errorSummary`: this line is for the operator who
        // typed the argument, and the host's own words name what it could not
        // stat. A client is the one that is not entitled to that.
        const reason = s[0] === 'error' ? errorMessage(s[1]) : 'not a directory'
        /** @type {Effect<WebOp, 0, number>} */
        const program = isServableRoot(s)
            ? exitStep(ended)
            : errorExit(`invalid root "${base}": ${reason}`)
        return program
    })
}
