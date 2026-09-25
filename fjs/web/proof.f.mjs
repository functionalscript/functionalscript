/**
 * @import { Effect } from '../effects/types.ts'
 * @import { Handle, IncomingMessage, IoChannel, NodeOp } from '../effects/node/types.ts'
 * @import { List } from '../effects/list/types.ts'
 * @import { Dir, RecordedResponse, State } from '../effects/node/virtual/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { createServer, exitCode, listen, readBytes } from '../effects/node/module.f.mjs'
import { emptyState, nodeProgramOptions, virtual } from '../effects/node/virtual/module.f.mjs'
import { nodeCommands } from '../effects/node/module.f.mjs'
import { partialRun } from '../effects/mock/module.f.mjs'
import { step } from '../effects/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty, length, u8ListMsb, u8ListToVecMsb } from '../types/bit_vec/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { ok, unwrap } from '../types/result/module.f.mjs'
import { asNominal } from '../types/nominal/module.f.mjs'
import { main, resolve, respond } from './module.f.mjs'

/** @type {string} */
const page = '<h1>hi</h1>'

/** A file system with a page at the root and one in a subdirectory.
 *
 * @type {Dir}
 */
const site = {
    'index.html': [utf8(page)],
    'main.css': [utf8('body {}')],
    docs: { 'index.html': [utf8('docs')] },
}

/** A request as a browser on this machine sends it, `Host` included.
 *
 * @type {(method: string, url: string) => IncomingMessage}
 */
const request = (method, url) => hosted('127.0.0.1:8080')(method, url)

/**
 * `chunkedResponse` is what an HTTP/1.1 request gets, which is what a browser
 * sends; it is the runner's answer and a listener only ever reads it.
 *
 * @type {(host: string) => (method: string, url: string) => IncomingMessage}
 */
const hosted = host => (method, url) =>
    ({ method, url, headers: { host }, body: empty, chunkedResponse: true })

/**
 * Answers one request against `root` **through the virtual server**, which every
 * case below is a variation of.
 *
 * Through `listen` rather than by calling `respond` directly, and that is the
 * point: the body is a lazy list now, so a proof that read the frame and stopped
 * would assert about a response no byte of which had been produced. `listen` runs
 * the same gates and the same pump the Node runner does, and then runs `release`
 * — so **every case here also checks that nothing was left open**, which is the
 * one failure `fjs/web` could not report for itself.
 *
 * @type {(root: Dir, rootArgument?: string) => (req: IncomingMessage) => RecordedResponse}
 */
const answerRequest = (root, rootArgument = '.') => req => {
    const e = step(createServer(respond(rootArgument)), server => listen(server, 8080, '127.0.0.1'))
    const [s, result] = virtual({ ...emptyState, root, requests: [req] })(e)
    assert(result[0] === 'ok', result)
    assertEq(s.responses.length, 1)
    // `release` gave every handle back — see `handles` in
    // `../effects/node/virtual/proof.f.mjs` for this assertion failing on a
    // listener that does not.
    assertEq(s.handles.length, 0, s.handles)
    return s.responses[0]
}

/** @type {(root: Dir, rootArgument?: string) => (method: string, url: string) => RecordedResponse} */
const answer = (root, rootArgument) => (method, url) =>
    answerRequest(root, rootArgument)(request(method, url))

const answerSite = answer(site)

/**
 * Pulls a body to its end, threading `state` through every cell, and answers the
 * chunks with the state the reads left.
 *
 * This is what a runner's pump does, written out so that a proof can do something
 * *between* two pulls — which is how the one-inode claim is checked.
 *
 * @type {(state: State, e: List<NodeOp, Vec, IoChannel>, between?: (s: State) => State) => readonly[State, readonly Vec[]]}
 */
const drain = (state, e, between = s => s) => {
    /** @type {(s: State, rest: List<NodeOp, Vec, IoChannel>, out: readonly Vec[]) => readonly[State, readonly Vec[]]} */
    const loop = (s, rest, out) => {
        const [next, cell] = virtual(s)(rest)
        const node = unwrap(cell)
        return node === undefined
            ? [next, out]
            : loop(between(next), node.tail, [...out, node.first])
    }
    return loop(state, e, [])
}

