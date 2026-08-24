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
 * @import { AstArray, AstConst, AstModule, AstModuleRef, AstObject } from '../ast/types.ts'
 * @import { TokenMetadata } from '../../js/tokenizer/types.ts'
 * @import { ParseError, _FramingKeyword, _OrdinaryTokenName, _ValueToken } from './types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { CodePointMeta } from '../../bnf/descent/types.ts'
 * @import { Ast, AstSequence } from '../../bnf/matcher/types.ts'
 * @import { Rule, TerminalRange } from '../../bnf/types.ts'
 * @import { DescentMatch } from '../../bnf/descent/types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { fold, next, toArray, length, concat } from '../../types/list/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { fromMap } from '../../types/object/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { eof, oneEncode, option, rangeDecode, repeat0Plus, unicodeRange } from '../../bnf/module.f.mjs'
import { encoding } from '../../bnf/token_symbol/module.f.mjs'
import { toData } from '../../bnf/data/module.f.mjs'
import { descentParserRuleSet } from '../../bnf/descent/module.f.mjs'

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

/**
 * A statement begins with `import`, `const`, or `export` and with nothing
 * else. The three are a whitelist that grows as the language does, not a
 * closed set; what a statement may never begin with is a **value**. A text
 * that does — `42`, `[1,2]`, `{"a":1}` — is a JSON document, and reading it
 * as a module would give it a value no JavaScript engine gives it: as
 * JavaScript `{"a":1}` does not parse at all, and `[1,2]` is an expression
 * statement exporting nothing.
 *
 * The statements are also ordered: every `import` precedes every `const`, and
 * `export default` ends the module. `eof` here is a module with no
 * `export default`, which is what "unexpected end" reports.
 *
 * @type {(token: DjsTokenWithMetadata) => (state: _InitialState) => _ParserState}
 */
const parseInitialOp = ({ token, metadata }) => state => {
    switch (token.kind)
    {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            switch (token.value) {
                case 'import': return length(state.module.consts) === 0
                    ? { ...state, state: 'import' }
                    : { state: 'error', error: { message: 'import must come before const', metadata } }
                case 'const': return { ...state, state: 'const' }
                case 'export': return { ...state, state: 'export' }
            }
            break
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata } }
    }
    return { state: 'error', error: { message: 'unexpected token', metadata } }
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
 * See [spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key).
 */
const protoKey = '__proto__'

/** @type {(valueState: _ValueState) => (state: _ParseValueState) => (key: string) => (metadata: TokenMetadata) => _ParserState} */
const pushKey = valueState => state => key => metadata => {
    if (state.top?.[0] === 'object') { return { ...state, valueState, top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', error: { message: 'error', metadata } }
}

/**
 * A key written as an identifier or a string literal, which is every key but
 * the computed one — so this is where `__proto__` is refused. A JSON document
 * spells that key the same way and means an ordinary property by it, but a
 * JSON document is not a module and this parser does not read one
 * ([spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key)).
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
            return pushPlainKey(state)(token.value)(metadata)
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
            return pushPlainKey(state)(token.value)(metadata)
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

/**
 * Reads the token list as a FunctionalScript module: `import` statements, then
 * `const` statements, then one `export default`.
 *
 * This is the only language the parser reads. A JSON document is data, not a
 * module, and `fjs/media/json` is its reader
 * ([spec: JSON input](../../../spec/README.md#json-input)).
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>}
 */
export const parseFromTokens = tokenList => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null } })(tokenList)
    switch (state.state) {
        case 'result': return ok(/** @satisfies {AstModule} */ ([toArray(state.module.modules), toArray(state.module.consts)]))
        case 'error': return error(state.error)
        default: return error({ message: 'unexpected end', metadata: null })
    }
}

/**
 * The ordinary token stream a BNF parser layer consumes, with the tokenizer's
 * one physical end-of-input token split off.
 *
 * @typedef {{
 *   readonly tokens: readonly DjsTokenWithMetadata[]
 *   readonly eofMetadata: TokenMetadata
 * }} _TokenStream
 */

