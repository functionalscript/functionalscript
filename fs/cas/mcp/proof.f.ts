import { assert, assertEq } from '../../asserts/module.f.ts'
import { pure, type Effect, type Operation } from '../../effects/module.f.ts'
import { run, type MemOperationMap } from '../../effects/mock/module.f.ts'
import { asBase, asNominal, create, type Key, type MemOp } from '../../effects/memory/module.f.ts'
import type { Unknown } from '../../json/module.f.ts'
import type { Response } from '../../json/rpc/module.f.ts'
import { msb, u8ListToVec, vec8, repeat, length, type Vec, maxLengthBytes } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../cbase32/module.f.ts'
import { encode as base64Encode } from '../../base64/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { type FileCasOperation } from '../module.f.ts'
import {
    mcpStep, uninitializedState, type McpSessionState, type ToolsCallResult,
} from '../../mcp/module.f.ts'
import type {
    MakeDirectoryOptions,
    ReaddirOptions,
    Access,
    CreateExclusive,
    Mkdir,
    Now,
    RandomInt,
    ReadBytes,
    Readdir,
    Rename,
    Rm,
    Stat,
    WriteBytes
} from '../../effects/node/module.f.ts'
import { emptyState, virtual, type Dir } from '../../effects/node/virtual/module.f.ts'
import { casConfig, casMcpHandlers } from './module.f.ts'
import { ok as resultOk } from '../../types/result/module.f.ts'
import { stdioTransport } from '../../mcp/stdio/module.f.ts'
import { fromVec } from '../../types/uint8array/module.f.ts'

type CasGetResult = {
    readonly length: number
    readonly mime_type: string
    readonly type: string
    readonly url?: string
    readonly content?: string
}

// ── Memory mock (mirrors fs/mcp/proof.f.ts) ─────────────────────────────────────

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

type TestState = {
    readonly memory: MemoryState
}

const initialTestState: TestState = { memory: { next: 0, values: {} } }

// The in-memory session helpers only exercise text/base64 paths (MemOp) and the
// path-rejection branch of type:'url' (no file I/O). The upload ops from
// FileCasOperation are only reached via runSessionVirtual; the stubs below
// exist to satisfy the type-checker and will throw if unexpectedly called.
type MockOp = MemOp | Mkdir | Rename | RandomInt | ReadBytes | Now
    | Access | CreateExclusive | Readdir | Rm | Stat | WriteBytes

const mock: MemOperationMap<MockOp, TestState> = {
    memCreate: value => state => {
        const id = `k${state.memory.next}`
        const key: Key<unknown> = asNominal(id)
        return [
            { ...state, memory: { next: state.memory.next + 1, values: { ...state.memory.values, [id]: value } } },
            key,
        ]
    },
    memRead: key => state => [state, state.memory.values[asBase(key)]],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        return [{ ...state, memory: { ...state.memory, values: { ...state.memory.values, [id]: value } } }, undefined]
    },
    mkdir: (_path: string, _opts?: MakeDirectoryOptions) => state => [state, resultOk(undefined)],
    rename: (_src: string, _dst: string) => _ => { throw new Error('rename not supported in memory mock') },
    readBytes: (_path: string, _offset: number, _size: number) => _ => { throw new Error('readBytes not supported in memory mock') },
    randomInt: () => _ => { throw new Error('randomInt not supported in memory mock') },
    now: () => state => [state, 0],
    access: (_path: string) => _ => { throw new Error('access not supported in memory mock') },
    createExclusive: (_path: string) => _ => { throw new Error('createExclusive not supported in memory mock') },
    readdir: (_path: string, _opts: ReaddirOptions) => _ => { throw new Error('readdir not supported in memory mock') },
    rm: (_path: string) => _ => { throw new Error('rm not supported in memory mock') },
    stat: (_path: string) => _ => { throw new Error('stat not supported in memory mock') },
    writeBytes: (_path: string, _offset: number, _data: Vec) => _ => { throw new Error('writeBytes not supported in memory mock') },
}