/** The text a body carries, pulled cell by cell.
 *
 * @type {(e: List<NodeOp, Vec, IoChannel>) => string}
 */
const textOf = e =>
    utf8ToString(u8ListToVecMsb(drain(emptyState, e)[1].flatMap(v => toArray(u8ListMsb(v)))))

/** Every byte a response body carries, its chunks joined.
 *
 * @type {(r: RecordedResponse) => readonly number[]}
 */
const bodyBytes = r => r.body.flatMap(v => toArray(u8ListMsb(v)))

/**
 * Asserts that a response carries exactly `expected`, by length and then by the
 * first byte that differs.
 *
 * Not `assertStructurallySame` on the two arrays: the bodies here run past a
 * hundred thousand bytes, and a failure that prints both of them names nothing a
 * reader can act on, where an index names where the body went wrong.
 *
 * @type {(r: RecordedResponse, expected: readonly number[]) => void}
 */
const assertBody = (r, expected) => {
    const actual = bodyBytes(r)
    assertEq(actual.length, expected.length)
    assertEq(actual.findIndex((b, i) => b !== expected[i]), -1)
    // A body a client reads as whole, which a bare chunk array cannot say: an
    // overrun, an underrun and a failed cell all leave the chunks up to the point
    // they stopped.
    assertEq(r.failure, null, r.failure)
}

/** A response body as text. Not for a body past the `Vec` cap — that is what
 * {@link bodyBytes} is for, since no single `Vec` can hold one.
 *
 * @type {(r: RecordedResponse) => string}
 */
const body = r => utf8ToString(u8ListToVecMsb(bodyBytes(r)))

/** @type {(r: RecordedResponse) => string} */
const contentType = ({ headers }) => `${headers['content-type']}`

/** @type {(r: RecordedResponse) => string} */
const contentLength = ({ headers }) => `${headers['content-length']}`

/** A kibibyte of bytes counting up from `n`, so no two chunks hold the same
 * bytes and a dropped, doubled or reordered one is visible.
 *
 * @type {(n: number) => Vec}
 */
const countingKib = n => u8ListToVecMsb(Array.from({ length: 1024 }, (_, i) => n + i & 0xFF))

/** A file larger than one `Vec`, as the chunks one `readWhole` answers — a
 * kibibyte each here rather than the 128 KiB a host would give, because the
 * count and the boundaries are what a served body has to keep, and the fixture
 * is the chunk list itself.
 *
 * @type {readonly Vec[]}
 */
const largeChunks = Array.from({ length: 129 }, (_, n) => countingKib(n))

/** @type {readonly number[]} */
const largeBytes = largeChunks.flatMap(v => toArray(u8ListMsb(v)))

/** @type {Dir} */
const largeRoot = { 'large.bin': largeChunks }