/**
 * Splits the tokenizer's single final physical `eof` token off a token list.
 *
 * A BNF parser backend synthesizes its own logical end-of-input, so passing the
 * tokenizer's physical `eof` through as an ordinary symbol would create a second
 * end marker. Dropping it outright would instead lose the source position that a
 * failure *at* physical end has to be reported from, so its metadata is kept
 * aside as `eofMetadata` rather than discarded or refabricated.
 *
 * The tokenizer's contract is exactly one `eof`, in final position; a stream
 * carrying one anywhere else is rejected here rather than parsed.
 *
 * A stream with no `eof` at all has two causes, and they are not reported the
 * same way. A lexical failure — an unterminated string or comment — ends the
 * stream at an `error` token and emits no `eof`, which is the tokenizer working
 * correctly on bad input; that error is passed through with its own position.
 * Anything else missing an `eof` is a genuine contract violation and has no
 * position to report.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<_TokenStream, ParseError>}
 */
const splitEof = tokenList => {
    const a = toArray(tokenList)
    const eofIdx = a.findIndex(({ token }) => token.kind === 'eof')
    if (eofIdx === -1) {
        // A lexical failure ends the stream at its `error` token and emits no
        // `eof`, so the absence of one is not always a broken contract. Rejecting
        // it as one would answer "unterminated string at 1:11" with "missing
        // end-of-input token" and no position at all, so the error is reported
        // where it happened — the same place the hand-written parser reports it.
        const lastToken = a[a.length - 1]
        return lastToken !== undefined && lastToken.token.kind === 'error'
            ? error({ message: 'unexpected token', metadata: lastToken.metadata })
            : error({ message: 'missing end-of-input token', metadata: null })
    }
    const last = a.length - 1
    if (eofIdx !== last) {
        return error({ message: 'end-of-input token is not final', metadata: a[eofIdx].metadata })
    }
    return ok({ tokens: a.slice(0, last), eofMetadata: a[last].metadata })
}

/**
 * The parser layer's complete finite alphabet: every token name its grammar may
 * name as a terminal, and the exact set a token-name-to-symbol mapping has to be
 * validated over before parsing.
 *
 * `eof` is not a member — {@link splitEof} removes the tokenizer's physical
 * end-of-input token before any name is mapped, and the backend synthesizes its
 * own logical one.
 *
 * The names are the *token* vocabulary, not the tokenizer grammar's tag
 * vocabulary: only eight punctuators survive into `DjsToken`, so the JS operator
 * set the tokenizer recognizes is far larger than what reaches this layer.
 *
 * A name is not always a kind. The framing keywords arrive as `id` tokens and
 * need terminals of their own, or the grammar could not tell `export default`
 * from two arbitrary identifiers — see {@link framingKeywords}.
 *
 * The `_…AreComplete` assertions below check both halves against `DjsToken` and
 * `_FramingKeyword` at compile time, so a kind or keyword added there breaks the
 * build rather than going unrepresented.
 */
const tokenKindNames = /** @type {const} */ ([
    'true', 'false', 'null', 'undefined',
    '{', '}', ':', ',', '[', ']', '.', '=',
    'string', 'number', 'error', 'id', 'bigint',
    'ws', 'nl', '//', '/*',
])

/**
 * The framing keywords, which the tokenizer emits as `id` tokens carrying the
 * word in `value`. Kept as its own list because the mapping has to recognize
 * exactly these values, not merely encode them.
 *
 * **A grammar over this alphabet owes them an identifier rule.** None of the
 * five is reserved: outside the framing positions the parser accepts them as
 * ordinary identifiers, so `const export = 1`, `export default export`, and
 * `{ from: 2, default: 3 }` all parse today. Once each carries its own symbol, a
 * rule whose identifier terminal is the bare `id` symbol rejects every one of
 * them. Wherever an identifier is accepted — binding names, references, object
 * keys, import names — the terminal has to be the union of `id` and these five.
 *
 * Giving a word its own symbol narrows where it is *required*, never where it is
 * *allowed*.
 */
const framingKeywords = /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])

/**
 * The complete alphabet: one name per `DjsToken` kind except `eof`, plus one per
 * framing keyword. No keyword collides with a kind, so the two lists concatenate
 * without a name being registered twice — which `encoding` would reject anyway.
 */
const ordinaryTokenNames = [...tokenKindNames, ...framingKeywords]

/** @typedef {Assert<Equal<(typeof tokenKindNames)[number], Exclude<DjsToken['kind'], 'eof'>>>} _KindsAreComplete */

