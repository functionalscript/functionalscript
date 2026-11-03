/** Generic constructor syntax remains separate from FunctionalScript admission. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'

const path = /** @type {const} */ ('/constructors.f.mjs')

/** @type {(source: string) => ReturnType<typeof parseSyntax>} */
const syntax = source => parseSyntax(tokenize(stringToList(source))(path))

/** @type {(prefix: string, construction: string, suffix: string) => void} */
const unsupported = (prefix, construction, suffix) => {
    const source = prefix + construction + suffix
    assertOk(syntax(source))
    const refusal = assertError(parse(path)(source))
    assertEq(refusal.message, 'new is not admitted', source)
    assertStructurallySame(refusal.metadata, { path, line: 1, column: prefix.length + 1 })
}

/** @type {(source: string) => unknown} */
const evaluated = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
}

export const proof = /** @type {const} */ ({
    constructorStatementsAreRefusedBeforeNamedCallAdmission: () => {
        for (const [prefix, suffix] of [
            ['', 'export default 0;'],
            ['export default ()=>{', 'return 0;};'],
            ['export default ()=>{while(false){', '}return 0;};'],
            ['export default flag=>{if(flag){', '}return 0;};'],
        ]) { unsupported(prefix, 'new Missing();', suffix) }
        for (const construction of ['new Missing()();', 'new Missing().method(unknown);']) {
            unsupported('', construction, 'export default 0;')
        }
    },
    everyValueContextKeepsConstructionRefused: () => {
        for (const [prefix, suffix] of [
            ['export default ', ';'],
            ['export const value=', ';'],
            ['const value=', ';export default value;'],
            ['export default ()=>', ';'],
            ['export default (value=', ')=>value;'],
            ['export default ({value=', '})=>value;'],
            ['export default flag=>{if(flag){return ', ';}return 0;};'],
            ['export default ()=>{while(false){const value=', ';}return 0;};'],
            ['const consume=x=>x;export default consume(', ');'],
            ['export default {value:', '};'],
        ]) { unsupported(prefix, 'new Missing(unresolved)', suffix) }
    },
    namesAndArgumentsAreNotResolvedBeforeTheRefusal: () => {
        for (const construction of [
            'new Map()',
            'new Set(unknown)',
            'new Error(null.x)',
            'new absent.Constructor(missing())',
            'new (missing())(null.x)',
            'new Constructor(...missing)',
            'new new Missing()()',
        ]) { unsupported('export default ', construction, ';') }
    },
    followingCallsAndMembersStillRefuseAtTheOriginalNew: () => {
        for (const construction of [
            'new Missing().value',
            'new Missing()[unknown]',
            'new Missing()()',
            'new Missing().method(unknown)',
        ]) { unsupported('export default ', construction, ';') }
    },
    refusalKeepsTheNewTokenLineAndColumn: () => {
        const source = /** @type {const} */ ('const value=0;\nexport default ()=>\n    new Missing(unknown);')
        assertOk(syntax(source))
        const refusal = assertError(parse(path)(source))
        assertEq(refusal.message, 'new is not admitted')
        assertStructurallySame(refusal.metadata, { path, line: 3, column: 5 })
    },
    newRemainsAnOrdinaryPropertyName: () => {
        assertStructurallySame(evaluated('const value={new:7};const {new:renamed}=value;export default [value.new,renamed];'), { default: [7, 7] })
        assertOk(parse(path)('import {new as value} from "./absent.f.js";export default value;'))
        assertOk(parse(path)('export const value={new:9};'))
    },
    newRemainsReservedInBindingPositions: () => {
        for (const source of [
            'const new=1;export default 0;',
            'import new from "./absent.f.js";export default 0;',
            'const {new}={};export default 0;',
            'export default (...new)=>0;',
        ]) {
            assertOk(syntax(source))
            const refusal = assertError(parse(path)(source))
            assertEq(refusal.message, 'reserved word', source)
            assertEq(refusal.metadata?.column, source.indexOf('new') + 1, source)
        }
    },
})