const runMem = <T>(effect: Effect<MockOp, T>): T =>
    run(mock)(initialTestState)(effect)[1]

// ── In-memory KvStore backed by a single memory slot ────────────────────────────
// Persists writes across steps so add → get round-trips, keyed by cBase32 hash.

// Maps cBase32(key) → [key, value]; storing the key Vec lets `list` return keys
// (hashes), matching the `KvStore` contract that the filesystem backing fulfils.
type VecMap = { readonly [k: string]: readonly [Vec, Vec] }

// ── Session driver ──────────────────────────────────────────────────────────────

// Feeds each message to `step` in order, collecting every response.
const feed = <O extends Operation>(
    step: (v: Unknown) => Effect<O, Response | null>,
) => (msgs: readonly unknown[]): Effect<O, readonly unknown[]> => {
    const go = (i: number, acc: readonly unknown[]): Effect<O, readonly unknown[]> =>
        i === msgs.length
            ? pure(acc)
            : step(msgs[i] as Unknown).step(r => go(i + 1, [...acc, r]))
    return go(0, [])
}

// Runs a session backed by the virtual node runner (for cas_upload which uses
// Rename/ReadBytes/RandomInt/Mkdir). Uses fileKvStore so upload and get share
// the same filesystem-backed CAS.
const runSessionVirtual =
    (root: Dir, home = '/home/user') =>
    (msgs: readonly unknown[]): readonly unknown[] => {
        type UploadOp = FileCasOperation | Rename | RandomInt | ReadBytes
        const effect = create(uninitializedState as McpSessionState).step(sessionKey => {
            const step = mcpStep(casConfig)(casMcpHandlers(home))(sessionKey)
            return feed(step)(msgs)
        })
        return virtual({ ...emptyState, root })(effect)[1]
    }

// ── Messages ────────────────────────────────────────────────────────────────────

const init = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'c', version: '0' } } }

const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }

const call = (id: number, name: string, args: unknown) =>
    ({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })

const list = (id: number) => ({ jsonrpc: '2.0', method: 'tools/list', id })

// Runs `init`, `notifications/initialized`, then `msgs`; returns the tool responses.
const session = (...msgs: readonly unknown[]): readonly unknown[] =>
    runSessionVirtual({}, '/home/user')([init, initialized, ...msgs]).slice(2)

// UTF-8 bytes of `s` as a plain array — the virtual stdin byte stream.
const toBytes = (s: string): readonly number[] => [...fromVec(utf8(s))]

// Runs `init`, `notifications/initialized`, then `msgs` through the *real*
// stdio pipeline — `mcpStep` wrapped in `stdioTransport`, driving
// `writeResponse`'s `tryUtf8` encode over actual stdin/stdout bytes. Unlike
// `session`/`runSessionVirtual`, which collect `mcpStep`'s `Response` values
// as plain JS objects and never serialize/encode them, this is the only
// helper that can observe the transport's oversized-response fallback (see
// `fs/mcp/stdio/module.f.ts` `writeResponse`).
const runStdio =
    (root: Dir, home = '/home/user') =>
    (msgs: readonly unknown[]): readonly unknown[] => {
        const input = [init, initialized, ...msgs].map(m => JSON.stringify(m)).join('\n') + '\n'
        const effect = create(uninitializedState as McpSessionState).step(sessionKey =>
            stdioTransport(mcpStep(casConfig)(casMcpHandlers(home))(sessionKey)))
        const stdout = virtual({ ...emptyState, root, stdin: toBytes(input) })(effect)[0].stdout
        // Only requests get a written line (notifications, like `initialized`,
        // write nothing) — drop the `init` response, keep one line per `msgs` entry.
        return stdout.split('\n').filter(line => line.length > 0).slice(1).map(line => JSON.parse(line))
    }

const resultOf = (resp: unknown): ToolsCallResult =>
    (resp as { readonly result: ToolsCallResult }).result

const item0 = (resp: unknown): unknown => resultOf(resp).content[0]