/** @typedef {Assert<Equal<(typeof framingKeywords)[number], _FramingKeyword>>} _KeywordsAreComplete */

/** @typedef {Assert<Equal<(typeof ordinaryTokenNames)[number], _OrdinaryTokenName>>} _AlphabetIsComplete */

/**
 * `eof` is not a member of the alphabet, so a second end marker cannot be
 * encoded rather than merely going unused — and `encode` would reject the name
 * outright. Checked at the type level because that is where it is decidable:
 * `includes('eof')` does not even compile against this element type.
 *
 * @typedef {Assert<Equal<Extract<_OrdinaryTokenName, 'eof'>, never>>} _EofIsNotAName
 */

/**
 * The alphabet's encoding, built once for the module rather than per parse.
 *
 * `encoding` asserts what the mapping needs — capacity, and no repeated name —
 * so an alphabet that could not produce distinct symbols fails here at load
 * rather than midway through a parse. Symbols start at `0x110000`, one past the
 * last Unicode scalar value, so a token symbol can never be mistaken for a code
 * point of the layer below.
 */
const tokenEncoding = encoding(ordinaryTokenNames)

/**
 * One ordinary token as a descent input leaf: the symbol standing for its kind,
 * paired with the whole token as metadata.
 *
 * The grammar above sees only the symbol — one per token, which is what makes a
 * token stream an alphabet — while the token's value and source position ride
 * along untouched, so nothing a diagnostic or an AST fold needs is lost.
 *
 * `eof` is not in the alphabet and `encode` would reject it. Reaching it here
 * means {@link splitEof} was skipped, which is a caller bug rather than bad
 * input, so this asserts instead of widening the result to a `Result`.
 *
 * @type {(t: DjsTokenWithMetadata) => CodePointMeta<DjsTokenWithMetadata>}
 */
const tokenToSymbol = t => {
    const { token } = t
    // A framing keyword arrives as an `id` carrying the word, so the name comes
    // from the value there and from the kind everywhere else. `find` rather than
    // a set membership test because it also narrows the result to the keyword
    // union, which is what lets `encode` be called without a cast.
    const keyword = token.kind === 'id'
        ? framingKeywords.find(k => k === token.value)
        : undefined
    const name = keyword ?? token.kind
    assert(name !== 'eof', ['eof token reached the parser alphabet', t])
    return [tokenEncoding.encode(name), t]
}

/**
 * One token name as a grammar terminal.
 *
 * A symbol and a `TerminalRange` are both plain numbers, so `oneEncode` is what
 * says which one is meant — `encode` returns the bare symbol a stream carries,
 * and a rule needs the singleton range containing it.
 *
 * @type {(name: _OrdinaryTokenName) => TerminalRange}
 */
const sym = name => oneEncode(tokenEncoding.encode(name))

/**
 * Trivia is skipped between every pair of tokens, so almost every rule below is
 * interleaved with it.
 */
const trivia = repeat0Plus({
    ws: sym('ws'),
    nl: sym('nl'),
    lineComment: sym('//'),
    blockComment: sym('/*'),
})

/**
 * Trivia that stops at a newline, for the one place a newline is not trivia:
 * the statement separator. `import`/`const` statements must be newline-separated
 * — the `'nl'` state in the hand-written parser — so a rule that swallowed
 * newlines as trivia everywhere could not express it.
 */
const statementEnd = () => [
    repeat0Plus({ ws: sym('ws'), lineComment: sym('//'), blockComment: sym('/*') }),
    sym('nl'),
    trivia,
]

/**
 * Every word that may stand where an identifier is expected: a plain `id` and
 * each framing keyword, since none of them is reserved.
 *
 * This is the union {@link framingKeywords} obliges the grammar to provide.
 */
const identifier = {
    id: sym('id'),
    import: sym('import'),
    const: sym('const'),
    export: sym('export'),
    default: sym('default'),
    from: sym('from'),
}

/** A value that is one token. */
const primitive = {
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
    number: sym('number'),
    string: sym('string'),
    bigint: sym('bigint'),
}

