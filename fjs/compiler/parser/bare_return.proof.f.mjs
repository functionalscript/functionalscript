/** Explicit bare returns share the existing undefined operand and control flow. */
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'
import { _evaluate, stringifyModule, tokenizeString } from './proof.f.mjs'
import { _function } from './standalone.proof.f.mjs'

export const proof = {
    equivalentFast: () => {
        for (const [bare, explicit] of [
            ['export default ()=>{return;};', 'export default ()=>{return undefined;};'],
            ['export default (...xs)=>{\nreturn\n};', 'export default (...xs)=>{\nreturn undefined\n};'],
            ['export default flag=>{if(flag){return;}return 7;};', 'export default flag=>{if(flag){return undefined;}return 7;};'],
            ['export default ()=>{while(false){return;}return 7;};', 'export default ()=>{while(false){return undefined;}return 7;};'],
            ['export default ()=>{while(false){{return}continue;}return;};', 'export default ()=>{while(false){{return undefined}continue;}return undefined;};'],
            ['export default ()=>{{return;}return 7;};', 'export default ()=>{{return undefined;}return 7;};'],
            ['export default x=>{switch(x){case 0:{return;}default:{return}}};', 'export default x=>{switch(x){case 0:{return undefined;}default:{return undefined}}};'],
        ]) {
            assertStructurallySame(normalize(assertOk(parse('')(bare)), []), normalize(assertOk(parse('')(explicit)), []), bare)
        }
    },
    equivalentGraphAndValue: () => {
        for (const [bare, explicit] of [
            ['export default ()=>{return;};', 'export default ()=>{return undefined;};'],
            ['export default (()=>{return})();', 'export default (()=>{return undefined})();'],
            ['export default flag=>{if(flag){return;}return 7;};', 'export default flag=>{if(flag){return undefined;}return 7;};'],
        ]) { assertEq(stringifyModule(assertOk(parse('')(bare))), stringifyModule(assertOk(parse('')(explicit))), bare) }
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parse('')('export default (()=>{return;})();'))))), { default: undefined })
    },
    sourceLocationsAndSemicolons: () => {
        for (const [ending, semicolon] of /** @type {const} */ ([['return;', true], ['return', false], ['return\n', false], ['return/*\n*/;', true]])) {
            const source = `export default ()=>{\n ${ending}};`
            const module = assertOk(parseSyntax(tokenizeString(source)))
            const fn = module.exported?.value
            assert(fn !== undefined && fn[0] === '=>' && fn[2][0] === 'block')
            const statement = fn[2][1][0]
            assert(statement[0] === 'return')
            assertStructurallySame(statement[1].value, ['primitive', undefined])
            assertEq(statement[1].semicolon, semicolon)
            assertEq(statement[1].start.metadata.line, 2)
            assertEq(statement[1].start.metadata.column, 2)
            assertEq(statement[1].start.newline, true)
            assertEq(statement[1].first.newline, false)
            assertEq(statement[1].first.metadata, statement[1].start.metadata)
        }
        const source = 'export default ()=>{return;const unreachable=1;};'
        const error = assertError(parseSyntax(tokenizeString(source)))
        assertEq(error.metadata?.column, source.indexOf('const') + 1)
    },
    ownershipAndRefusals: () => {
        const fn = _function('export default ()=>{{return;}return;};')
        const statement = fn.body.statements[0]
        assert(statement[0] === 'return' && statement[1] === fn.target)
        for (const source of [
            'return;', '{return;}export default 0;', 'while(false){return;}export default 0;',
            'export default ()=>{};', 'export default ()=>{return\n1;};',
            'export default ()=>{return;return 1;};', 'export default ()=>{throw;};',
        ]) { assertError(parse('')(source)) }
    },
    returnIdentifiersArePreserved: () => {
        for (const source of [
            'export default ({return:7}).return;', 'export default ({return:7})?.return;',
            'export default ()=>{return ({return:7}).return};',
            'export default {return};', 'const return=1;export default return;',
            'import {return} from "./source.f.js";export default 0;',
        ]) { assertOk(parseSyntax(tokenizeString(source))) }
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parse('')('export default ({return:7}).return;'))))), { default: 7 })
        assertEq(assertError(parse('')('export default {return};')).message, 'reserved word')
    },
}
