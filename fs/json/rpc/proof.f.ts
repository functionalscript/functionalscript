import { assert, assertEq } from '../../asserts/module.f.ts'
import { ok, error } from '../../types/result/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import {
    error as errorSchema,
    decodeRequest,
    dispatch,
    rpcError,
    parseError,
    invalidRequest,
    methodNotFound,
    invalidParams,
    internalError,
    type Handlers,
} from './module.f.ts'

const isOk = (r: readonly [string, unknown]): boolean => r[0] === 'ok'

const handlers: Handlers = {
    ping: () => ok('pong'),
    echo: params => ok(params ?? null),
    boom: () => error(invalidParams),
}
const d = dispatch(handlers)

export const proof = {
    schema: {
        request: {
            full: () => assert(isOk(decodeRequest({ jsonrpc: '2.0', method: 'm', params: [1], id: 1 }))),
            notification: () => assert(isOk(decodeRequest({ jsonrpc: '2.0', method: 'm' }))),
            nullId: () => assert(isOk(decodeRequest({ jsonrpc: '2.0', method: 'm', id: null }))),
            stringId: () => assert(isOk(decodeRequest({ jsonrpc: '2.0', method: 'm', id: 'abc' }))),
            badVersion: () => assert(!isOk(decodeRequest({ jsonrpc: '1.0', method: 'm', id: 1 }))),
            missingMethod: () => assert(!isOk(decodeRequest({ jsonrpc: '2.0', id: 1 }))),
            badId: () => assert(!isOk(decodeRequest({ jsonrpc: '2.0', method: 'm', id: true }))),
            notObject: () => assert(!isOk(decodeRequest(42))),
        },
        error: {
            ok: () => assert(isOk(validate(errorSchema)({ code: -1, message: 'x' }))),
            withData: () => assert(isOk(validate(errorSchema)({ code: -1, message: 'x', data: [1, 2] }))),
            missingMessage: () => assert(!isOk(validate(errorSchema)({ code: -1 }))),
        },
    },
    errors: {
        factory: () => {
            const e = rpcError(-7)('boom')
            assertEq(e.code, -7)
            assertEq(e.message, 'boom')
        },
        parseError: () => { assertEq(parseError.code, -32700); assertEq(parseError.message, 'Parse error') },
        invalidRequest: () => { assertEq(invalidRequest.code, -32600); assertEq(invalidRequest.message, 'Invalid Request') },
        methodNotFound: () => { assertEq(methodNotFound.code, -32601); assertEq(methodNotFound.message, 'Method not found') },
        invalidParams: () => { assertEq(invalidParams.code, -32602); assertEq(invalidParams.message, 'Invalid params') },
        internalError: () => { assertEq(internalError.code, -32603); assertEq(internalError.message, 'Internal error') },
    },
    dispatch: {
        success: () => {
            const r = d({ jsonrpc: '2.0', method: 'ping', id: 1 })
            assert(r !== null && 'result' in r && r.result === 'pong' && r.id === 1)
        },
        paramsPassed: () => {
            const r = d({ jsonrpc: '2.0', method: 'echo', params: 'hi', id: 2 })
            assert(r !== null && 'result' in r && r.result === 'hi')
        },
        handlerError: () => {
            const r = d({ jsonrpc: '2.0', method: 'boom', id: 3 })
            assert(r !== null && 'error' in r && r.error.code === -32602 && r.id === 3)
        },
        methodNotFound: () => {
            const r = d({ jsonrpc: '2.0', method: 'nope', id: 4 })
            assert(r !== null && 'error' in r && r.error.code === -32601)
        },
        invalidRequest: () => {
            const r = d({ jsonrpc: '1.0', method: 'ping', id: 5 })
            assert(r !== null && 'error' in r && r.error.code === -32600 && r.id === null)
        },
        notification: () => {
            const r = d({ jsonrpc: '2.0', method: 'ping' })
            assertEq(r, null)
        },
    },
}