/**
 * `open item, item, ... ,? close` with trivia everywhere and an optional
 * trailing comma, which both arrays and objects allow.
 *
 * The trailing comma works because a failed repetition round rewinds rather than
 * failing the match ([`bnf/descent`](../../bnf/descent/README.md)): on the final
 * `,` the round consumes the comma, finds `]` where an item belongs, and ends the
 * repetition back at the comma for the optional tail to take.
 *
 * @type {(open: TerminalRange, close: TerminalRange, item: Rule) => Rule}
 */
const delimited = (open, close, item) => () => {
    // Each element is wrapped in a one-branch variant so it carries the tag
    // `item`. The branch is a *sequence* rather than the rule itself, because a
    // variant used directly as another variant's branch loses its tag to
    // whichever inner branch matches — and every element here is a variant.
    // The tag is what lets the fold find elements by name instead of by
    // position in the delimiter scaffolding.
    const element = { item: [item] }
    return [
        open,
        trivia,
        option([
            element,
            trivia,
            repeat0Plus([sym(','), trivia, element, trivia]),
            option([sym(','), trivia]),
        ]),
        close,
    ]
}

/** @type {Rule} */
const value = () => ({ primitive, ref: identifier, array, object })

const array = delimited(sym('['), sym(']'), value)

/** A property name: bare identifier, string literal, or a computed `["a"]`. */
const key = {
    plain: identifier,
    string: sym('string'),
    computed: () => [sym('['), trivia, { name: [sym('string')] }, trivia, sym(']')],
}

/** @type {Rule} */
const member = { member: () => [{ key: [key] }, trivia, sym(':'), trivia, { value: [value] }] }

const object = delimited(sym('{'), sym('}'), member)

// Each statement is tagged for the same reason an element is: the fold reads
// the module by finding `import`/`const`/`export` nodes, not by counting past
// the trivia and separators between them.
const importStatement = {
    import: () => [
        sym('import'), trivia, { name: [identifier] },
        trivia, sym('from'), trivia, { module: [sym('string')] },
    ],
}

const constStatement = {
    const: () => [
        sym('const'), trivia, { name: [identifier] },
        trivia, sym('='), trivia, { value: [value] },
    ],
}

const exportStatement = {
    export: () => [sym('export'), trivia, sym('default'), trivia, { value: [value] }],
}

/**
 * The whole module: every `import` before every `const`, one `export default`
 * last, and nothing but trivia after it.
 *
 * The ordering the hand-written parser enforces with a `consts.length === 0`
 * check is just the shape of this rule, which is the point of writing the
 * grammar down: `import* const* export`.
 *
 * Ending on `eof` is what makes a trailing stray token a failure rather than a
 * short match — the backend synthesizes that symbol after the physical input.
 *
 * @type {Rule}
 */
const djsModule = () => [
    trivia,
    repeat0Plus([importStatement, statementEnd]),
    repeat0Plus([constStatement, statementEnd]),
    exportStatement,
    trivia,
    eof,
]

/**
 * The module matcher and the name of the rule to start it at.
 *
 * `toData` generates rule names, so the entry name belongs to the conversion and
 * is read back from it rather than spelled here. Built once: converting the
 * grammar and computing its nullability is per-grammar work, not per-parse.
 */
const [moduleRuleSet, moduleEntry] = toData(djsModule)

/** @type {DescentMatch<DjsTokenWithMetadata>} */
const moduleMatcher = descentParserRuleSet(moduleRuleSet)

// -- folding the match into an `AstModule` ----------------------------------

/** @typedef {Ast<CodePointMeta<DjsTokenWithMetadata>>} _Node */

/**
 * The token a slot holds.
 *
 * Every slot the fold reads holds exactly one token, and it is always the
 * leftmost leaf — a name, a module specifier, a primitive. Walking first
 * children rather than searching keeps this total: there is no "not found" case
 * to branch on.
 *
 * @type {(node: _Node) => DjsTokenWithMetadata}
 */
const tokenOf = node => {
    const first = node.sequence[0]
    return first instanceof Array ? first[1] : tokenOf(first)
}

/**
 * A node's direct child carrying `tag`.
 *
 * Direct rather than recursive on purpose: a statement's `name` slot holds an
 * identifier whose own tag may be `const` or `import`, so a search through the
 * subtree would confuse a *word* with the statement spelling it.
 *
 * @type {(tag: string) => (node: _Node) => _Node}
 */
