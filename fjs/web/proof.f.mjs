/**
 * @import { IncomingMessage, ServerResponse } from '../effects/node/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { exitCode } from '../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { nodeCommands } from '../effects/node/module.f.mjs'
import { partialRun } from '../effects/mock/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty, length, vec } from '../types/bit_vec/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
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

/** @type {(host: string) => (method: string, url: string) => IncomingMessage} */
const hosted = host => (method, url) => ({ method, url, headers: { host }, body: empty })

/**
 * Answers one request against `root`, which every case below is a variation of.
 *
 * @type {(root: Dir) => (method: string, url: string) => ServerResponse}
 */
const answer = root => (method, url) =>
    unwrap(virtual({ ...emptyState, root })(respond('.')(request(method, url)))[1])

const answerSite = answer(site)

/** @type {(r: ServerResponse) => string} */
const body = r => utf8ToString(r.body)

/** @type {(r: ServerResponse) => string} */
const contentType = ({ headers }) => `${headers['content-type']}`

/** @type {(r: ServerResponse) => string} */
const contentLength = ({ headers }) => `${headers['content-length']}`

// A file one byte past what a single `Vec` holds, built as chunks of a
// kibibyte: `stat` sums the chunk sizes, so the size is reached without
// materializing the bytes.
/** @type {Vec} */
const kib = vec(8192n)(0n)

/** @type {Dir} */
const hugeRoot = { 'huge.bin': Array.from({ length: 129 }, () => kib) }

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
            const status = host =>
                unwrap(virtual({ ...emptyState, root: site })(
                    respond('.')(hosted(host)('GET', '/')))[1]).status
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
            const credentialed = unwrap(virtual({ ...emptyState, root: site })(
                respond('.')({
                    method: 'GET',
                    url: 'http://127.0.0.1:8080@attacker.example/index.html',
                    headers: { host: 'localhost:8080' },
                    body: empty,
                }))[1])
            assertEq(credentialed.status, 400)
            const spoofed = unwrap(virtual({ ...emptyState, root: site })(
                respond('.')({
                    method: 'GET',
                    url: 'http://attacker.example/index.html',
                    headers: { host: 'localhost:8080' },
                    body: empty,
                }))[1])
            assertEq(spoofed.status, 403)
            // And the same target for a name it does answer for is served.
            const proxied = unwrap(virtual({ ...emptyState, root: site })(
                respond('.')({
                    method: 'GET',
                    url: 'http://localhost:8080/index.html',
                    headers: {},
                    body: empty,
                }))[1])
            assertEq(proxied.status, 200)
            // HTTP/1.1 requires a `Host`; its absence is not a way around this.
            const noHost = unwrap(virtual({ ...emptyState, root: site })(
                respond('.')({ method: 'GET', url: '/', headers: {}, body: empty }))[1])
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
        // The size is read before the bytes are, so a file too large for one
        // `Vec` is refused rather than truncated.
        tooLarge: () => {
            const r = answer(hugeRoot)('GET', '/huge.bin')
            assertEq(r.status, 413)
            assertEq(body(r), 'file is 132096 bytes; this server cannot answer with more than 131072\n')
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
        // A host failure that is not a missing path is not a 404. A runner that
        // cannot `stat` at all is the sharpest case: nothing looked for the
        // file, so answering "not found" would be a claim nobody checked.
        hostFailure: () => {
            const noFs = partialRun(nodeCommands)({})
            const r = unwrap(noFs(emptyState)(respond('.')(request('GET', '/index.html')))[1])
            assertEq(r.status, 500)
            assertEq(body(r), 'operation not implemented: stat\n')
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
            const [s, result] = virtual(state)(main({ ...defaultNodeProgramOptions, args: [] }))
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
            const options = { ...defaultNodeProgramOptions, args: [''] }
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
            const options = { ...defaultNodeProgramOptions, args: ['site', '9090'] }
            const [s] = virtual(state)(main(options))
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:9090')
            assertEq(s.stdout, 'serving site on http://127.0.0.1:9090/\n')
            assertEq(s.responses[0].status, 200)
        },
        // A port that is not a port is a command-line mistake, not a defect:
        // reported on `stderr` with exit code 1, like every other `fjs` command.
        badPort: () => {
            /** @type {(argument: string) => void} */
            const rejects = argument => {
                const options = { ...defaultNodeProgramOptions, args: ['.', argument] }
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
            const [s] = virtual(emptyState)(main({ ...defaultNodeProgramOptions, args: [] }))
            assertEq(s.listening.map(b => b.address).join(), '127.0.0.1:8080')
            assertEq(s.responses.length, 0)
            assertEq(s.requests.length, 0)
        },
        emptyBody: () => {
            assertEq(length(request('GET', '/').body), 0n)
        },
    },
}
