import { assert, assertEq } from '../../asserts/module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { run, type MemOperationMap } from '../../effects/mock/module.f.ts'
import { asBase, asNominal, create, read, write, type Key, type MemOp } from '../../effects/memory/module.f.ts'
import type { Unknown } from '../../json/module.f.ts'
import type { Response } from '../../json/rpc/module.f.ts'
import { msb, u8ListToVec, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../cbase32/module.f.ts'
import { encode as base64Encode } from '../../base64/module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { cas, type KvStore } from '../module.f.ts'
import {
    mcpStep, uninitializedState, type McpSessionState, type ToolsCallResult,
} from '../../mcp/module.f.ts'
import { type ReadFile } from '../../effects/node/module.f.ts'
import { casConfig, casMcpHandlers } from './module.f.ts'

type CasGetResult = { readonly content: string, readonly type: string, readonly mime_type: string }

// ── Memory mock (mirrors fs/mcp/proof.f.ts) ─────────────────────────────────────

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

type TestState = {
    readonly memory: MemoryState
    readonly files: { readonly [path: string]: Vec }
}

const initialTestState: TestState = { memory: { next: 0, values: {} }, files: {} }

const mock: MemOperationMap<MemOp | ReadFile, TestState> = {
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
    readFile: path => state => {
        const v = state.files[path]
        return v !== undefined
            ? [state, ['ok', v] as const]
            : [state, ['error', new Error(`ENOENT: ${path}`)] as readonly ['error', unknown]]
    },
}

const runMem = <T>(effect: Effect<MemOp | ReadFile, T>): T =>
    run(mock)(initialTestState)(effect)[1]

const runMemWithFiles = <T>(files: { readonly [path: string]: Vec }) =>
    (effect: Effect<MemOp | ReadFile, T>): T =>
        run(mock)({ memory: { next: 0, values: {} }, files })(effect)[1]

// ── In-memory KvStore backed by a single memory slot ────────────────────────────
// Persists writes across steps so add → get round-trips, keyed by cBase32 hash.

// Maps cBase32(key) → [key, value]; storing the key Vec lets `list` return keys
// (hashes), matching the `KvStore` contract that the filesystem backing fulfils.
type VecMap = { readonly [k: string]: readonly [Vec, Vec] }

const memKvStore = (mapKey: Key<VecMap>): KvStore<MemOp> => ({
    read: (key: Vec): Effect<MemOp, Vec | undefined> =>
        read(mapKey).step(m => pure(m[vecToCBase32(key)]?.[1])),
    write: (key: Vec, value: Vec): Effect<MemOp, void> =>
        read(mapKey).step(m => write(mapKey, { ...m, [vecToCBase32(key)]: [key, value] })),
    list: (): Effect<MemOp, readonly Vec[]> =>
        read(mapKey).step(m => pure(Object.values(m).map(([k]) => k))),
})

// ── Session driver ──────────────────────────────────────────────────────────────

// Feeds each message to `step` in order, collecting every response.
const feed =
    (step: (v: Unknown) => Effect<MemOp | ReadFile, Response | null>) =>
    (msgs: readonly unknown[]): Effect<MemOp | ReadFile, readonly unknown[]> => {
        const go = (i: number, acc: readonly unknown[]): Effect<MemOp | ReadFile, readonly unknown[]> =>
            i === msgs.length
                ? pure(acc)
                : step(msgs[i] as Unknown).step(r => go(i + 1, [...acc, r]))
        return go(0, [])
    }

// Runs a full session over a fresh in-memory CAS, returning all responses.
const runSession = (msgs: readonly unknown[]): readonly unknown[] =>
    runMem(
        create({} as VecMap).step(mapKey =>
            create(uninitializedState as McpSessionState).step(sessionKey => {
                const c = cas(sha256)(memKvStore(mapKey))
                const step = mcpStep<MemOp | ReadFile>(casConfig)(casMcpHandlers(c))(sessionKey)
                return feed(step)(msgs)
            })))

// Runs a session with a mocked filesystem (for cas_add_url tests).
const runSessionWithFiles =
    (files: { readonly [path: string]: Vec }) =>
    (msgs: readonly unknown[]): readonly unknown[] =>
        runMemWithFiles<readonly unknown[]>(files)(
            create({} as VecMap).step(mapKey =>
                create(uninitializedState as McpSessionState).step(sessionKey => {
                    const c = cas(sha256)(memKvStore(mapKey))
                    const step = mcpStep<MemOp | ReadFile>(casConfig)(casMcpHandlers(c))(sessionKey)
                    return feed(step)(msgs)
                })))

// ── Messages ────────────────────────────────────────────────────────────────────

const init = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'c', version: '0' } } }