const slot = tag => node => {
    const found = node.sequence.find(c => !(c instanceof Array) && c.tag === tag)
    assert(found !== undefined && !(found instanceof Array), ['grammar slot missing', tag])
    return found
}

/**
 * Every node tagged `tag` under `node`, in document order.
 *
 * An array's elements are not its direct children — they sit inside the option
 * and repetition scaffolding `delimited` builds — so finding them takes a
 * search rather than a lookup.
 *
 * The search cannot stray into a nested value, and needs no guard saying so:
 * every element, member and statement is wrapped in a node carrying its own
 * tag, so the wrapper matches and the search stops there, before it could
 * descend into the array or object inside it. That is what the wrappers are
 * for.
 *
 * Iterative, over an explicit stack, for the same reason {@link foldValue} is.
 * A repetition is only *flat* in the AST when `toData` recognizes the
 * right-recursive shape and emits a `Repeat`; nested inside this grammar's
 * option scaffolding it does not, so a thousand siblings are a thousand levels
 * of tree, and recursing over them overflows exactly as deep nesting would.
 *
 * @type {(tag: string) => (node: _Node) => readonly _Node[]}
 */
const descendantsTagged = tag => root => {
    /** Pushes a node's children so the leftmost is visited first. */
    /** @type {(rest: List<_Node>, sequence: AstSequence<CodePointMeta<DjsTokenWithMetadata>>) => List<_Node>} */
    const pushChildren = (rest, sequence) => {
        let stack = rest
        let i = sequence.length
        while (i !== 0) {
            i = i - 1
            const child = sequence[i]
            if (!(child instanceof Array)) { stack = { first: child, tail: stack } }
        }
        return stack
    }
    /** @type {List<_Node>} */
    let found = null
    let stack = pushChildren(null, root.sequence)
    for (;;) {
        const top = next(stack)
        if (top === null) { return toArray(found) }
        const node = top.first
        if (node.tag === tag) {
            found = concat(found)([node])
            stack = top.tail
        } else {
            stack = pushChildren(top.tail, node.sequence)
        }
    }
}

const valueSlot = slot('value')

const nameSlot = slot('name')

const moduleSlot = slot('module')

const keySlot = slot('key')

const itemsOf = descendantsTagged('item')

const membersOf = descendantsTagged('member')

/**
 * The property name a key spells, and whether it was the computed spelling.
 *
 * The distinction exists for `__proto__` alone: JavaScript reads a bare or
 * string `__proto__` as an instruction to replace the prototype, while
 * `{ ["__proto__"]: v }` denotes an ordinary property — so only the spelling
 * separates a rejected key from an accepted one.
 *
 * @type {(node: _Node) => readonly[string, boolean]}
 */
const keyOf = node => {
    const spelling = node.sequence[0]
    assert(!(spelling instanceof Array), 'a key held no spelling')
    const computed = spelling.tag === 'computed'
    const { token } = tokenOf(computed ? nameSlot(spelling) : spelling)
    assert('value' in token && typeof token.value === 'string', 'a key token carried no name')
    return [token.value, computed]
}

/**
 * A fold in progress: the names bound so far, the module specifiers and the
 * body collected so far, and the first error if one has been met.
 *
 * The error rides in the state rather than wrapping every step in a `Result`,
 * so a step reads as one expression instead of a nested match. Once set it is
 * never replaced, which is what makes the reported error the *first* one.
 *
 * @typedef {{
 *   readonly refs: OrderedMap<AstModuleRef>
 *   readonly modules: readonly string[]
 *   readonly consts: readonly AstConst[]
 *   readonly error: ParseError | null
 * }} _FoldState
 */

/** @type {(message: string) => (token: DjsTokenWithMetadata) => ParseError} */
const foldError = message => ({ metadata }) => ({ message, metadata })

/**
 * Binds a name to a reference, rejecting one already bound.
 *
 * `import` and `const` share one map, so a name taken by either is taken for
 * both — the same rule the state machine gets from consulting one `refs`.
 *
 * @type {(state: _FoldState) => (node: _Node) => (ref: AstModuleRef) => _FoldState}
 */
const bind = state => node => ref => {
    const withMetadata = tokenOf(nameSlot(node))
    const { token } = withMetadata
    assert('value' in token && typeof token.value === 'string', 'a name token carried no name')
    return at(token.value)(state.refs) !== null
        ? { ...state, error: foldError('duplicate id')(withMetadata) }
        : { ...state, refs: setReplace(token.value)(ref)(state.refs) }
}

