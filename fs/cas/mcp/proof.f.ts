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
import { cas, type KvStore } from '../module.f.ts'
import {
    mcpStep, uninitializedState, type McpSessionState, type ToolsCallResult,
} from '../../mcp/module.f.ts'
import { casConfig, casMcpHandlers } from './module.f.ts'

// ── Memory mock (mirrors fs/mcp/proof.f.ts) ─────────────────────────────────────

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

const initial: MemoryState = { next: 0, values: {} }

const mock: MemOperationMap<MemOp, MemoryState> = {
    memCreate: value => state => {
        const id = `k${state.next}`
        const key: Key<unknown> = asNominal(id)
        return [{ next: state.next + 1, values: { ...state.values, [id]: value } }, key]
    },
    memRead: key => state => [state, state.values[asBase(key)]],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        return [{ ...state, values: { ...state.values, [id]: value } }, undefined]
    },
}

const runMem = <T>(effect: Effect<MemOp, T>): T => run(mock)(initial)(effect)[1]

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
    (step: (v: Unknown) => Effect<MemOp, Response | null>) =>
    (msgs: readonly unknown[]): Effect<MemOp, readonly unknown[]> => {
        const go = (i: number, acc: readonly unknown[]): Effect<MemOp, readonly unknown[]> =>
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
                const step = mcpStep<MemOp>(casConfig)(casMcpHandlers(c))(sessionKey)
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

type BlobResource = { readonly uri: string, readonly mimeType?: string, readonly blob: string }

const resourceOf = (resp: unknown): BlobResource =>
    (item0(resp) as { readonly type: string, readonly resource: BlobResource }).resource

// A valid base64 payload to store and round-trip.
const sample = base64Encode(vec8(0x2An)) as string

// A base64 blob whose leading bytes are the PNG magic-byte signature, so
// `cas_get` detects its type and returns an EmbeddedResource.
const pngSample = base64Encode(
    u8ListToVec(msb)([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])) as string

// ── Tests ───────────────────────────────────────────────────────────────────────

export const proof = {
    toolsListAdvertisesThreeTools: () => {
        const [resp] = runSession([init, initialized, list(2)]).slice(2)
        const tools = (resp as { result: { tools: readonly { name: string }[] } }).result.tools
        assertEq(tools.length, 3)
        assertEq(tools.map(t => t.name).join(','), 'cas_add,cas_get,cas_list')
        // Each tool advertises an object inputSchema derived from its rtti args.
        const add = (resp as { result: { tools: readonly { inputSchema: { type?: string } }[] } }).result.tools[0]
        assertEq(add.inputSchema.type, 'object')
    },

    addReturnsHash: () => {
        const [resp] = session(call(2, 'cas_add', { content: sample }))
        assert(!resultOf(resp).isError)
        assert(textOf(resp).length > 0)
    },

    addGetRoundTrips: () => {
        // First learn the hash from a standalone add...
        const [addResp] = session(call(2, 'cas_add', { content: sample }))
        const hash = textOf(addResp)
        // ...then add + get in one session so the store is shared.
        const [, getResp] = session(
            call(2, 'cas_add', { content: sample }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        assertEq(textOf(getResp), sample)
    },

    // Opaque bytes (no magic-byte match) come back as a plain text block.
    getUntypedReturnsText: () => {
        const [addResp] = session(call(2, 'cas_add', { content: sample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: sample }),
            call(3, 'cas_get', { hash }),
        )
        assertEq(item0(getResp) === null ? null : (item0(getResp) as { type: string }).type, 'text')
        assertEq(textOf(getResp), sample)
    },

    // Bytes with a recognised PNG signature come back as an EmbeddedResource
    // carrying the mimeType, the base64 blob, and a cas:// URI.
    getTypedReturnsEmbeddedResource: () => {
        const [addResp] = session(call(2, 'cas_add', { content: pngSample }))
        const hash = textOf(addResp)
        const [, getResp] = session(
            call(2, 'cas_add', { content: pngSample }),
            call(3, 'cas_get', { hash }),
        )
        assert(!resultOf(getResp).isError)
        assertEq((item0(getResp) as { type: string }).type, 'resource')
        const resource = resourceOf(getResp)
        assertEq(resource.mimeType, 'image/png')
        assertEq(resource.blob, pngSample)
        assertEq(resource.uri, `cas://sha256/${hash}`)
    },

    listEnumeratesStoredHashes: () => {
        const [addResp, listResp] = session(
            call(2, 'cas_add', { content: sample }),
            call(3, 'cas_list', {}),
        )
        const hash = textOf(addResp)
        assert(!resultOf(listResp).isError)
        assertEq(textOf(listResp), hash)
    },

    addInvalidContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!' }))
        assertEq(resultOf(resp).isError, true)
    },

    // base64 length must be a multiple of 4 — a single character is malformed.
    addBadLengthContentIsError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'A' }))
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
        const [resp] = session(call(2, 'cas_remove', { hash: sample }))
        assertEq(resultOf(resp).isError, true)
    },

    // Tool failures are in-band results, never JSON-RPC errors.
    toolErrorIsNotJsonRpcError: () => {
        const [resp] = session(call(2, 'cas_add', { content: 'not valid!' }))
        assert(!('error' in (resp as object)))
        assert('result' in (resp as object))
    },
}
