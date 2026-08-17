/**
 * DJS parser that builds structured trees from DJS tokens.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { DjsToken, DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { AstArray, AstConst, AstModule, AstModuleRef } from '../ast/types.ts'
 * @import { TokenMetadata } from '../../js/tokenizer/types.ts'
 * @import { ParseError, _ValueToken } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { fold, next, toArray, length, concat } from '../../types/list/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { fromMap } from '../../types/object/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

/** @typedef {['array', List<AstConst>]} _DjsStackArray */

/** @typedef {['object', OrderedMap<AstConst>, string]} _DjsStackObject */

/** @typedef {_DjsStackArray | _DjsStackObject} _DjsStackElement */

/** @typedef {List<_DjsStackElement>} _DjsStack */

/** @typedef {_InitialState | _NewLineRequiredState | _ImportState | _ConstState | _ExportState | _ParseValueState | _ResultState | _ErrorState} _ParserState */

/** @typedef {{
 *   readonly refs: OrderedMap<AstModuleRef>
 *   readonly modules: List<string>
 *   readonly consts: List<AstConst>
 * }} _ModuleState */

/** @typedef {{
 *   readonly state: ''
 *   readonly module: _ModuleState
 * }} _InitialState */

/** @typedef {{
 *   readonly state: 'nl'
 *   readonly module: _ModuleState
 * }} _NewLineRequiredState */

/** @typedef {{
 *   readonly state: 'import' | 'import+name' | 'import+from'
 *   readonly module: _ModuleState
 * }} _ImportState */

/** @typedef {{
 *   readonly state: 'const' | 'const+name'
 *   readonly module: _ModuleState
 * }} _ConstState */

/** @typedef {{
 *   readonly state: 'export'
 *   readonly module: _ModuleState
 * }} _ExportState */

/**
 * Where the value parser stands inside the value it is reading.
 *
 * The object states spell a property out left to right: `'{'` expects a key,
 * `'{k'` the `:` after one, `'{:'` the value, `'{v'` the `,` or `}` after it,
 * and `'{,'` the next key. A computed key `["a"]` takes the two extra steps
 * `'{['` (the string inside the brackets) and `'{[k'` (the closing `]`), then
 * rejoins the plain path at `'{k'`.
 *
 * @typedef {'' | '[' | '[v' | '[,' | '{' | '{[' | '{[k' | '{k' | '{:' | '{v' | '{,'} _ValueState
 */

/** @typedef {{
 *   readonly state: 'constValue' | 'exportValue'
 *   readonly module: _ModuleState
 *   readonly valueState: _ValueState
 *   readonly top: _DjsStackElement | null
 *   readonly stack: _DjsStack
 * }} _ParseValueState */

/** @typedef {{
 *   readonly state: 'result'
 *   readonly module: _ModuleState
 * }} _ResultState */

/** @typedef {{
 *   readonly state: 'error'
 *   readonly error: ParseError
 * }} _ErrorState */

/** @type {(token: DjsTokenWithMetadata) => (state: _InitialState) => _ParserState} */
const parseInitialOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            switch (token.value) {
                case 'import': return { ...state, state: 'import' }
                case 'const': return { ...state, state: 'const' }
                case 'export': return { ...state, state: 'export' }
            }
        }
    }
    return foldOp({ token, metadata })({ ...state, state: 'exportValue', valueState: '', top: null, stack: null })
}

/** @type {(token: DjsTokenWithMetadata) => (state: _NewLineRequiredState) => _ParserState} */
const parseNewLineRequiredOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case '//':
        case '/*': return state
        case 'nl': return { ...state, state: '' }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ExportState) => _ParserState} */
const parseExportOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        case 'id': {
            if (token.value === 'default') return { ...state, state: 'exportValue', valueState: '', top: null, stack: null }
        }
    }
    return { state: 'error', error: { message: 'unexpected token', metadata } }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ResultState) => _ParserState} */
const parseResultOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*':
        case 'eof': return state
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ConstState) => _ParserState} */
const parseConstOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null)
                return { state: 'error', error: { message: 'duplicate id', metadata } }
            /** @type {AstModuleRef} */
            const cref = ['cref', length(state.module.consts)]
            const refs = setReplace(token.value)(cref)(state.module.refs)
            return { ...state, state: 'const+name', module: { ...state.module, refs: refs } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ConstState) => _ParserState} */
const parseConstNameOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case '=': return { ...state, state: 'constValue', valueState: '', top: null, stack: null }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ImportState) => _ParserState} */
const parseImportOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null) {
                return { state: 'error', error: { message: 'duplicate id', metadata } }
            }
            /** @type {AstModuleRef} */
            const aref = ['aref', length(state.module.modules)]
            const refs = setReplace(token.value)(aref)(state.module.refs)
            return { ...state, state: 'import+name', module: { ...state.module, refs: refs } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ImportState) => _ParserState} */
const parseImportNameOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        case 'id': {
            if (token.value === 'from') return { ...state, state: 'import+from' }
        }
    }
    return { state: 'error', error: { message: 'unexpected token', metadata } }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ImportState) => _ParserState} */