/**
 * A frame of {@link foldValue}'s explicit stack: the container being built, the
 * element nodes still to read, and what has been built so far.
 *
 * `done` is a `List` rather than an array because a frame gains one element at a
 * time: appending to an array per element would copy the whole prefix each time,
 * which is what makes the obvious spelling quadratic in an array's length.
 *
 * @typedef {{
 *   readonly items: readonly _Node[]
 *   readonly index: number
 *   readonly array: List<AstConst>
 *   readonly object: OrderedMap<AstConst>
 *   readonly keys: readonly(readonly[string, boolean])[]
 *   readonly isArray: boolean
 * }} _FoldFrame
 */

/**
 * The error a frame's current key earns, or `null`.
 *
 * Checked as each member is reached rather than by scanning every key first, so
 * that an earlier member's failure is reported before a later key's. Scanning
 * ahead reported `__proto__` in `{a: missing, __proto__: 1}`, where the parser
 * this replaces reports the unresolved `missing` — errors are first-to-last, and
 * a key is not special enough to jump the queue.
 *
 * @type {(frame: _FoldFrame) => ParseError | null}
 */
const badKey = frame => {
    if (frame.isArray) { return null }
    const [name, computed] = frame.keys[frame.index]
    return name === protoKey && !computed
        // at the key itself, not at the object's `{`
        ? foldError('__proto__ requires the computed key form')(tokenOf(keySlot(frame.items[frame.index])))
        : null
}

/**
 * A value, resolved against the names bound so far.
 *
 * Iterative, over an explicit stack, because a value nests arbitrarily and the
 * call stack does not: recursion here overflows at a few thousand containers,
 * which is the defect `containerStackCost` was written to catch when the parser
 * this replaced had its own version of it.
 *
 * Returns the error channel alongside the value because a reference can fail to
 * resolve at any depth, and a container has to stop building when one does. A
 * failed fold yields `null` for the value, which is never mistaken for a
 * successful `null` — the caller reads the error, not the value.
 *
 * @type {(state: _FoldState) => (node: _Node) => readonly[AstConst, ParseError | null]}
 */
const foldValue = state => root => {
    /** @type {List<_FoldFrame>} */
    let stack = null
    let node = root
    /** @type {AstConst} */
    let value = null
    // `true` while descending into `node`; `false` while handing `value` back
    // to the frame that asked for it.
    let descending = true
    for (;;) {
        if (descending) {
            const child = node.sequence[0]
            assert(!(child instanceof Array), 'a value slot held no value')
            if (child.tag === 'array' || child.tag === 'object') {
                const isArray = child.tag === 'array'
                const items = isArray ? itemsOf(child) : membersOf(child)
                const keys = isArray ? [] : items.map(member => keyOf(keySlot(member)))
                /** @type {_FoldFrame} */
                const frame = { items, index: 0, array: null, object: null, keys, isArray }
                stack = { first: frame, tail: stack }
                if (items.length === 0) {
                    value = isArray ? ['array', []] : fromMap(null)
                    stack = assertNotNullish(next(stack)).tail
                    descending = false
                } else {
                    const rejected = badKey(frame)
                    if (rejected !== null) { return [null, rejected] }
                    node = isArray ? items[0] : valueSlot(items[0])
                }
            } else {
                const withMetadata = tokenOf(child)
                const { token } = withMetadata
                if (isValueToken(token)) {
                    value = tokenToValue(token)
                } else {
                    // anything else the value rule admits is an identifier, so
                    // it names a `const` or an `import` — or nothing, which is
                    // the error.
                    assert('value' in token && typeof token.value === 'string', 'a reference carried no name')
                    const ref = at(token.value)(state.refs)
                    if (ref === null) { return [null, foldError('const not found')(withMetadata)] }
                    value = ref
                }
                descending = false
            }
        } else {
            /** @type {{ readonly first: _FoldFrame, readonly tail: List<_FoldFrame> } | null} */
            const top = next(stack)
            if (top === null) { return [value, null] }
            /** @type {_FoldFrame} */
            const frame = top.first
            const index = frame.index + 1
            const array = frame.isArray ? concat(frame.array)([value]) : frame.array
            const object = frame.isArray
                ? frame.object
                : setReplace(frame.keys[frame.index][0])(value)(frame.object)
            if (index === frame.items.length) {
                /** @type {AstArray} */
                const asArray = ['array', toArray(array)]
                /** @type {AstObject} */
                const asObject = fromMap(object)
                value = frame.isArray ? asArray : asObject
                stack = top.tail
            } else {
                const moved = { ...frame, index, array, object }
                const rejected = badKey(moved)
                if (rejected !== null) { return [null, rejected] }
                stack = { first: moved, tail: top.tail }
                node = frame.isArray ? frame.items[index] : valueSlot(frame.items[index])
                descending = true
            }
        }
    }
}