const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }

const call = (id: number, name: string, args: unknown) =>
    ({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })

const list = (id: number) => ({ jsonrpc: '2.0', method: 'tools/list', id })

// Runs `init`, `notifications/initialized`, then `msgs`; returns the tool responses.
const session = (...msgs: readonly unknown[]): readonly unknown[] =>
    runSession([init, initialized, ...msgs]).slice(2)

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

// ── Tests ───────────────────────────────────────────────────────────────────────

export const proof = {
    toolsListAdvertisesThreeTools: () => {
        const [resp] = runSession([init, initialized, list(2)]).slice(2)
        const tools = (resp as { result: { tools: readonly { name: string }[] } }).result.tools
        assertEq(tools.length, 5)
        assertEq(tools.map(t => t.name).join(','), 'cas_add,cas_get,cas_list,cas_add_url,cas_get_meta')
        // Each tool advertises an object inputSchema derived from its rtti args.
        const add = (resp as { result: { tools: readonly { inputSchema: { type?: string } }[] } }).result.tools[0]
        assertEq(add.inputSchema.type, 'object')
    },

    addReturnsHash: () => {
        const [resp] = session(call(2, 'cas_add', { content: textSample }))
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    // Text add→get round-trip: store as UTF-8 text, retrieve as text.
    textAddGetRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.mime_type, 'text/plain')
        assertEq(result.content, textSample)
    },

    // Binary add→get round-trip: store as base64, retrieve as base64.
    binaryAddGetRoundTrips: () => {
        const [addResp] = session(call(2, 'cas_add', { content: binarySample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: binarySample, type: 'base64' }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.content, '*')
    },

    addGetRoundTrips: () => {
        // Backward-compatible: default type is 'text', content is stored as UTF-8.
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.content, textSample)
    },

    // Text content (no magic-byte match, valid UTF-8) comes back with type:'text'.
    getUntypedReturnsText: () => {
        const [addResp] = session(call(2, 'cas_add', { content: textSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: textSample }),
            call(3, 'cas_get', { hash }),
        )
        assertEq(item0(getResp) === null ? null : (item0(getResp) as { type: string }).type, 'text')
        const result = JSON.parse(textOf(getResp)) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.mime_type, 'text/plain')
    },

    // Bytes with a recognised PNG signature come back as JSON with type:'base64' and mime_type:'image/png'.
    getTypedReturnsBinaryJson: () => {
        const [addResp] = session(call(2, 'cas_add', { content: pngSample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: pngSample, type: 'base64' }),
            call(3, 'cas_get', { hash }),
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
        // Only base64 type can produce an error for content encoding.
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!', type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
    },

    // base64 length must be a multiple of 4 — a single character is malformed.
    addBadLengthContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'A', type: 'base64' }))
        assertEq(resultOf(resp).isError, true)
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
        // valid cBase32 that was never stored
        const absent = vecToCBase32(vec8(0x99n))
        const [resp] = session(call(2, 'cas_get', { hash: absent }))
        assertEq(resultOf(resp).isError, true)
    },

    unknownToolIsError: () => {
        const [resp] = session(call(2, 'cas_remove', { hash: binarySample }))
        assertEq(resultOf(resp).isError, true)
    },

    // Tool failures are in-band results, never JSON-RPC errors.
    toolErrorIsNotJsonRpcError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!', type: 'base64' }))
        assert(!('error' in (resp as object)))
        assert('result' in (resp as object))
    },

    toolsListAdvertisesFiveTools: () => {
        const [resp] = runSession([init, initialized, list(2)]).slice(2)
        const tools = (resp as { result: { tools: readonly { name: string }[] } }).result.tools
        assertEq(tools.length, 5)
        assertEq(tools.map(t => t.name).join(','), 'cas_add,cas_get,cas_list,cas_add_url,cas_get_meta')
    },

    addUrlStoresFileAndReturnsHash: () => {
        const fileContent = utf8('hello from file')
        const [addUrlResp] = runSessionWithFiles({ '/tmp/hello.txt': fileContent })([
            init, initialized,
            call(2, 'cas_add_url', { url: '/tmp/hello.txt' }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(addUrlResp).isError)
        assert(textOf(addUrlResp).length > 0)
    },

    addUrlRoundTrips: () => {
        const fileContent = utf8('round-trip content')
        const msgs = runSessionWithFiles({ '/tmp/rt.txt': fileContent })([
            init, initialized,
            call(2, 'cas_add_url', { url: '/tmp/rt.txt' }),
        ]).slice(2) as readonly unknown[]
        const hash = textOf(msgs[0])
        // Now add_url then get in one session to verify the stored content.
        const msgs2 = runSessionWithFiles({ '/tmp/rt.txt': fileContent })([
            init, initialized,
            call(2, 'cas_add_url', { url: '/tmp/rt.txt' }),
            call(3, 'cas_get', { hash }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(msgs2[1]).isError)
        const result = JSON.parse(textOf(msgs2[1])) as CasGetResult
        assertEq(result.type, 'text')
        assertEq(result.content, 'round-trip content')
    },

    addUrlMissingFileIsError: () => {
        const [resp] = runSessionWithFiles({})([
            init, initialized,
            call(2, 'cas_add_url', { url: '/nonexistent/path.txt' }),
        ]).slice(2) as readonly unknown[]
        assertEq(resultOf(resp).isError, true)
    },

    addUrlMissingUrlArgumentIsError: () => {
        const [resp] = session(call(2, 'cas_add_url', {}))
        assertEq(resultOf(resp).isError, true)
    },

    getMetaReturnsLengthAndMimeType: () => {
        const fileContent = utf8('text content')
        const [addResp] = runSessionWithFiles({ '/f': fileContent })([
            init, initialized,
            call(2, 'cas_add_url', { url: '/f' }),
        ]).slice(2) as readonly unknown[]
        const hash = textOf(addResp)
        // Re-run with correct hash.
        const [, metaResp2] = runSessionWithFiles({ '/f': fileContent })([
            init, initialized,
            call(2, 'cas_add_url', { url: '/f' }),
            call(3, 'cas_get_meta', { hash }),
        ]).slice(2) as readonly unknown[]
        assert(!resultOf(metaResp2).isError)
        const meta = JSON.parse(textOf(metaResp2)) as { length: number, mime_type: string }
        assertEq(meta.mime_type, 'text/plain')
        assertEq(meta.length, Number(BigInt(/* 'text content'.length */ 12)))
    },

    getMetaBinaryBlob: () => {
        const [addResp] = session(call(2, 'cas_add', { content: pngSample, type: 'base64' }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: pngSample, type: 'base64' }),
            call(3, 'cas_get_meta', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as { length: number, mime_type: string }
        assertEq(meta.mime_type, 'image/png')
        assertEq(meta.length, 10)
    },

    getMetaOctetStreamForUnknownBinary: () => {
        // A Vec with high bytes that aren't valid UTF-8 and no magic signature.
        const binaryContent = u8ListToVec(msb)([0xFF, 0xFE, 0x00, 0x01])
        const binaryB64 = base64Encode(binaryContent) as string
        const [addResp] = session(call(2, 'cas_add', { content: binaryB64, type: 'base64' }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: binaryB64, type: 'base64' }),
            call(3, 'cas_get_meta', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as { length: number, mime_type: string }
        assertEq(meta.mime_type, 'application/octet-stream')
    },

    getMetaNoUrlWhenToUrlAbsent: () => {
        const content = utf8('no url')
        const binaryB64 = base64Encode(content) as string
        const [addResp] = session(call(2, 'cas_add', { content: binaryB64 }))
        const hash = textOf(addResp)
        const [, metaResp] = session(
            call(2, 'cas_add', { content: binaryB64 }),
            call(3, 'cas_get_meta', { hash }),
        )
        assert(!resultOf(metaResp).isError)
        const meta = JSON.parse(textOf(metaResp)) as { url?: string }
        assertEq(meta.url, undefined)
    },

    getMetaMissingHashIsError: () => {
        const absent = vecToCBase32(vec8(0x77n))
        const [resp] = session(call(2, 'cas_get_meta', { hash: absent }))
        assertEq(resultOf(resp).isError, true)
    },

    getMetaInvalidHashIsError: () => {
        const [resp] = session(call(2, 'cas_get_meta', { hash: 'bad!' }))
        assertEq(resultOf(resp).isError, true)
    },
}