const textOf = (resp: unknown): string => (item0(resp) as { readonly text: string }).text

// A plain text sample for text add→get round-trips.
const textSample = 'hello, world!'

// A base64-encoded binary payload for binary add→get round-trips.
const binarySample = base64Encode(vec8(0x2An)) as string

// A base64 blob whose leading bytes are the PNG magic-byte signature, so
// `cas_get` detects its type and returns base64 with mime_type image/png.
const pngSample = base64Encode(
    u8ListToVec(msb)([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])) as string

// Returns the RFC 4648 base64 encoding of `n` zero bytes, computed directly
// without bigint arithmetic — safe near maxLengthBytes where base64Encode on a
// padded Vec would trigger the encode-padding-overflow bug. Handles every n%3
// residue: rem=0 → no padding, rem=1 → 'AA==', rem=2 → 'AAA='.
const base64OfA = (n: bigint): string => {
    const groups = Number(n / 3n)
    const rem = Number(n % 3n)
    const body = 'AAAA'.repeat(groups)
    if (rem === 0) { return body }
    if (rem === 1) { return body + 'AA==' }
    return body + 'AAA='
}

// ── Tests ───────────────────────────────────────────────────────────────────────

// A blob larger than one read chunk (> 128 KiB) used to fail metadata-only
// cas_get because `collectRead` overflowed `maxLength`. With `detectStream`,
// content:false returns correct metadata regardless of size. Each chunk is
// exactly `maxLengthBytes` (the largest single `Vec` the runtime allows), so the
// two-chunk blob spans two read chunks without any one `Vec` exceeding the cap.
const largeMultiChunkBlobMeta =
    (chunk0: Vec, chunk1: Vec, expectedType: string, expectedMime: string) => () => {
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'big': [chunk0, chunk1] } } } }
        const [addResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(addResp).isError)
        const hash = textOf(addResp)
        const [, metaResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
            call(3, 'cas_get', { hash }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as CasGetResult
        assertEq(meta.type, expectedType)
        assertEq(meta.mime_type, expectedMime)
        assertEq(meta.length, Number((length(chunk0) + length(chunk1)) / 8n))
        assertEq(meta.content, undefined)
    }

// A full `maxLengthBytes`-long chunk of repeated ASCII 'a' — valid UTF-8.
const asciiChunk = repeat(maxLengthBytes)(vec8(0x61n))
// The same length, but repeated 2-byte "é" (C3 A9) — valid UTF-8 of multi-byte symbols.
const symbolChunk = repeat(maxLengthBytes / 2n)(u8ListToVec(msb)([0xc3, 0xa9]))
// A full chunk of 0xFF — an invalid UTF-8 lead byte, so binary (no magic match).
const binaryChunk = repeat(maxLengthBytes)(vec8(0xffn))

// 100,000 raw bytes of 0xFF: comfortably under `maxLengthBytes` (so `cas_get`'s
// own `length > maxLengthBytes` guard does not fire), but base64 inflates it to
// ceil(100_000/3)*4 = 133,336 chars — already past `maxLength` (131,072 bytes)
// before the JSON-RPC envelope adds anything. Small enough to stay clear of the
// separate `base64Encode`-near-`maxLength` padding bug (see `base64OfA` above).
const oversizedBase64Chunk = repeat(100_000n)(vec8(0xffn))
// 90,000 raw bytes: base64 inflates to 120,000 chars, leaving ~11 KiB of margin
// under `maxLength` once the envelope is added — the paired "still succeeds" case.
const boundaryBase64Chunk = repeat(90_000n)(vec8(0xffn))

// 33,000 `"` bytes (0x22): valid UTF-8, so `cas_get` classifies it as text and
// takes the double-JSON-escaping path (`toJson` builds the inner CAS JSON, then
// the outer `stringifyJson` embeds that as the `text` field). Each quote costs
// 4 final bytes (2 on each escaping pass), so 33,000 of them alone push the
// encoded line past `maxLength` (131,072 bytes) — well above the strict 32,769
// minimum needed, without approaching any other size-related edge case.
const quotesChunk = repeat(33_000n)(vec8(0x22n))

export const proof = {
    // Both chunks repeated ASCII → text/plain, no error on a > 128 KiB blob.
    getMetaLargeMultiChunkBlobNoError:
        largeMultiChunkBlobMeta(asciiChunk, asciiChunk, 'text', 'text/plain'),

    // Both chunks valid UTF-8 sequences of multi-byte symbols → text/plain.
    getMetaLargeMultiChunkUtf8Symbols:
        largeMultiChunkBlobMeta(symbolChunk, symbolChunk, 'text', 'text/plain'),

    // First chunk valid UTF-8, second chunk binary → base64/octet-stream. The
    // streaming validator must see the trailing binary chunk to reject text.
    getMetaLargeMultiChunkTextThenBinary:
        largeMultiChunkBlobMeta(asciiChunk, binaryChunk, 'base64', 'application/octet-stream'),

    // content:true on a present blob larger than `maxLength` reports a distinct
    // "too large" error, not "no such hash" — the blob exists, it just can't be
    // buffered inline. The metadata-only path (above) still returns its size/type.
    getContentLargeBlobTooLargeError: () => {
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'big': [asciiChunk, asciiChunk] } } } }
        const [addResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        const hash = textOf(addResp)
        const [, getResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
            call(3, 'cas_get', { hash, content: true }),
        ]).slice(2) as readonly unknown[]
        assertEq(resultOf(getResp).isError, true)
        const text = textOf(getResp)
        assert(text.includes('too large'))
        assert(!text.includes('no such hash'))
    },

    // content:true on a genuinely absent hash still reports "no such hash" — the
    // oversized branch above must not absorb the absent case.
    getContentMissingHashIsError: () => {
        const absent = vecToCBase32(vec8(0x55n))
        const [resp] = session(call(2, 'cas_get', { hash: absent, content: true }))
        assertEq(resultOf(resp).isError, true)
        assert(textOf(resp).includes('no such hash'))
    },

    // A blob at exactly `maxLengthBytes` passes cas_get's own raw-length guard
    // (it checks the *stored* size, not the encoded response), but base64
    // inflation of a 100,000-byte blob alone already exceeds `maxLength` before
    // the JSON-RPC envelope is even added. The transport's `writeResponse`
    // (`tryUtf8`) must catch this and write a JSON-RPC internal-error response —
    // carrying the *original request's* `id` — instead of crashing the process.
    // See `fs/mcp/stdio/module.f.ts` `writeResponse`.
    getContentBase64InflationOverflowWritesInternalError: () => {
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'big': [oversizedBase64Chunk] } } } }
        const [addResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
        ])
        const hash = textOf(addResp)
        const [, getResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
            call(3, 'cas_get', { hash, content: true }),
        ])
        const err = getResp as { readonly error?: { readonly code: number }, readonly id: unknown }
        assertEq(err.error?.code, -32603)
        assertEq(err.id, 3)
    },

    // The paired boundary case: a blob whose base64 inflation leaves enough
    // margin under `maxLength` for the envelope — confirms the fallback above
    // only triggers on genuine overflow, not on every `content:true` binary read.
    getContentBase64NearBoundarySucceeds: () => {
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'big': [boundaryBase64Chunk] } } } }
        const [addResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
        ])
        const hash = textOf(addResp)
        const [, getResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/big', type: 'url' }),
            call(3, 'cas_get', { hash, content: true }),
        ])
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'base64')
        assertEq(result.length, 90_000)
    },

    // A text blob made entirely of `"` characters keeps the *raw* content
    // (33,000 bytes) well under `maxLengthBytes`, but each quote costs 2 bytes on
    // the inner CAS-JSON escape and 4 bytes once the outer JSON-RPC envelope
    // re-escapes that backslash-quote pair — no `cas_get`-level size guard could
    // see this coming, only the transport's real encode attempt can. Uploaded via
    // `type: 'url'` (a file, not an inlined JSON string) so the test exercises
    // `cas_get`'s response-side escaping without also paying for parsing a huge
    // inline `content` argument on the request side. Confirms `writeResponse`'s
    // `tryUtf8` fallback (not a crash) handles double-escaping overflow, again
    // preserving the request's `id`.
    getContentDoubleEscapedOverflowWritesInternalError: () => {
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'q': [quotesChunk] } } } }
        const [addResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/q', type: 'url' }),
        ])
        const hash = textOf(addResp)
        const [, getResp] = runStdio(root)([
            call(2, 'cas_add', { content: '/home/user/cas_upload/q', type: 'url' }),
            call(3, 'cas_get', { hash, content: true }),
        ])
        const err = getResp as { readonly error?: { readonly code: number }, readonly id: unknown }
        assertEq(err.error?.code, -32603)
        assertEq(err.id, 3)
    },

    toolsListAdvertisesThreeTools: () => {
        const [resp] = runSessionVirtual({})([init, initialized, list(2)]).slice(2)
        const tools = (resp as { result: { tools: readonly { name: string }[] } }).result.tools
        assertEq(tools.length, 3)
        assertEq(tools.map(t => t.name).join(','), 'cas_add,cas_get,cas_list')
        const add = (resp as { result: { tools: readonly { inputSchema: { type?: string } }[] } }).result.tools[0]
        assertEq(add.inputSchema.type, 'object')
    },

    addReturnsHash: () => {
        const [resp] = session(call(2, 'cas_add', { content: textSample }))
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    // Text add→get round-trip: store as UTF-8 text, retrieve metadata.
    textAddGetMetaRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.mime_type, 'text/plain')
        assertEq(result.type, 'text')
        assertEq(result.length, textSample.length)
        assertEq(result.content, undefined)
    },

    // cas_get with content:true returns inline content.
    textAddGetContentRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.mime_type, 'text/plain')
        assertEq(result.content, textSample)
    },

    // Binary add→get round-trip: store as base64, retrieve metadata without content.
    binaryAddGetMetaRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: binarySample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: binarySample, type: 'base64' }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.content, undefined)
        assertEq(result.type, 'text')
        assertEq(result.mime_type, 'text/plain')
    },

    // Binary add→get with content:true returns inline base64 content.
    binaryAddGetContentRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: binarySample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: binarySample, type: 'base64' }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.content, '*')
    },

    addGetRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.content, textSample)
    },

    // Text content (no magic-byte match, valid UTF-8) comes back with type:'text' when content requested.
    getUntypedReturnsText: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assertEq(item0(getResp) === null ? null : (item0(getResp) as { type: string }).type, 'text')
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.mime_type, 'text/plain')
    },

    // Bytes with a recognised PNG signature come back as base64 with mime_type image/png when content requested.
    getTypedReturnsBinaryJson: () => {
        const [addResp] = session(call(2, 'cas_add', { content: pngSample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: pngSample, type: 'base64' }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assert(!resultOf(getResp).isError)
        assertEq((item0(getResp) as { type: string }).type, 'text')
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'base64')
        assertEq(result.mime_type, 'image/png')
        assertEq(result.content, pngSample)
    },

    listEnumeratesStoredHashes: () => {
        const [addResp, listResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_list', {}),
        )
        const hash = textOf(addResp)
        assert(!resultOf(listResp).isError)
        assertEq(textOf(listResp), hash)
    },

    addInvalidContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!', type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
    },

    addBadLengthContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'A', type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
    },

    // 174_764 'A' chars × 6 bits = 1_048_584 bits, 8 over maxLength — base64Decode
    // returns null and cas_add surfaces an error.
    addBase64OverLimitIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'A'.repeat(174_764), type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
        assert(textOf(resp).includes('too large or malformed'))
    },

    // One ASCII byte past maxLengthBytes — tryUtf8 returns null and cas_add
    // surfaces an error.
    addTextOverLimitIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'a'.repeat(Number(maxLengthBytes) + 1) }))
        assertEq(resultOf(resp).isError, true)
        assert(textOf(resp).includes('too large or malformed'))
    },

    // Exactly maxLengthBytes (131,072) ASCII bytes — tryUtf8 returns a non-null
    // Vec (len === maxLength, not over), so cas_add stores cleanly.
    addTextAtLimitSucceeds: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'a'.repeat(Number(maxLengthBytes)) }))
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    // base64 of exactly maxLengthBytes — currently returns isError because
    // base64Decode measures the raw pre-trim body (1_048_578 bits) against
    // maxLength before stripping the 2 padding bits that would land it exactly at
    // maxLength. Assert the current failing behavior; flip to a success assertion
    // once `fs/base64/todo/decode-rejects-max-size-input.md` is fixed.
    addBase64AtLimitIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: base64OfA(maxLengthBytes), type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
        assert(textOf(resp).includes('too large or malformed'))
    },

    getUnterminatedHashIsError: () => {
        const [resp] = session(call(2, 'cas_get', { hash: '0' }))
        assertEq(resultOf(resp).isError, true)
    },

    addMissingContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', {}))
        assertEq(resultOf(resp).isError, true)
    },

    getMissingHashArgumentIsError: () => {
        const [resp] = session(call(2, 'cas_get', {}))
        assertEq(resultOf(resp).isError, true)
    },

    getInvalidHashIsError: () => {
        const [resp] = session(call(2, 'cas_get', { hash: 'not valid!' }))
        assertEq(resultOf(resp).isError, true)
    },

    getMissingHashIsError: () => {
        const absent = vecToCBase32(vec8(0x99n))
        const [resp] = session(call(2, 'cas_get', { hash: absent }))
        assertEq(resultOf(resp).isError, true)
    },

    unknownToolIsError: () => {
        const [resp] = session(call(2, 'cas_remove', { hash: binarySample }))
        assertEq(resultOf(resp).isError, true)
    },

    toolErrorIsNotJsonRpcError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!', type: 'base64' }))
        assert(!('error' in (resp as object)))
        assert('result' in (resp as object))
    },

    // cas_add with type:'url' streams a file from /home/user/cas_upload/ into CAS.
    addUrlStoresFileAndReturnsHash: () => {
        const fileContent = utf8('hello from file')
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'hello.txt': [fileContent] } } } }
        const [addUrlResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/hello.txt', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(addUrlResp).isError)
        assert(textOf(addUrlResp).length > 0)
    },

    addUrlRoundTrips: () => {
        const fileContent = utf8('round-trip content')
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'rt.txt': [fileContent] } } } }
        // First pass: add to get the hash (deterministic for same content).
        const [addResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/rt.txt', type: 'url' }),
        ]).slice(2)
        const hash = textOf(addResp)
        // Second pass: add again + get in one session (file re-present in fresh virtual state).
        const [, getResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/rt.txt', type: 'url' }),
            call(3, 'cas_get', { hash, content: true }),
        ]).slice(2)
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.content, 'round-trip content')
    },

    addUrlMissingFileIsError: () => {
        const [resp] = runSessionVirtual({})([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/nonexistent.txt', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        assertEq(resultOf(resp).isError, true)
    },

    // cas_get without content:true returns only metadata.
    getMetaReturnsLengthAndMimeType: () => {
        const fileContent = utf8('text content')
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'f': [fileContent] } } } }
        // First pass: add to get the hash.
        const [addResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/f', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        const hash = textOf(addResp)
        // Second pass: add + get metadata.
        const [, metaResp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/f', type: 'url' }),
            call(3, 'cas_get', { hash }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as CasGetResult
        assertEq(meta.mime_type, 'text/plain')
        assertEq(meta.type, 'text')
        assertEq(meta.length, 12)
        assertEq(meta.content, undefined)
    },

    getMetaBinaryBlob: () => {
        const [addResp] = session(call(2, 'cas_add', { content: pngSample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: pngSample, type: 'base64' }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as CasGetResult
        assertEq(meta.mime_type, 'image/png')
        assertEq(meta.type, 'base64')
        assertEq(meta.length, 10)
        assertEq(meta.content, undefined)
    },

    getMetaOctetStreamForUnknownBinary: () => {
        const binaryContent = u8ListToVec(msb)([0xFF, 0xFE, 0x00, 0x01])
        const binaryB64 = base64Encode(binaryContent) as string
        const [addResp] = session(call(2, 'cas_add', { content: binaryB64, type: 'base64' }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: binaryB64, type: 'base64' }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as CasGetResult
        assertEq(meta.mime_type, 'application/octet-stream')
        assertEq(meta.type, 'base64')
        assertEq(meta.content, undefined)
    },

    // A NUL-bearing blob is valid UTF-8 yet binary: cas_get must report
    // base64/octet-stream, not text/plain.
    getMetaOctetStreamForNulBlob: () => {
        const nulContent = u8ListToVec(msb)([0x00, 0x00, 0x00])
        const nulB64 = base64Encode(nulContent) as string
        const [addResp] = session(call(2, 'cas_add', { content: nulB64, type: 'base64' }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: nulB64, type: 'base64' }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as CasGetResult
        assertEq(meta.mime_type, 'application/octet-stream')
        assertEq(meta.type, 'base64')
    },

    getMetaMissingHashIsError: () => {
        const absent = vecToCBase32(vec8(0x77n))
        const [resp] = session(call(2, 'cas_get', { hash: absent }))
        assertEq(resultOf(resp).isError, true)
    },

    getMetaInvalidHashIsError: () => {
        const [resp] = session(call(2, 'cas_get', { hash: 'bad!' }))
        assertEq(resultOf(resp).isError, true)
    },

    // cas_add type:'url' with a subdirectory path flattens slashes to '-' in staging.
    addUrlFromSubdirectorySucceeds: () => {
        const fileContent = utf8('nested file content')
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'subdir': { 'file.txt': [fileContent] } } } } }
        const [resp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/subdir/file.txt', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    // cas_add with type:'url' accepts paths within /home/user/cas_upload/
    addUrlFromApprovedDirectorySucceeds: () => {
        const fileContent = utf8('approved file')
        const root: Dir = { 'home': { 'user': { 'cas_upload': { 'test.txt': [fileContent] } } } }
        const [resp] = runSessionVirtual(root)([
            init, initialized,
            call(2, 'cas_add', { content: '/home/user/cas_upload/test.txt', type: 'url' }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    // cas_add with type:'url' rejects paths outside /home/user/cas_upload/
    addUrlFromRandomDirectoryIsRejected: () => {
        const [resp] = session(call(2, 'cas_add', { content: '/tmp/secret.txt', type: 'url' }))
        assert(resultOf(resp).isError === true)
        assert(textOf(resp).includes('/home/user/cas_upload/'))
    },

    // cas_add with type:'url' rejects path traversal attempts with ..
    addUrlWithPathTraversalIsRejected: () => {
        const [resp] = session(call(2, 'cas_add', { content: '/home/user/cas_upload/../../etc/passwd', type: 'url' }))
        assert(resultOf(resp).isError === true)
        assert(textOf(resp).includes('/home/user/cas_upload/'))
    },

    // cas_get with content:true on octet-stream (no magic bytes, not UTF-8) returns inline base64.
    getOctetStreamWithContentIncludesBase64: () => {
        const binaryContent = u8ListToVec(msb)([0xFF, 0xFE, 0x00, 0x01])
        const binaryB64 = base64Encode(binaryContent) as string
        const [addResp] = session(call(2, 'cas_add', { content: binaryB64, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: binaryB64, type: 'base64' }),
            call(3, 'cas_get', { hash, content: true }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.mime_type, 'application/octet-stream')
        assertEq(result.type, 'base64')
        assertEq(result.content, binaryB64)
    },
}