/**
 * Adds one statement's value to the body, if nothing has failed yet.
 *
 * @type {(state: _FoldState) => (node: _Node) => _FoldState}
 */
const addValue = state => node => {
    if (state.error !== null) { return state }
    const [value, valueError] = foldValue(state)(valueSlot(node))
    return valueError !== null
        ? { ...state, error: valueError }
        : { ...state, consts: [...state.consts, value] }
}

/**
 * Folds a matched module into an `AstModule`.
 *
 * The statements are read positionally from the root — trivia, imports,
 * consts, the export — because the module rule is one sequence and its parts
 * cannot move. Everything below that is read by slot name instead.
 *
 * Each name is bound *before* the value that follows it is folded, which is
 * what makes `const a = a` resolve to the constant being defined rather than
 * fail. That is the state machine's order too, and the reason it is not one of
 * the divergences.
 *
 * @type {(root: _Node) => Result<AstModule, ParseError>}
 */
const foldModule = root => {
    const [, imports, consts, exported] = root.sequence
    assert(!(imports instanceof Array) && !(consts instanceof Array) && !(exported instanceof Array),
        'the module rule did not produce its statement groups')
    /** @type {_FoldState} */
    let state = { refs: null, modules: [], consts: [], error: null }
    for (const statement of descendantsTagged('import')(imports)) {
        state = bind(state)(statement)(['aref', state.modules.length])
        if (state.error !== null) { break }
        const specifier = tokenOf(moduleSlot(statement))
        assert('value' in specifier.token && typeof specifier.token.value === 'string',
            'an import specifier carried no text')
        state = { ...state, modules: [...state.modules, specifier.token.value] }
    }
    for (const statement of descendantsTagged('const')(consts)) {
        if (state.error !== null) { break }
        state = bind(state)(statement)(['cref', state.consts.length])
        state = addValue(state)(statement)
    }
    state = addValue(state)(exported)
    if (state.error !== null) { return error(state.error) }
    // annotated rather than inferred: a bare `[modules, consts]` widens to an
    // array, because `readonly string[]` is itself assignable to `AstBody`.
    /** @type {AstModule} */
    const astModule = [state.modules, state.consts]
    return ok(astModule)
}

/**
 * The BNF half of the parser: match, then fold.
 *
 * Not yet `parseFromTokens` — the differential proofs compare the two while
 * both stand, and the cutover replaces that function once they agree.
 *
 * @type {(tokenList: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>}
 */
export const _bnfParseFromTokens = tokenList => {
    const [tag, stream] = splitEof(toArray(tokenList))
    if (tag === 'error') { return error(stream) }
    const { tokens, eofMetadata } = stream
    const { ast, success, failure } = moduleMatcher(moduleEntry, tokens.map(tokenToSymbol))
    if (!success) {
        const { idx } = assertNotNullish(failure)
        // A failure past the last token is the end of input rather than a token
        // the reader can point at, and the hand-written parser words it that
        // way; matching it costs one comparison already being made.
        const atEnd = idx >= tokens.length
        return error({
            message: atEnd ? 'unexpected end' : 'unexpected token',
            metadata: atEnd ? eofMetadata : tokens[idx].metadata,
        })
    }
    return foldModule(ast)
}

/** @type {(kind: 'eof' | ',') => (line: number) => DjsTokenWithMetadata} */
const proofToken = kind => line => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 } })

const proofEof = proofToken('eof')

const proofComma = proofToken(',')