export const proof = {
    resolve: {
        // The bare `/` and any directory path are the site's `index.html` —
        // without this a generated site cannot be opened at all.
        index: () => {
            assertEq(unwrap(resolve('.')('/')), './index.html')
            assertEq(unwrap(resolve('.')('/docs/')), './docs/index.html')
        },
        // An absolute-form target is a proxy's spelling of the same request, and
        // RFC 9112 §3.2.2 requires an origin server to accept it. Read as a
        // path it named a file called `http:` and answered `404` for the wrong
        // reason.
        absoluteForm: () => {
            assertEq(unwrap(resolve('.')('http://127.0.0.1:8080/main.css')), './main.css')
            assertEq(unwrap(resolve('.')('https://localhost/docs/')), './docs/index.html')
            // The scheme is case-insensitive, as schemes are.
            assertEq(unwrap(resolve('.')('HTTP://localhost/main.css')), './main.css')
            // No path at all is the root of that authority.
            assertEq(unwrap(resolve('.')('http://localhost')), './index.html')
            // The query still goes, and traversal is still rejected after the
            // authority is taken off.
            assertEq(unwrap(resolve('.')('http://localhost/main.css?v=2')), './main.css')
        },
        file: () => {
            assertEq(unwrap(resolve('.')('/main.css')), './main.css')
            // The query and the fragment are not part of the path.
            assertEq(unwrap(resolve('.')('/main.css?v=2')), './main.css')
            assertEq(unwrap(resolve('.')('/main.css#top')), './main.css')
            // `.` and a collapsible `..` are normalized, not rejected.
            assertEq(unwrap(resolve('.')('/./docs/../main.css')), './main.css')
        },
        // An absolute root stays absolute: `join` does not renormalize, which
        // is why it is used here rather than `concat`.
        absoluteRoot: () => {
            assertEq(unwrap(resolve('/var/www')('/main.css')), '/var/www/main.css')
        },
        // An empty root is the working directory. Left alone it would be the
        // file system root instead — `join('', 'etc')` is `/etc` — and the
        // argument's default cannot catch it, since `''` is a value the caller
        // passed rather than an absent one.
        emptyRoot: () => {
            assertEq(unwrap(resolve('')('/etc/passwd')), './etc/passwd')
            assertEq(unwrap(resolve('')('/')), './index.html')
        },
        percentEncoding: () => {
            assertEq(unwrap(resolve('.')('/a%20b.txt')), './a b.txt')
            // Several escapes spelling one character, which is why the bytes
            // are decoded as a whole rather than per escape.
            assertEq(unwrap(resolve('.')('/%D0%9F.txt')), './П.txt')
        },
        // Every way a URL fails to name a path under the root.
        rejected: () => {
            /** @type {(url: string) => string} */
            const reason = url => {
                const r = resolve('.')(url)
                assert(r[0] === 'error', r)
                return `${r[1].status} ${r[1].message}`
            }
            assertEq(reason('/../secret'), '400 request path escapes the served root')
            assertEq(reason('/docs/../../secret'), '400 request path escapes the served root')
            // A percent escape that is not two hexadecimal digits, at the end
            // of the URL and in the middle of it.
            assertEq(reason('/a%'), '400 malformed request URL')
            assertEq(reason('/a%zz.txt'), '400 malformed request URL')
            assertEq(reason('/a%2z.txt'), '400 malformed request URL')
            // Well-formed escapes spelling bytes that are not UTF-8.
            assertEq(reason('/%ff.txt'), '400 malformed request URL')
            // Targets that are neither origin-form nor absolute-form: the
            // asterisk-form, an authority-form from a `CONNECT`, and nothing.
            assertEq(reason('*'), '400 malformed request URL')
            assertEq(reason('localhost:8080'), '400 malformed request URL')
            assertEq(reason(''), '400 malformed request URL')
            // Traversal is rejected after the authority comes off, not before.
            assertEq(reason('http://localhost/../secret'), '400 request path escapes the served root')
            // An authority carrying userinfo is refused rather than parsed
            // past: it reads as a different host from each end.
            assertEq(reason('http://127.0.0.1:8080@attacker.example/x'), '400 malformed request URL')
            // A scheme is not whatever precedes `://`: these name none, and
            // reading them as absolute-form served the file.
            assertEq(reason('://localhost/x'), '400 malformed request URL')
            assertEq(reason('1://localhost/x'), '400 malformed request URL')
            assertEq(reason('ftp://localhost/x'), '400 malformed request URL')
            // An `http` URI with an empty host is one RFC 9110 §4.2.1 says to
            // reject: this parser would read `/index.html` as the path where a
            // URL parser reads `index.html` as the host.
            assertEq(reason('http:///index.html'), '400 malformed request URL')
            assertEq(reason('http://:80/index.html'), '400 malformed request URL')
            assertEq(reason('http://'), '400 malformed request URL')
            // A NUL is a bad request, not a host failure: left to the file
            // system it comes back as an `ERR_INVALID_ARG_VALUE` and a `500`.
            assertEq(reason('/main.css%00'), '400 malformed request URL')
            // A dot-prefixed segment is `404`, at any depth: whether `.env` or
            // `.git/config` exists is itself what is not being disclosed.
            assertEq(reason('/.env'), '404 not found')
            assertEq(reason('/.git/config'), '404 not found')
            assertEq(reason('/docs/.secret/key'), '404 not found')
        },
    },
    respond: {
        found: () => {
            const r = answerSite('GET', '/')
            assertEq(r.status, 200)
            assertEq(body(r), page)
            assertEq(contentType(r), 'text/html; charset=utf-8')
            // Stated, not left to the runner: Node sends an unmeasured body
            // chunked, and a `HEAD` client would learn neither bytes nor size.
            assertEq(contentLength(r), `${page.length}`)
            // The `Content-Type` is derived from the name, so a browser must
            // not go looking for a second opinion in the bytes.
            assertEq(`${r.headers['x-content-type-options']}`, 'nosniff')
        },
        // `HEAD` is answered exactly like `GET`; Node drops the body itself.
        head: () => {
            const r = answerSite('HEAD', '/main.css')
            assertEq(r.status, 200)
            assertEq(contentType(r), 'text/css; charset=utf-8')
            assertEq(contentLength(r), '7')
        },
        missing: () => {
            const r = answerSite('GET', '/nope.html')
            assertEq(r.status, 404)
            assertEq(body(r), 'not found\n')
            assertEq(contentType(r), 'text/plain; charset=utf-8')
            assertEq(contentLength(r), '10')
        },
        // Binding loopback does not stop a browser from being told that a name
        // the attacker owns lives at 127.0.0.1 — only the `Host` header says
        // which name the request was really for.
        rebinding: () => {
            /** @type {(host: string) => number} */
            const status = host => answerRequest(site)(hosted(host)('GET', '/')).status
            assertEq(status('attacker.example'), 403)
            assertEq(status('attacker.example:8080'), 403)
            // The names it does answer for, with and without a port, and as an
            // IPv6 literal — whose brackets are part of the name.
            assertEq(status('127.0.0.1:8080'), 200)
            assertEq(status('localhost'), 200)
            // A host name is case-insensitive, and a trailing dot names the DNS
            // root rather than a different machine; refusing either would be a
            // bug, not a defence.
            assertEq(status('LOCALHOST:8080'), 200)
            assertEq(status('localhost.'), 200)
            assertEq(status('localhost.:8080'), 200)
            assertEq(status('[::1]:8080'), 200)
            // Userinfo names a credential, not a host: read from the left,
            // `127.0.0.1:8080@attacker.example` looks like loopback, and the
            // host it actually names is the attacker's.
            assertEq(status('127.0.0.1:8080@attacker.example'), 403)
            assertEq(status('user@localhost'), 403)
            // What follows a name may be a port and nothing else. Reading the
            // prefix and discarding the rest made each of these read as a name
            // this server answers for.
            assertEq(status('localhost:bad'), 403)
            assertEq(status('localhost:8080:999'), 403)
            assertEq(status('localhost:'), 403)
            assertEq(status('[::1]evil'), 403)
            // And a port is digits in range: `65536` is a number and not a
            // port, which is why `new URL` refuses the same authority.
            assertEq(status('localhost:65535'), 200)
            assertEq(status('localhost:65536'), 403)
            assertEq(status('localhost:999999'), 403)
            assertEq(status('[::1]:65536'), 403)
            // Read as a number, not counted: a parser reads `00008080` as
            // `8080`, and a length test would call it five digits too many.
            assertEq(status('localhost:00008080'), 200)
            // A bracket with no closing `]` names nothing.
            assertEq(status('[::1'), 403)
            // An absolute-form target names its own host, and RFC 9112 says to
            // believe it over the header — so a proxy-shaped request for a name
            // this server does not answer for is refused even when the `Host`
            // header says something reassuring.
            // The same trick through the target rather than the header: the
            // authority names the attacker, and the reassuring `Host` does not
            // rescue it.
            const credentialed = answerRequest(site)({
                method: 'GET',
                url: 'http://127.0.0.1:8080@attacker.example/index.html',
                headers: { host: 'localhost:8080' },
                body: empty,
                chunkedResponse: true,
            })
            assertEq(credentialed.status, 400)
            const spoofed = answerRequest(site)({
                method: 'GET',
                url: 'http://attacker.example/index.html',
                headers: { host: 'localhost:8080' },
                body: empty,
                chunkedResponse: true,
            })
            assertEq(spoofed.status, 403)
            // And the same target for a name it does answer for is served.
            const proxied = answerRequest(site)({
                method: 'GET',
                url: 'http://localhost:8080/index.html',
                headers: {},
                body: empty,
                chunkedResponse: true,
            })
            assertEq(proxied.status, 200)
            // HTTP/1.1 requires a `Host`; its absence is not a way around this.
            const noHost = answerRequest(site)({
                method: 'GET', url: '/', headers: {}, body: empty, chunkedResponse: true,
            })
            assertEq(noHost.status, 403)
            assertEq(body(noHost), 'host not served\n')
        },
        methodNotAllowed: () => {
            const r = answerSite('POST', '/')
            assertEq(r.status, 405)
            assertEq(body(r), 'only GET and HEAD are supported\n')
            // A refusal that does not say what would be accepted leaves the
            // client to guess; RFC 9110 requires the list.
            assertEq(`${r.headers['allow']}`, 'GET, HEAD')
        },
        traversal: () => {
            const r = answerSite('GET', '/../secret')
            assertEq(r.status, 400)
            assertEq(body(r), 'request path escapes the served root\n')
        },
        // A directory without a trailing slash is not a file, and is answered
        // as absent rather than redirected — this version has no redirect.
        directoryWithoutSlash: () => {
            const r = answerSite('GET', '/docs')
            assertEq(r.status, 404)
        },
        // A dotfile is answered as absent, even when it is right there.
        hidden: () => {
            /** @type {Dir} */
            const root = { '.env': [utf8('KEY=1')] }
            const r = answer(root)('GET', '/.env')
            assertEq(r.status, 404)
            assertEq(body(r), 'not found\n')
        },
        // The claim [#1819](https://github.com/functionalscript/functionalscript/issues/1819)
        // makes: a file larger than one `Vec` is served whole. Byte for byte
        // and in order, so a dropped, doubled or reordered chunk fails here
        // rather than arriving as a shorter right answer.
        large: () => {
            const r = answer(largeRoot)('GET', '/large.bin')
            assertEq(r.status, 200)
            assertBody(r, largeBytes)
            // Summed from the chunks that were read, so the header and the body
            // cannot disagree.
            assertEq(contentLength(r), `${largeBytes.length}`)
            // And it took more than one chunk to carry: a proof that passes on
            // a single-`Vec` body says nothing about the cap this lifts.
            assert(r.body.length > 1, r.body.length)
        },
        // A file with no bytes is a file, and a chunk list with no chunks is
        // what one open answers for it: `200` with a length of nought, not the
        // `404` an absent name gets. It used to be one empty `Vec` and is now no
        // chunks at all, which is the case a length summed over nothing has to
        // get right.
        empty: () => {
            const r = answer({ 'blank.css': [] })('GET', '/blank.css')
            assertEq(r.status, 200)
            assertEq(contentLength(r), '0')
            assertEq(r.body.length, 0)
            assertEq(contentType(r), 'text/css; charset=utf-8')
        },
        // A `HEAD` is answered exactly like a `GET` here — the same frame, with
        // the size the client asked for — and the **runner** is what declines to
        // pull the body. So the recorded body is empty where a `GET`'s is the
        // file, and the handle the listener opened for a body nobody pulled comes
        // back all the same, which `answerRequest` checks for every case here.
        headLarge: () => {
            const r = answer(largeRoot)('HEAD', '/large.bin')
            assertEq(r.status, 200)
            assertEq(contentLength(r), `${largeBytes.length}`)
            assertEq(r.body.length, 0)
            assertEq(r.failure, null)
        },
        // **The splice this route exists to prevent.** The served entry is
        // replaced between every two pulls, by an entry of exactly the same
        // length — which is what makes the defect invisible: a reader that went
        // back to the *name* per chunk would answer a prefix of one file joined to
        // a suffix of another, under a `Content-Length` that is correct and an end
        // that is clean, and nothing downstream could tell. Measured that way on a
        // host with Node 26.8.1, a 524,288-byte file replaced after the first pull
        // came back as 131,072 bytes of the first file followed by 393,216 of the
        // second.
        //
        // Driven cell by cell rather than through `listen`, because the point is
        // what happens *between* two pulls.
        oneInode: () => {
            /** The same size and different bytes: its first is 200 where the
             * fixture's is 0.
             *
             * @type {Dir}
             */
            const other = { 'large.bin': Array.from({ length: 129 }, (_, n) => countingKib(n + 200)) }
            const [afterListener, answered] = virtual({ ...emptyState, root: largeRoot })(
                respond('.')(request('GET', '/large.bin')))
            const r = unwrap(answered)
            assertEq(r.status, 200)
            assertEq(`${r.headers['content-length']}`, `${largeBytes.length}`)
            const [afterBody, chunks] = drain(afterListener, r.body, s => ({ ...s, root: other }))
            const bytes = chunks.flatMap(v => toArray(u8ListMsb(v)))
            assertEq(bytes.length, largeBytes.length)
            assertEq(bytes.findIndex((b, i) => b !== largeBytes[i]), -1)
            // The replacement really did land: the *name* now holds the other
            // file, so the reads above answered the opened entry and not the
            // current one.
            assertEq(toArray(u8ListMsb(unwrap(virtual(afterBody)(readBytes('large.bin', 0, 1))[1])))[0], 200)
            // And the handle is given back by the `release` the response carries.
            assertEq(virtual(afterBody)(r.release)[0].handles.length, 0)
        },
        // **The declared length is the bound the reads stop at.** An entry that
        // *grows* between the `fstat` and the reads is the guess the document
        // measured going wrong: 131,072 declared and 132,072 sent, `res.write`
        // answering `false` for the surplus exactly as it had for the chunk
        // before it, and the keep-alive client losing the response it was reading
        // along with the one behind it. A fold that ended at the empty read would
        // stream the new bytes past the count already promised; this one stops at
        // the number in the header.
        boundedByTheFstat: () => {
            /** @type {Dir} */
            const grown = { 'large.bin': [...largeChunks, countingKib(500)] }
            const [afterListener, answered] = virtual({ ...emptyState, root: largeRoot })(
                respond('.')(request('GET', '/large.bin')))
            const r = unwrap(answered)
            const [, chunks] = drain(afterListener, r.body, s => ({ ...s, root: grown }))
            assertEq(chunks.reduce((n, v) => n + Number(length(v)) / 8, 0), largeBytes.length)
        },
        // **The body arrives in pieces bounded by one `Vec`**, which is the whole
        // of what the handle route buys: the frame is complete before any of it is
        // read, and no cell is larger than a chunk however large the file is. What
        // that costs in memory is a host measurement — see `createServer` in
        // `../effects/node/proof.mjs`, where the pump is parked and the reads stop
        // with it.
        chunkedBody: () => {
            const r = answer(largeRoot)('GET', '/large.bin')
            // 129 KiB, so two reads: one full `Vec` and the remainder.
            assertEq(r.body.length, 2)
            assertEq(Number(length(r.body[0])) / 8, 131072)
            assertEq(Number(length(r.body[1])) / 8, largeBytes.length - 131072)
            // The boundaries are the reader's, not the fixture's: the file is 129
            // chunks as a `Dir` holds it.
            assertEq(largeChunks.length, 129)
        },
        // An entry that exists and is not a regular file is answered as absent
        // — and, crucially, is never read: a FIFO would block the read forever.
        // A `JsModule` is this file system's non-regular entry.
        notRegular: () => {
            /** @type {Dir} */
            const root = { 'pipe.txt': () => ({}) }
            const r = answer(root)('GET', '/pipe.txt')
            assertEq(r.status, 404)
            assertEq(body(r), 'not found\n')
        },
        // A path that descends through a regular file names nothing, so it is
        // answered exactly like a path that descends through nothing. While it
        // was a `500` the pair answered differently, which made a trailing
        // slash a way to ask "is there a file at this name?" — the enumeration
        // every other identical `404` here exists to deny.
        //
        // Proven through the virtual file system rather than the host's: the
        // status differed by platform (POSIX `ENOTDIR`, Windows `ENOENT`), so a
        // proof reading the real `stat` would cover this branch on one host and
        // not the other.
        throughFile: () => {
            const throughRegular = answerSite('GET', '/main.css/')
            const throughNothing = answerSite('GET', '/nope.md/')
            assertEq(throughRegular.status, throughNothing.status)
            assertEq(body(throughRegular), body(throughNothing))
            assertEq(throughRegular.status, 404)
            assertEq(body(throughRegular), 'not found\n')
            // At any depth, and for an entry that is not a regular file either.
            assertEq(answerSite('GET', '/main.css/a/b.txt').status, 404)
            assertEq(answer({ 'pipe.txt': () => ({}) })('GET', '/pipe.txt/x').status, 404)
            // It says nothing about the other directory-form failures: a
            // permission-denied or looping entry is one an operator placed, and
            // stays a `500` (see `./todo/`).
        },
        // …but only while the root is still a directory. Replace it with a file
        // and every request descends through one, so the `404` above would
        // report the operator's mistake as the client's — permanently, and to
        // everyone. `main` refuses such a root at startup; this is what keeps
        // the answer true if it is replaced afterwards.
        rootNotDirectory: () => {
            const r = answer(site, 'main.css')('GET', '/')
            assertEq(r.status, 500)
            assertEq(body(r), 'io error: ENOTDIR\n')
        },
        // A host failure that is not a missing path is not a 404. A runner that
        // cannot `stat` at all is the sharpest case: nothing looked for the
        // file, so answering "not found" would be a claim nobody checked.
        // A host failure that is not a missing path is not a 404. A runner that
        // cannot `open` at all is the sharpest case: nothing looked for the file,
        // so answering "not found" would be a claim nobody checked.
        //
        // Answered by calling `respond` rather than through `listen`, because the
        // runner under test here has no `createServer` either; the refusal frame's
        // body is a pure cell, so {@link textOf} can pull it with any runner.
        hostFailure: () => {
            const noFs = partialRun(nodeCommands)({})
            const r = unwrap(noFs(emptyState)(respond('.')(request('GET', '/index.html')))[1])
            assertEq(r.status, 500)
            assertEq(textOf(r.body), 'operation not implemented: open\n')
        },
        // And a runner that can **open** but not describe what it opened is the
        // same answer with the handle already in hand — so this is the one refusal
        // that is decided after the `open` and still owes it back. `release` is the
        // handle's `close`, which this runner cannot perform either; that failure
        // is absorbed, which is what `release`'s `never` channel says about a
        // response that is already finished.
        fstatFailure: () => {
            /** @type {Handle} */
            const handle = asNominal({ id: 0 })
            const noFstat = partialRun(nodeCommands)({ open: () => state => [state, ok(handle)] })
            const r = unwrap(noFstat(emptyState)(respond('.')(request('GET', '/index.html')))[1])
            assertEq(r.status, 500)
            assertEq(textOf(r.body), 'operation not implemented: fstat\n')
        },
    },
    main: {
        // The whole program, request in and response out, without a socket:
        // `createServer` stores the listener, `listen` delivers what the
        // fixture queued, and the run ends where the real one would have
        // blocked forever.
        endToEnd: () => {
            /** @type {State} */
            const state = {
                ...emptyState,
                root: site,
                requests: [request('GET', '/'), request('GET', '/docs/'), request('DELETE', '/')],
            }
            const [s, result] = virtual(state)(main(nodeProgramOptions([])))
            // Loopback, and the URL says so: a server that binds every
            // interface while announcing `localhost` is the trap this avoids.
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:8080')
            assertEq(s.stdout, 'serving . on http://127.0.0.1:8080/\n')
            const [first, second, third] = s.responses
            assertEq(s.responses.length, 3)
            assertEq(first.status, 200)
            assertEq(body(first), page)
            assertEq(body(second), 'docs')
            assertEq(third.status, 405)
            // `forever` is the one operation no virtual runner can answer, so
            // the program stops there and reports it — the exit code says the
            // server did not run to completion, which is the truth.
            assertEq(exitCode(result), 1)
            assertEq(s.stderr, 'operation not implemented: forever\n')
        },
        // An empty root argument is the working directory, in the announced
        // line as well as in what gets served.
        emptyRoot: () => {
            const options = nodeProgramOptions([''])
            const [s] = virtual({ ...emptyState, root: site })(main(options))
            assertEq(s.stdout, 'serving . on http://127.0.0.1:8080/\n')
        },
        // Both arguments given, and a root that is not the working directory.
        arguments: () => {
            /** @type {State} */
            const state = {
                ...emptyState,
                root: { site },
                requests: [request('GET', '/index.html')],
            }
            const options = nodeProgramOptions(['site', '9090'])
            const [s] = virtual(state)(main(options))
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:9090')
            assertEq(s.stdout, 'serving site on http://127.0.0.1:9090/\n')
            assertEq(s.responses[0].status, 200)
        },
        // A root that is not a directory is the same kind of mistake as a port
        // that is not a port, and is reported the same way — at the moment it
        // was made, rather than as a status code some visitor gets later. Both
        // failures reach `errorExit`: `stat` refusing the name at all, and a
        // name that exists and is not a directory.
        badRoot: () => {
            /** A site with one entry that is neither a file nor a directory.
             *
             * @type {Dir}
             */
            const root = { ...site, 'pipe.txt': () => ({}) }
            /** @type {(argument: string, reason: string) => void} */
            const rejects = (argument, reason) => {
                const options = nodeProgramOptions([argument])
                const [s, result] = virtual({ ...emptyState, root })(main(options))
                assertEq(exitCode(result), 1)
                assertEq(s.stderr, `invalid root "${argument}": ${reason}\n`)
                // Nothing was bound, and nothing announced: the root is checked
                // before the socket exists.
                assertEq(s.listening.length, 0)
                assertEq(s.stdout, '')
            }
            // `fjs web README.md` — a regular file is not a root, though every
            // path under it would have looked merely missing.
            rejects('main.css', 'not a directory')
            // A name that is not there at all. The operator's own words are
            // forwarded here, unlike in a response, where the host's message
            // would publish the server's filesystem layout.
            rejects('nope', 'no such file or directory')
            // An entry that is neither: this file system's `JsModule` stands in
            // for a FIFO, a device or a socket, none of which can be served —
            // and none of which an `isFile` test alone tells from a directory,
            // which is why `FileStat` grew `isDirectory` rather than this
            // asking `!isFile`.
            rejects('pipe.txt', 'not a directory')
        },
        // A port that is not a port is a command-line mistake, not a defect:
        // reported on `stderr` with exit code 1, like every other `fjs` command.
        badPort: () => {
            /** @type {(argument: string) => void} */
            const rejects = argument => {
                const options = nodeProgramOptions(['.', argument])
                const [s, result] = virtual(emptyState)(main(options))
                assertEq(exitCode(result), 1)
                assertEq(s.stderr, `invalid port "${argument}"\n`)
                // Nothing was bound: the argument is refused before the server
                // is created, let alone listened on.
                assertEq(s.listening.length, 0)
            }
            rejects('http')
            rejects('8080.5')
            rejects('-1')
            rejects('65536')
            // Node reads `0` as "any free port", and nothing here can ask which
            // one it got, so the announced URL would name a dead port.
            rejects('0')
        },
    },
    // `listen` with nothing queued still records the port, and empties the
    // queue so a second call cannot answer the same request twice.
    virtualServer: {
        noRequests: () => {
            const [s] = virtual(emptyState)(main(nodeProgramOptions([])))
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:8080')
            assertEq(s.responses.length, 0)
            assertEq(s.requests.length, 0)
        },
        emptyBody: () => {
            assertEq(length(request('GET', '/').body), 0n)
        },
    },
}