const parseImportFromOp = ({ token, metadata }) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'string': {
            const modules = concat(state.module.modules)([token.value])
            return { ...state, state: 'nl', module: { ...state.module, modules: modules } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(obj: _DjsStackObject) => (key: string) => _DjsStackObject} */
const addKeyToObject = obj => key => (['object', obj[1], key])

/** @type {(obj: _DjsStackObject) => (value: AstConst) => _DjsStackObject} */
const addValueToObject = obj => value => (['object', setReplace(obj[2])(value)(obj[1]), ''])

/** @type {(array: _DjsStackArray) => (value: AstConst) => _DjsStackArray} */
const addToArray = array => value => (['array', concat(array[1])([value])])

/**
 * The key of `{ __proto__: v }` and `{ "__proto__": v }`. JavaScript reads
 * both as an instruction to replace the object's prototype instead of as a
 * property, so FunctionalScript rejects them and accepts only the computed
 * spelling `{ ["__proto__"]: v }`, which denotes an ordinary property.
 * See [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md).
 */
const protoKey = '__proto__'

/** @type {(valueState: _ValueState) => (state: _ParseValueState) => (key: string) => (metadata: TokenMetadata) => _ParserState} */
const pushKey = valueState => state => key => metadata => {
    if (state.top?.[0] === 'object') { return { ...state, valueState, top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', error: { message: 'error', metadata } }
}

/**
 * A key written as an identifier or a string literal, which is every key but
 * the computed one — so this is where `__proto__` is refused.
 *
 * @type {(state: _ParseValueState) => (key: string) => (metadata: TokenMetadata) => _ParserState}
 */
const pushPlainKey = state => key => metadata => key === protoKey
    ? { state: 'error', error: { message: '__proto__ requires the computed key form', metadata } }
    : pushKey('{k')(state)(key)(metadata)

/** @type {(state: _ParseValueState) => (value: AstConst) => _ParserState} */
const pushValue = state => value => {
    if (state.top === null) {
        const consts = concat(state.module.consts)([value])
        switch (state.state)
        {
            case 'exportValue': return { ...state, state: 'result', module: { ...state.module, consts: consts } }
            case 'constValue': return { ...state, state: 'nl', module: { ...state.module, consts: consts } }
        }
    }
    if (state.top?.[0] === 'array') { return { ...state, valueState: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { ...state, valueState: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: _ParseValueState) => (name: string) => (metadata: TokenMetadata) => _ParserState} */
const pushRef = state => name => metadata => {
    const ref = at(name)(state.module.refs)
    if (ref === null)
        return { state: 'error', error: { message: 'const not found', metadata } }
    return pushValue(state)(ref)
}

/** @type {(state: _ParseValueState) => _ParserState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ...state, valueState: '[', top: ['array', null], stack: newStack }
}

// Pops the enclosing container off `stack`. `next` is forced here rather than
// left as a `drop(1)` thunk: the stack is written only by startArray/startObject,
// always as a literal cons, and a lazy pop leaves one unforced thunk per closed
// container — a chain that overflows the call stack when it is finally forced.
/** @type {(state: _ParseValueState) => _ParseValueState} */
const popStack = state => {
    const ne = next(state.stack)
    return ne === null
        ? { ...state, valueState: '', top: null, stack: null }
        : { ...state, valueState: '', top: ne.first, stack: ne.tail }
}

/** @type {(state: _ParseValueState) => _ParserState} */
const endArray = state => {
    const top = state.top
    const newState = popStack(state)
    if (top !== null && top[0] === 'array')
    {
        /** @type {AstArray} */
        const array = ['array', toArray(top[1])]
        return pushValue(newState)(array)
    }
    return pushValue(newState)(null)
}

/** @type {(state: _ParseValueState) => _ParserState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ...state, valueState: '{', top: ['object', null, ''], stack: newStack }
}

/** @type {(state: _ParseValueState) => _ParserState} */
const endObject = state => {
    const obj = state?.top !== null && state?.top[0] === 'object' ? fromMap(state.top[1]) : null
    const newState = popStack(state)
    return pushValue(newState)(obj)
}

/**
 * Only ever called on a token `isValueToken` has already confirmed carries a
 * value, so the switch covers every `_ValueToken` case with no fallback arm.
 *
 * @type {(token: _ValueToken) => AstConst}
 */
const tokenToValue = token => {
    switch (token.kind) {
        case 'null': return null
        case 'false': return false
        case 'true': return true
        case 'number': return parseFloat(token.value)
        case 'string': return token.value
        case 'bigint': return token.value
        case 'undefined': return undefined
    }
}

/**
 * @param {DjsToken} token
 * @returns {token is _ValueToken}
 */
const isValueToken = token => {
    switch (token.kind) {
        case 'null':
        case 'false':
        case 'true':
        case 'number':
        case 'string':
        case 'bigint':
        case 'undefined': return true
        default: return false
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseValueOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case ']':
            if (state.valueState === '[,') { return endArray(state) }
            return { state: 'error', error: { message: 'unexpected token', metadata } }
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default:
            if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
            return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseArrayStartOp = ({ token, metadata }) => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case ']': return endArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseArrayValueOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case ']': return endArray(state)
        case ',': return { ...state, valueState: '[,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

// allow identifier property names (#2410)
/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectStartOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case 'string':
        case 'id':
            return pushPlainKey(state)(String(token.value))(metadata)
        case '[': return { ...state, valueState: '{[' }
        case '}': return endObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

// computed property keys with a constant string key (#2470)
/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectComputedKeyOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case 'string': return pushKey('{[k')(state)(token.value)(metadata)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectComputedKeyEndOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case ']': return { ...state, valueState: '{k' }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectKeyOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case ':': return { ...state, valueState: '{:', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectColonOp = ({ token, metadata }) => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectNextOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case ',': return { ...state, valueState: '{,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {(token: DjsTokenWithMetadata) => (state: _ParseValueState) => _ParserState} */
const parseObjectCommaOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case 'string':
        case 'id':
            return pushPlainKey(state)(String(token.value))(metadata)
        case '[': return { ...state, valueState: '{[' }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
        default: return { state: 'error', error: { message: 'unexpected token', metadata } }
    }
}

/** @type {Fold<DjsTokenWithMetadata, _ParserState>} */
const foldOp = token => state => {
    switch (state.state) {
        case '': return parseInitialOp(token)(state)
        case 'nl': return parseNewLineRequiredOp(token)(state)
        case 'import': return parseImportOp(token)(state)
        case 'import+name': return parseImportNameOp(token)(state)
        case 'import+from': return parseImportFromOp(token)(state)
        case 'const': return parseConstOp(token)(state)
        case 'const+name': return parseConstNameOp(token)(state)
        case 'export': return parseExportOp(token)(state)
        case 'result': return parseResultOp(token)(state)
        case 'error': return { state: 'error', error: state.error }
        case 'constValue':
        case 'exportValue':
        {
            switch (state.valueState)
            {
                case '': return parseValueOp(token)(state)
                case '[': return parseArrayStartOp(token)(state)
                case '[v': return parseArrayValueOp(token)(state)
                case '[,': return parseValueOp(token)(state)
                case '{': return parseObjectStartOp(token)(state)
                case '{[': return parseObjectComputedKeyOp(token)(state)
                case '{[k': return parseObjectComputedKeyEndOp(token)(state)
                case '{k': return parseObjectKeyOp(token)(state)
                case '{:': return parseObjectColonOp(token)(state)
                case '{v': return parseObjectNextOp(token)(state)
                case '{,': return parseObjectCommaOp(token)(state)
            }
        }
    }
}

/** @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>} */
export const parseFromTokens = tokenList => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null } })(tokenList)
    switch (state.state) {
        case 'result': return ok(/** @satisfies {AstModule} */ ([toArray(state.module.modules), toArray(state.module.consts)]))
        case 'error': return error(state.error)
        default: return error({ message: 'unexpected end', metadata: null })
    }
}

export const proof = {
    pushKey: {
        // `pushKey` is only ever invoked while `state.top` is an object (the
        // `'{'`/`'{,'` value-states guarantee it), so its non-object guard is
        // a defensive branch unreachable through `parseFromTokens`. Call it
        // directly to cover that branch.
        nonObjectTop: () => {
            /** @type {_ParseValueState} */
            const state = {
                state: 'exportValue',
                module: { refs: null, modules: null, consts: null },
                valueState: '[',
                top: null,
                stack: null,
            }
            const result = pushKey('{k')(state)('key')({ path: 'test', line: 0, column: 0 })
            assertEq(result.state, 'error')
        },
    },
    endArray: {
        // `endArray` is only ever invoked while `state.top` is an array (the
        // `'['`/`'[v'`/`'[,'` value-states guarantee it), so its non-array
        // guard is a defensive branch unreachable through `parseFromTokens`.
        // Call it directly to cover that branch.
        nonArrayTop: () => {
            /** @type {_ParseValueState} */
            const state = {
                state: 'exportValue',
                module: { refs: null, modules: null, consts: null },
                valueState: '[,',
                top: null,
                stack: null,
            }
            const result = endArray(state)
            assertEq(result.state, 'result')
        },
    },
    endObject: {
        // `endObject` is only ever invoked while `state.top` is an object
        // (the `'{'`/`'{k'`/`'{:'`/`'{v'`/`'{,'` value-states guarantee it),
        // so its non-object guard is a defensive branch unreachable through
        // `parseFromTokens`. Call it directly to cover that branch.
        nonObjectTop: () => {
            /** @type {_ParseValueState} */
            const state = {
                state: 'exportValue',
                module: { refs: null, modules: null, consts: null },
                valueState: '{,',
                top: null,
                stack: null,
            }
            const result = endObject(state)
            assertEq(result.state, 'result')
        },
    },
}