export const proof = {
    ordinaryTokenNames: {
        // `_AlphabetIsComplete` pins membership at compile time, but a repeated
        // name widens to the same union and so is invisible to it. The check
        // matters because the token-symbol mapping this alphabet feeds has to be
        // injective over it — two entries for one name would break that.
        noDuplicates: () => {
            assertEq(new Set(ordinaryTokenNames).size, ordinaryTokenNames.length)
        },
    },
    tokenToSymbol: {
        // One symbol per token, distinct across the alphabet, and above every
        // code point — the three properties that let a token stream be the
        // alphabet of the layer above.
        distinctAndAboveUnicode: () => {
            const symbols = ordinaryTokenNames.map(n => tokenEncoding.encode(n))
            assertEq(new Set(symbols).size, ordinaryTokenNames.length)
            const [, unicodeLast] = rangeDecode(unicodeRange)
            assert(symbols.every(s => s > unicodeLast), JSON.stringify(symbols))
        },
        // The distinction the hand-written parser makes by comparing
        // `token.value`: a framing keyword and an ordinary identifier arrive as
        // the same `id` kind, and the grammar can only tell them apart if they
        // get different symbols here.
        framingKeywordsAreNotIdentifiers: () => {
            /** @type {(value: string) => number} */
            const symbolOf = value =>
                tokenToSymbol({ token: { kind: 'id', value }, metadata: { path: 'a.js', line: 1, column: 1 } })[0]
            const id = symbolOf('foo')
            const keywords = framingKeywords.map(symbolOf)
            assert(keywords.every(s => s !== id), JSON.stringify([id, keywords]))
            assertEq(new Set(keywords).size, framingKeywords.length)
            assertEq(tokenEncoding.decode(symbolOf('export')), 'export')
            assertEq(tokenEncoding.decode(id), 'id')
        },
        // The token rides along untouched, so a fold or a diagnostic above still
        // has its value and its position.
        carriesTheToken: () => {
            /** @type {DjsTokenWithMetadata} */
            const t = { token: { kind: 'string', value: 'v' }, metadata: { path: 'a.js', line: 7, column: 1 } }
            const [symbol, meta] = tokenToSymbol(t)
            assertEq(meta, t)
            assertEq(meta.metadata.line, 7)
            assertEq(tokenEncoding.decode(symbol), 'string')
        },
        throw: {
            eofRejected: () => tokenToSymbol(proofEof(1)),
        },
    },
    splitEof: {
        // The tokenizer always ends its stream with one `eof`, so every branch
        // but this one is reachable only from a hand-built token list.
        final: () => {
            const [tag, value] = splitEof([proofComma(1), proofEof(2)])
            assert(tag === 'ok', tag)
            assertEq(value.tokens.length, 1)
            assertEq(value.eofMetadata.line, 2)
        },
        onlyEof: () => {
            const [tag, value] = splitEof([proofEof(1)])
            assert(tag === 'ok', tag)
            assertEq(value.tokens.length, 0)
            assertEq(value.eofMetadata.line, 1)
        },
        missing: () => {
            const [tag, value] = splitEof([proofComma(1)])
            assert(tag === 'error', tag)
            assertEq(value.metadata, null)
        },
        // An empty stream is also missing its `eof`, and has not even a last
        // token to blame it on. The tokenizer never produces one — an empty
        // source still yields `eof` — so only a hand-built list reaches here.
        empty: () => {
            const [tag, value] = splitEof(null)
            assert(tag === 'error', tag)
            assertEq(value.metadata, null)
        },
        // The one stream with no `eof` that is not a broken contract: a lexical
        // failure stops the tokenizer at an `error` token. The position has to
        // survive, or "unterminated string at 1:11" would be reported as
        // "missing end-of-input token" with nowhere to point.
        lexicalError: () => {
            /** @type {DjsTokenWithMetadata} */
            const errorToken = {
                token: { kind: 'error', message: 'unterminated string literal' },
                metadata: { path: 'a.js', line: 3, column: 7 },
            }
            const [tag, value] = splitEof([errorToken])
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 3)
            assertEq(value.metadata?.column, 7)
        },
        notFinal: () => {
            const [tag, value] = splitEof([proofEof(1), proofComma(2)])
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
        },
        duplicate: () => {
            const [tag, value] = splitEof([proofEof(1), proofEof(2)])
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
        },
    },
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
