/**
 * Source binding identities survive folding, pattern expansion and synthetic
 * regions. These are source facts, before assignment normalization or helpers.
 *
 * @import { Binding, BindingEvent, BindingScope } from '../../js/ast/types.ts'
 * @import { BindingOrigin, ResolvedModule } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => ResolvedModule} */
const parsed = source => assertOk(parseFromTokens(tokenizeString(source)))

/** @type {(module: ResolvedModule, name: string, kind?: BindingOrigin['kind']) => { readonly origin: BindingOrigin, readonly binding: Binding }} */
const named = (module, name, kind) => {
    const origins = module.origins.filter(origin => origin.name === name && (kind === undefined || origin.kind === kind))
    assertEq(origins.length, 1, [name, kind, module.origins])
    const origin = origins[0]
    return { origin, binding: assertNotNullish(module.bindings.find(binding => binding.id === origin.id), ['missing facts', origin]) }
}

/** @type {(events: readonly BindingEvent[]) => readonly BindingScope[]} */
const functionScopes = events => events.flatMap(event => event[0] === 'function'
    ? [event[1], ...functionScopes(event[1].events)] : event[0] === 'region' ? functionScopes(event[1]) : [])

/** @type {(events: readonly BindingEvent[]) => readonly BindingEvent[]} */
const allEvents = events => events.flatMap(event => event[0] === 'function'
    ? allEvents(event[1].events) : event[0] === 'region' ? allEvents(event[1]) : [event])

