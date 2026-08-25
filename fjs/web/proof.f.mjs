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

/** @type {(method: string, url: string) => IncomingMessage} */
const request = (method, url) => ({ method, url, headers: {}, body: empty })

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
            assertEq(unwrap(resolve('.')('')), './index.html')
            assertEq(unwrap(resolve('.')('/docs/')), './docs/index.html')
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
            assertEq(s.port, 8080)
            // Loopback, and the URL says so: a server that binds every
            // interface while announcing `localhost` is the trap this avoids.
            assertEq(s.host, '127.0.0.1')
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
            assertEq(s.port, 9090)
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
                assertEq(s.port, null)
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
            assertEq(s.port, 8080)
            assertEq(s.host, '127.0.0.1')
            assertEq(s.responses.length, 0)
            assertEq(s.requests.length, 0)
        },
        emptyBody: () => {
            assertEq(length(request('GET', '/').body), 0n)
        },
    },
}