export const proof = {
    manyReadEvents: () => {
        const count = 20_000
        const module = parsed(`const value=1;export default [${Array.from({ length: count }, () => 'value').join(',')}];`)
        assertEq(module.scope.events.length, count + 1)
        assertEq(module.bindings.length, 1)
        const fact = module.bindings[0]
        assertEq(fact.isMutable, false)
        assertEq(fact.capturedBy.length, 0)
        assertStructurallySame(module.scope.events[0], ['initialize', fact.id])
        for (const event of module.scope.events.slice(1)) {
            assertEq(event[0], 'read')
            assertEq(event[1], fact.id)
        }
    },
    traceOrder: () => {
        const module = parsed('const value=1;export default [value,()=>value,value];')
        const id = module.bindings[0].id
        const child = module.scope.events[2]
        assert(child[0] === 'function')
        assertEq(child[1].target.index, 3)
        assertStructurallySame(module.scope.events, [
            ['initialize', id], ['read', id], ['function', child[1]], ['read', id],
        ])
        assertStructurallySame(child[1].events, [['read', id]])
        assertStructurallySame(Object.keys(module.scope).toSorted(), ['bindings', 'events', 'target'])
        assertStructurallySame(Object.keys(child[1]).toSorted(), ['bindings', 'events', 'target'])
    },
    foldedAliases: () => {
        const module = parsed('const original=1; const alias=original; export default ()=>alias;')
        const original = named(module, 'original')
        const alias = named(module, 'alias')
        assert(original.origin.id !== alias.origin.id)
        assertEq(original.binding.isMutable, false)
        assertEq(alias.binding.isMutable, false)
        assertEq(original.binding.capturedBy.length, 0)
        assertEq(alias.binding.capturedBy.length, 1)
        assertEq(original.origin.metadata.column, 7)
        assertEq(alias.origin.metadata.column, 25)
        const equal = parsed('const a=1; const b=1; export default ()=>[a,b];')
        const a = named(equal, 'a')
        const b = named(equal, 'b')
        assert(a.origin.id !== b.origin.id)
        assertEq(a.binding.capturedBy[0], b.binding.capturedBy[0])
        assertEq(a.binding.capturedBy.length, 1)
        const parameter = parsed('export default parameter=>{const snapshot=parameter; return ()=>snapshot;};')
        assertEq(named(parameter, 'parameter', 'parameter').binding.capturedBy.length, 0)
        assertEq(named(parameter, 'snapshot', 'const').binding.capturedBy.length, 1)
    },
    imports: () => {
        const module = parsed('import {x as first, x as second} from "./dep"; export default ()=>second;')
        const first = named(module, 'first', 'import')
        const second = named(module, 'second', 'import')
        assert(first.origin.id !== second.origin.id)
        assertEq(first.binding.isMutable, false)
        assertEq(second.binding.isMutable, false)
        assertEq(first.binding.capturedBy.length, 0)
        assertEq(second.binding.capturedBy.length, 1)
    },
    spreadReferences: () => {
        const module = parsed('const source={a:1}; export default ()=>({...source});')
        const source = named(module, 'source', 'const')
        assertEq(source.binding.isMutable, false)
        assertEq(source.binding.capturedBy.length, 1)
        assertEq(allEvents(module.scope.events).filter(event => event[0] === 'read' && event[1] === source.origin.id).length, 1)
    },
    sourceFunctionBoundaries: () => {
        const module = parsed('export default n=>{if(n){const arm=n; return arm;} const tail=n; return tail;};')
        assertEq(functionScopes(module.scope.events).length, 1)
        for (const name of ['n', 'arm', 'tail']) {
            const { binding } = named(module, name)
            assertEq(binding.isMutable, false)
            assertEq(binding.capturedBy.length, 0)
        }
        const nested = parsed('export default n=>{if(n){return ()=>n;} return 0;};')
        const scopes = functionScopes(nested.scope.events)
        assertEq(scopes.length, 2)
        assertStructurallySame(named(nested, 'n').binding.capturedBy, [scopes[1].target])
    },
    forwardedFramesAreNotSourceReferences: () => {
        const module = parsed('const value=1; export default ()=>()=>value;')
        const scopes = functionScopes(module.scope.events)
        assertEq(scopes.length, 2)
        assertStructurallySame(named(module, 'value').binding.capturedBy, [scopes[1].target])
        const parameter = parsed('export default value=>()=>()=>value;')
        const nested = functionScopes(parameter.scope.events)
        assertEq(nested.length, 3)
        assertStructurallySame(named(parameter, 'value').binding.capturedBy, [nested[2].target])
    },
    lexicalShadowing: () => {
        const module = parsed('export default a=>{if(a){const a=1; return ()=>a;} return ()=>a;};')
        const parameter = named(module, 'a', 'parameter')
        const local = named(module, 'a', 'const')
        assert(parameter.origin.id !== local.origin.id)
        assertEq(parameter.binding.capturedBy.length, 1)
        assertEq(local.binding.capturedBy.length, 1)
        assert(parameter.binding.capturedBy[0] !== local.binding.capturedBy[0])
    },
    iterationWritesAndSnapshots: () => {
        const module = parsed('export default ()=>{let value=0; while(value<3){const observed=(()=>value)(); value=value+1;} return value;};')
        const value = named(module, 'value', 'let')
        assertEq(value.binding.isMutable, true)
        assertEq(value.binding.capturedBy.length, 1)
        assertEq(named(module, 'observed', 'const').binding.isMutable, false)
        const events = allEvents(module.scope.events)
        const capturing = assertNotNullish(functionScopes(module.scope.events).find(scope => scope.target === value.binding.capturedBy[0]))
        const read = assertNotNullish(allEvents(capturing.events).find(event => event[0] === 'read' && event[1] === value.origin.id))
        const captureRead = events.indexOf(read)
        const write = events.findIndex(event => event[0] === 'write' && event[1] === value.origin.id)
        assert(captureRead < write)
        assertEq(events.filter(event => event[0] === 'initialize' && event[1] === value.origin.id).length, 1)
        // a variable assigned nowhere is a parameter's equal: captured
        // freely, and immutable
        const unwritten = parsed('export default ()=>{let value=0; const other=value; return ()=>[value,other];};')
        assertEq(named(unwritten, 'value', 'let').binding.isMutable, false)
        assertEq(named(unwritten, 'value', 'let').binding.capturedBy.length, 1)
        // an assigned parameter is a variable as a `let` is
        const parameter = parsed('export default value=>{value=value+1; return value;};')
        assertEq(named(parameter, 'value', 'parameter').binding.isMutable, true)
        assertEq(named(parameter, 'value', 'parameter').binding.capturedBy.length, 0)
        const snapshot = parsed('export default ()=>{let value=0; while(value<3){value=value+1;} const snapshot=value; return ()=>snapshot;};')
        assertEq(named(snapshot, 'value').binding.isMutable, true)
        assertEq(named(snapshot, 'value').binding.capturedBy.length, 0)
        assertEq(named(snapshot, 'snapshot').binding.isMutable, false)
        assertEq(named(snapshot, 'snapshot').binding.capturedBy.length, 1)
    },
    // an assignment's write follows the reads of its value, the order the
    // statement runs in — in a body, in a loop's block and in a module
    assignmentOrder: () => {
        /** @type {readonly (readonly [string, readonly string[]])[]} */
        const cases = [
            ['export default ()=>{let x=0; x=x+1; return x;};', ['initialize', 'read', 'write', 'read']],
            ['export default n=>{let x=0; while(x<n){x=x+1;} return x;};', ['initialize', 'read', 'read', 'write', 'read']],
            ['let x=0; x=x+1; export default x;', ['initialize', 'read', 'write', 'read']],
        ]
        for (const [source, expected] of cases) {
            const module = parsed(source)
            const x = named(module, 'x', 'let')
            assertStructurallySame(allEvents(module.scope.events).filter(event => event[1] === x.origin.id).map(event => event[0]), expected, source)
        }
    },
    completeSourceScan: () => {
        const unreachable = parsed('export default ()=>{let value=0; while(false){value=1;} return value;};')
        assertEq(named(unreachable, 'value').binding.isMutable, true)
        const unwritten = parsed('export default ()=>{let value=0; return ()=>value;};')
        assertEq(named(unwritten, 'value').binding.isMutable, false)
        assertEq(named(unwritten, 'value').binding.capturedBy.length, 1)
        const captured = parsed('export default n=>{const value=n; if(false){return ()=>value;} return 0;};')
        assertEq(named(captured, 'value').binding.capturedBy.length, 1)
        // a capture of a variable assigned anywhere in its scope by a
        // function held as a value is refused once the whole scope is read,
        // the write coming before or after
        for (const source of [
            'export default ()=>{let value=0; while(value<1){value=1;} return ()=>value;};',
            'export default ()=>{let value=0; const f=()=>value; while(value<1){value=1;} return f;};',
        ]) {
            const [tag, refusal] = parseFromTokens(tokenizeString(source))
            assert(tag === 'error', source)
            assertEq(refusal.message, 'reassigned variable captured', source)
        }
    },
    patternsAndDefaults: () => {
        const module = parsed('export default ([a],{b},c=a,...rest)=>()=>[a,b,c,rest];')
        for (const name of ['a', 'b', 'c', 'rest']) {
            const { binding } = named(module, name, 'parameter')
            assertEq(binding.isMutable, false)
            assertEq(binding.capturedBy.length, 1)
        }
        const events = allEvents(module.scope.events)
        for (const origin of module.origins) {
            assertEq(events.filter(event => event[0] === 'initialize' && event[1] === origin.id).length, 1, origin)
        }
        assert(module.origins.some(origin => origin.kind === 'temporary' && origin.name === null))
        const defaultClosure = parsed('export default (a,b=()=>a)=>b;')
        assertEq(named(defaultClosure, 'a').binding.capturedBy.length, 1)
        assertEq(named(defaultClosure, 'b').binding.capturedBy.length, 0)
        const localPattern = parsed('const value=[1,2]; const [a,b]=value; export default ()=>[a,b];')
        assertEq(named(localPattern, 'value').binding.capturedBy.length, 0)
        assertEq(named(localPattern, 'a').binding.capturedBy.length, 1)
        assertEq(named(localPattern, 'b').binding.capturedBy.length, 1)
    },
    selfAndShadowedSelf: () => {
        const module = parsed('const f=n=>n===0?0:f(n-1); export default f;')
        assertEq(named(module, 'f', 'const').binding.isMutable, false)
        assertEq(named(module, 'f', 'const').binding.capturedBy.length, 1)
        const shadowed = parsed('const f=f=>f; export default f;')
        assertEq(named(shadowed, 'f', 'const').binding.capturedBy.length, 0)
        assertEq(named(shadowed, 'f', 'parameter').binding.capturedBy.length, 0)
    },
    recognizedFunctionTemplates: () => {
        const entry = parsed('const entry=(a,b)=>{const descriptor=Object.getOwnPropertyDescriptor(a,b); return descriptor?.enumerable?descriptor.value:undefined;}; export default entry;')
        assertEq(functionScopes(entry.scope.events).length, 1)
        for (const name of ['a', 'b']) {
            const { binding } = named(entry, name, 'parameter')
            assertEq(binding.isMutable, false)
            assertEq(binding.capturedBy.length, 0)
        }
        assertEq(named(entry, 'descriptor', 'const').binding.isMutable, false)
        const intrinsic = parsed('const slice=(s,a,b)=>s.slice(a,b); export default slice;')
        assertEq(functionScopes(intrinsic.scope.events).length, 1)
        for (const name of ['s', 'a', 'b']) {
            const { binding } = named(intrinsic, name, 'parameter')
            assertEq(binding.isMutable, false)
            assertEq(binding.capturedBy.length, 0)
        }
    },
    currentAdmission: () => {
        assertError(parseFromTokens(tokenizeString('export default ()=>{const value=0; value=1; return value;};')))
        assertOk(parseFromTokens(tokenizeString('export default ()=>{let value=0; return value;};')))
        assertError(parseFromTokens(tokenizeString('export default ()=>{let value=0; while(value<1){const f=()=>value; value=1;} return value;};')))
        assertError(parseFromTokens(tokenizeString('const value=1; export default ()=>{const value=value; return value;};')))
    },
}
