/**
 * @import { Primitive } from '../../../media/datajs/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Node, ParameterList } from './types.ts'
 */

import { _baseOf, _primitiveOf, _toMember, parseSyntax } from './module.f.mjs'
import { tokenizeString } from '../proof.f.mjs'
import { _valueKinds } from '../grammar/module.f.mjs'
import { fromEntries } from '../../../types/object/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'

/** @type {(kind: 'null' | 'true' | 'false' | 'undefined' | 'eof' | ';', line: number) => ModuleTokenWithMetadata} */
const proofKind = (kind, line) => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 }, newline: false })

/** @type {(value: string, line: number) => ModuleTokenWithMetadata} */
const proofId = (value, line) => ({ token: { kind: 'id', value }, metadata: { path: 'a.js', line, column: 1 }, newline: false })

/**
 * A source value of every kind in {@link _valueKinds}, and the primitive it
 * folds to: keyed by the list, so a kind added there is a sample missing
 * here, and the switch that converts each kind is run once per kind.
 *
 * @type {{ readonly [k in (typeof _valueKinds)[number]]: readonly [string, Primitive] }}
 */
const valueSamples = {
    Infinity: ['Infinity', Infinity],
    NaN: ['NaN', NaN],
    false: ['false', false],
    null: ['null', null],
    true: ['true', true],
    undefined: ['undefined', undefined],
    number: ['1.5', 1.5],
    string: ['"a"', 'a'],
    bigint: ['7n', 7n],
}

/**
 * The value a block's final `return` holds, the block being a function's
 * body: what a proof of the syntax tree pins, the statement's own token
 * being a position and not a shape.
 *
 * @type {(node: Node) => Node}
 */
const returned = node => {
    assert(node[0] === '=>')
    const body = node[2]
    assert(body[0] === 'block')
    const last = body[1][body[1].length - 1]
    assert(last[0] === 'return')
    return last[1].value
}

export const proof = {
    classicForRetainsClausesAndLexicalDeclarations: () => {
        const module = unwrap(parseSyntax(tokenizeString('for(let i=0;i<3;i+=1){for(;;){continue;}}export default 0;')))
        const loop = module.statements[0]
        assert(loop[0] === 'for')
        const { initializer, condition, step, block, start } = loop[1]
        assertEq(start.metadata.column, 1)
        assert(initializer !== null && initializer[0] === 'let')
        assertEq(initializer[1].semicolon, true)
        assertEq(initializer[1].target[0], 'name')
        assertStructurallySame(initializer[1].value, ['primitive', 0])
        assertEq(condition[0], '<')
        assert(step !== null && step[0] === 'assign')
        assertEq(step[1].operator?.tag, '+')
        assertEq(step[1].operator?.token.metadata.column, 18)
        assertEq(step[1].semicolon, true)
        const nested = block[1][0]
        assert(nested[0] === 'for')
        assertEq(nested[1].initializer, null)
        assertStructurallySame(nested[1].condition, ['primitive', true])
        assertEq(nested[1].step, null)
        assertEq(nested[1].block[1][0][0], 'continue')
        const declared = unwrap(parseSyntax(tokenizeString('for(const [i]=[0];false;){}export default 0;'))).statements[0]
        assert(declared[0] === 'for' && declared[1].initializer !== null && declared[1].initializer[0] === 'const')
        assertEq(declared[1].initializer[1].target[0], 'array')
        for (const source of [
            'for(i=0;test();i=i+1){}export default 0;',
            'for(start();test();advance()){}export default 0;',
        ]) {
            const named = unwrap(parseSyntax(tokenizeString(source))).statements[0]
            assert(named[0] === 'for' && named[1].initializer !== null && named[1].step !== null)
            assertEq(named[1].initializer[1].semicolon, true)
            assertEq(named[1].step[1].semicolon, true)
        }
    },
    finalForCandidatesRemainDistinctFromOrdinaryLoops: () => {
        const module = unwrap(parseSyntax(tokenizeString('export default ()=>{for(;false;){}for(;;){return 1;}};')))
        const value = module.exported?.value
        assert(value !== undefined && value[0] === '=>')
        const body = value[2]
        assert(body[0] === 'block')
        assertStructurallySame(body[1].map(statement => statement[0]), ['for', 'terminal-for'])
        const terminal = body[1][1]
        assert(terminal[0] === 'terminal-for')
        assertStructurallySame(terminal[1].condition, ['primitive', true])
        const ordinary = unwrap(parseSyntax(tokenizeString('export default ()=>{for(;;){}return 1;};'))).exported?.value
        assert(ordinary !== undefined && ordinary[0] === '=>')
        const ordinaryBody = ordinary[2]
        assert(ordinaryBody[0] === 'block')
        assertStructurallySame(ordinaryBody[1].map(statement => statement[0]), ['for', 'return'])
    },
    compoundAssignmentOperatorsAndLocations: () => {
        const operators = /** @type {const} */ (['+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '^=', '|=', '&&=', '||=', '??='])
        for (const operator of operators) {
            const module = unwrap(parseSyntax(tokenizeString(`let value=8;\nvalue ${operator} 1;export default value;`)))
            const assignment = module.statements[1]
            assert(assignment[0] === 'assign')
            assertEq(assignment[1].operator?.tag, operator.slice(0, -1))
            assertEq(assignment[1].operator?.token.token.kind, operator)
            assertStructurallySame(assignment[1].operator?.token.metadata, { path: '', line: 2, column: 7 })
            assertEq(assignment[1].semicolon, true)
        }
        const module = unwrap(parseSyntax(tokenizeString('let value=8;value=1;export default value;')))
        const assignment = module.statements[1]
        assert(assignment[0] === 'assign')
        assertEq(assignment[1].operator, null)
    },
    finalWhileCandidatesRemainDistinctFromOrdinaryLoops: () => {
        const module = unwrap(parseSyntax(tokenizeString('export default ()=>{let n=0;while(false){}while((true)){return n;}};')))
        const value = module.exported?.value
        assert(value !== undefined && value[0] === '=>')
        const body = value[2]
        assert(body[0] === 'block')
        assertStructurallySame(body[1].map(statement => statement[0]), ['let', 'while', 'terminal-while'])
        const terminal = body[1][2]
        assert(terminal[0] === 'terminal-while')
        assertStructurallySame(terminal[1].condition, ['primitive', true])
        const ordinary = unwrap(parseSyntax(tokenizeString('export default ()=>{while(true){}return 1;};'))).exported?.value
        assert(ordinary !== undefined && ordinary[0] === '=>')
        const ordinaryBody = ordinary[2]
        assert(ordinaryBody[0] === 'block')
        assertStructurallySame(ordinaryBody[1].map(statement => statement[0]), ['while', 'return'])
    },
    loopSwitchesKeepLabelsScopesAndFollowingStatements: () => {
        const module = unwrap(parseSyntax(tokenizeString('while(false){\nswitch(1){case 1:case 2:{break;const after=3;}case 4:{continue;}default:{throw 5;}}\nconst following=6;\nif(true){switch(7){case 7:{return 8;}}}\n}export default 0;')))
        const loop = module.statements[0]
        assert(loop[0] === 'while')
        const statements = loop[1].block[1]
        assertStructurallySame(statements.map(statement => statement[0]), ['switch', 'const', 'if'])
        const switched = statements[0]
        assert(switched[0] === 'switch')
        assertEq(switched[1].start.metadata.line, 2)
        assertStructurallySame(switched[1].discriminant, ['primitive', 1])
        assertStructurallySame(switched[1].cases.map(arm => arm.labels), [[['primitive', 1], ['primitive', 2]], [['primitive', 4]]])
        assertStructurallySame(switched[1].cases.map(arm => arm.block[1].map(statement => statement[0])), [['break', 'const'], ['continue']])
        assertEq(switched[1].default?.[1][0][0], 'throw')
        const conditional = statements[2]
        assert(conditional[0] === 'if')
        const bare = conditional[1].block[1][0]
        assert(bare[0] === 'switch')
        assertEq(bare[1].default, null)
    },
    loopFunctionExitsKeepValuesAndFollowingSyntax: () => {
        const module = unwrap(parseSyntax(tokenizeString('while(false){\nreturn [1]\nthrow 2;\nconst after=3;\nif(true){return 4;throw 5;}else{throw 6;return 7;}\nwhile(false){return 8;throw 9;}\n}export default 0;')))
        const loop = module.statements[0]
        assert(loop[0] === 'while')
        const statements = loop[1].block[1]
        assertStructurallySame(statements.map(statement => statement[0]), ['return', 'throw', 'const', 'if', 'while'])
        const returned = statements[0]
        const thrown = statements[1]
        assert(returned[0] === 'return' && thrown[0] === 'throw')
        assertStructurallySame(returned[1].start.token, { kind: 'id', value: 'return' })
        assertEq(returned[1].start.metadata.line, 2)
        assertEq(returned[1].semicolon, false)
        assertEq(returned[1].first.newline, false)
        assertEq(returned[1].value[0], 'array')
        assertStructurallySame(thrown[1].start.token, { kind: 'id', value: 'throw' })
        assertEq(thrown[1].start.metadata.line, 3)
        assertEq(thrown[1].semicolon, true)
        assertStructurallySame(thrown[1].value, ['primitive', 2])
        const branch = statements[3]
        assert(branch[0] === 'if' && branch[1].otherwise !== null)
        assertStructurallySame(branch[1].block[1].map(statement => statement[0]), ['return', 'throw'])
        assertStructurallySame(branch[1].otherwise[1].map(statement => statement[0]), ['throw', 'return'])
        const nested = statements[4]
        assert(nested[0] === 'while')
        assertStructurallySame(nested[1].block[1].map(statement => statement[0]), ['return', 'throw'])
        const broken = unwrap(parseSyntax(tokenizeString('while(false){return\n1;throw\n2;}export default 0;'))).statements[0]
        assert(broken[0] === 'while')
        for (const statement of broken[1].block[1]) {
            assert(statement[0] === 'return' || statement[0] === 'throw')
            assertEq(statement[1].first.newline, true)
        }
    },
    loopTransfersKeepSeparatorsAndFollowingSyntax: () => {
        const module = unwrap(parseSyntax(tokenizeString('let i=0;\nwhile(i<2){\nbreak;\ncontinue\ni=i+1;\nif(i){continue;}else if(i){break}else{break;}\nwhile(false){continue;break}\n}export default i;')))
        const loop = module.statements[1]
        assert(loop[0] === 'while')
        assertStructurallySame(loop[1].block[1].map(statement => statement[0]), ['break', 'continue', 'assign', 'if', 'while'])
        const stopped = loop[1].block[1][0]
        const repeated = loop[1].block[1][1]
        assert(stopped[0] === 'break' && repeated[0] === 'continue')
        assertEq(stopped[1].semicolon, true)
        assertEq(stopped[1].start.metadata.line, 3)
        assertStructurallySame(stopped[1].start.token, { kind: 'id', value: 'break' })
        assertEq(repeated[1].semicolon, false)
        assertEq(repeated[1].start.metadata.line, 4)
        assertStructurallySame(repeated[1].start.token, { kind: 'id', value: 'continue' })
        const branch = loop[1].block[1][3]
        assert(branch[0] === 'if')
        assertEq(branch[1].block[1][0][0], 'continue')
        const alternate = branch[1].otherwise
        assert(alternate !== null)
        const chained = alternate[1][0]
        assert(chained[0] === 'if')
        const stoppedArm = chained[1].block[1][0]
        assert(stoppedArm[0] === 'break')
        assertEq(stoppedArm[1].semicolon, false)
        const inner = loop[1].block[1][4]
        assert(inner[0] === 'while')
        assertStructurallySame(inner[1].block[1].map(statement => statement[0]), ['continue', 'break'])
    },
    nestedLoopsKeepTheirBlocksAndFollowingStatements: () => {
        const module = unwrap(parseSyntax(tokenizeString('let i=0;\nwhile(i<2){\nlet j=0;\nwhile(j<i){j=j+1;}if(i){while(false){}}else{while(false){}}i=i+1;}export default i;')))
        const outer = module.statements[1]
        assert(outer[0] === 'while')
        assertEq(outer[1].start.metadata.line, 2)
        assertStructurallySame(outer[1].block[1].map(statement => statement[0]), ['let', 'while', 'if', 'assign'])
        const inner = outer[1].block[1][1]
        assert(inner[0] === 'while')
        assertEq(inner[1].start.metadata.line, 4)
        assertEq(inner[1].condition[0], '<')
        assertStructurallySame(inner[1].block[1].map(statement => statement[0]), ['assign'])
        const conditional = outer[1].block[1][2]
        assert(conditional[0] === 'if')
        assertEq(conditional[1].block[1][0][0], 'while')
        assert(conditional[1].otherwise !== null)
        assertEq(conditional[1].otherwise[1][0][0], 'while')
    },
    loopConditionalsKeepLexicalBlocksAndFollowingStatements: () => {
        const module = unwrap(parseSyntax(tokenizeString('let i=0;while(i<2){\nif(i===0){const local=1;if(local){i=i+local;}}i=i+1;}export default i;')))
        const loop = module.statements[1]
        assert(loop[0] === 'while')
        assertStructurallySame(loop[1].block[1].map(statement => statement[0]), ['if', 'assign'])
        const conditional = loop[1].block[1][0]
        assert(conditional[0] === 'if')
        assertStructurallySame(Object.keys(conditional[1]).toSorted(), ['block', 'condition', 'otherwise', 'start'])
        assertEq(conditional[1].otherwise, null)
        assertEq(conditional[1].start.metadata.line, 2)
        assertEq(conditional[1].condition[0], '===')
        assertEq(conditional[1].block[0], 'loop')
        assertStructurallySame(conditional[1].block[1].map(statement => statement[0]), ['const', 'if'])
        const nested = conditional[1].block[1][1]
        assert(nested[0] === 'if')
        assertEq(nested[1].condition[0], 'ref')
        assertEq(nested[1].block[1][0][0], 'assign')
    },
    loopAlternatesRemainSeparateLexicalBlocks: () => {
        const module = unwrap(parseSyntax(tokenizeString('let i=0;while(i<4){if(i===0){i=1;}else if(i===1){i=2;}else{const next=4;i=next;}i=i+1;}export default i;')))
        const loop = module.statements[1]
        assert(loop[0] === 'while')
        const conditional = loop[1].block[1][0]
        assert(conditional[0] === 'if')
        const alternate = conditional[1].otherwise
        assert(alternate !== null)
        assertEq(alternate[1].length, 1)
        const chained = alternate[1][0]
        assert(chained[0] === 'if')
        assertEq(chained[1].start.metadata.column, 40)
        assertEq(chained[1].condition[0], '===')
        const final = chained[1].otherwise
        assert(final !== null)
        assertStructurallySame(final[1].map(statement => statement[0]), ['const', 'assign'])
        assertEq(loop[1].block[1][1][0], 'assign')
    },
    moduleLoopsKeepTheirOwnStatementRecord: () => {
        const module = unwrap(parseSyntax(tokenizeString('let i=0;\nexport const before=i;\nwhile(i<2){i=i+1;}\nexport const after=i;\nexport default i;')))
        assertStructurallySame(module.statements.map(statement => statement[0]), ['let', 'const', 'while', 'const'])
        const loop = module.statements[2]
        assert(loop[0] === 'while')
        assertStructurallySame(Object.keys(loop[1]).toSorted(), ['block', 'condition', 'start'])
        assertStructurallySame(loop[1].start.token, { kind: 'id', value: 'while' })
        assertEq(loop[1].start.metadata.line, 3)
        assertEq(loop[1].condition[0], '<')
        assertEq(loop[1].block[0], 'loop')
        assertEq(loop[1].block[1].length, 1)
        const assignment = loop[1].block[1][0]
        assert(assignment[0] === 'assign')
        assertEq(assignment[1].value[0], '+')
        const before = module.statements[1]
        const after = module.statements[3]
        assert(before[0] === 'const' && after[0] === 'const')
        assertEq(before[1].exported, true)
        assertEq(after[1].exported, true)
        const { exported } = unwrap(parseSyntax(tokenizeString('export default ()=>{while(false){}return 7;};')))
        assert(exported !== null && exported.value[0] === '=>')
        const body = exported.value[2]
        assert(body[0] === 'block')
        const nested = body[1][0]
        assert(nested[0] === 'while')
        assertEq(nested[1].block[1].length, 0)
    },
    templates: () => {
        const plain = unwrap(parseSyntax(tokenizeString('export default `plain`;')))
        assert(plain.exported !== null)
        // a template without substitutions is its text, under a tag of its own
        assertStructurallySame(plain.exported.value, ['template', 'plain'])
        assertEq(plain.exported.first.metadata.column, 16)
        const one = unwrap(parseSyntax(tokenizeString('export default `a${1}b`;')))
        assert(one.exported !== null)
        assertStructurallySame(one.exported.value, ['+', ['+', ['primitive', 'a'], ['String', ['primitive', 1]]], ['primitive', 'b']])
        const empty = unwrap(parseSyntax(tokenizeString('export default `${1}${2}`;')))
        assert(empty.exported !== null)
        assertStructurallySame(empty.exported.value, ['+', ['+', ['+', ['+', ['primitive', ''], ['String', ['primitive', 1]]], ['primitive', '']], ['String', ['primitive', 2]]], ['primitive', '']])
    },
    // One token that is a whole value, of each kind, folded to its primitive.
    primitives: fromEntries(_valueKinds.map(kind => [kind, () => {
        const [source, expected] = valueSamples[kind]
        const { exported } = unwrap(parseSyntax(tokenizeString(`export default ${source};`)))
        assert(exported !== null)
        assertStructurallySame(exported.value, ['primitive', expected])
    }])),
    // The syntax tree of a function's block body: its statements in order,
    // each a record, and the value its `return` holds — pinned before the
    // fold, which lowers it, can erase it.
    blocks: {
            // Literal expectations pin syntax before lowering can erase it.
            explicitReturn: () => {
                const expression = unwrap(parseSyntax(tokenizeString('export default () => 7;')))
                const block = unwrap(parseSyntax(tokenizeString('export default () => { return 7; };')))
                assert(expression.exported !== null && block.exported !== null)
                assertStructurallySame(expression.exported.value, ['=>', { fixed: [], rest: null }, ['primitive', 7]])
                assertStructurallySame(returned(block.exported.value), ['primitive', 7])
            },
            orderedDeclarations: () => {
                const { exported } = unwrap(parseSyntax(tokenizeString(
                    'export default () => { const x = 1; const y = 2; return [x, y]; };')))
                assert(exported !== null && exported.value[0] === '=>')
                const body = exported.value[2]
                assert(body[0] === 'block')
                const [first, second, last] = body[1]
                assert(first[0] === 'const' && second[0] === 'const' && last[0] === 'return')
                const [xTarget, yTarget] = [first[1].target, second[1].target]
                assert(xTarget[0] === 'name' && yTarget[0] === 'name')
                assertStructurallySame(xTarget[1].token, { kind: 'id', value: 'x' })
                assertStructurallySame(yTarget[1].token, { kind: 'id', value: 'y' })
                assertStructurallySame(first[1].value, ['primitive', 1])
                assertStructurallySame(second[1].value, ['primitive', 2])
                assertEq(xTarget[1].metadata.column, 30)
                assertEq(yTarget[1].metadata.column, 43)
                // each statement begins at its keyword and ended with its `;`
                assertEq(first[1].start.metadata.column, 24)
                assertEq(last[1].start.metadata.column, 50)
                assertStructurallySame([first[1].semicolon, second[1].semicolon, last[1].semicolon], [true, true, true])
                const array = last[1].value
                assert(array[0] === 'array')
                const [x, y] = array[1]
                assert(x[0] === 'ref' && y[0] === 'ref')
                assertStructurallySame(x[1].token, xTarget[1].token)
                assertStructurallySame(y[1].token, yTarget[1].token)
            },
            nestedBlocks: () => {
                const { exported } = unwrap(parseSyntax(tokenizeString(
                    'export default () => { return () => { return 7; }; };')))
                assert(exported !== null)
                assertStructurallySame(returned(returned(exported.value)), ['primitive', 7])
            },
            // A block's last statement is tagged by its keyword: a `throw`
            // is recorded as a `return` is, beginning at the keyword, its
            // value's first token kept for the line the fold asks of it.
            thrown: () => {
                const { exported, thrown } = unwrap(parseSyntax(tokenizeString('export default () => { const x = 1; throw x; };')))
                assert(exported !== null && thrown === null && exported.value[0] === '=>')
                const body = exported.value[2]
                assert(body[0] === 'block')
                const [first, last] = body[1]
                assert(first[0] === 'const' && last[0] === 'throw')
                assert(last[1].value[0] === 'ref')
                assertEq(last[1].start.metadata.column, 37)
                assertEq(last[1].first.metadata.column, 43)
                assertEq(last[1].semicolon, true)
            },
    },
    // A guard is a block statement tagged `if`: the token it begins with, its
    // condition, and its block, read as a body's is, with the statements
    // after the guard following it in the same list. It records no `;`: a
    // block statement ends at its `}`.
    guard: () => {
        const { exported } = unwrap(parseSyntax(tokenizeString('export default (a) => { if (a) { return 1; } return 2; };')))
        assert(exported !== null && exported.value[0] === '=>')
        const body = exported.value[2]
        assert(body[0] === 'block')
        const [guard, last] = body[1]
        assert(guard[0] === 'if' && last[0] === 'return')
        assertEq(guard[1].start.metadata.column, 25)
        const condition = guard[1].condition
        assert(condition[0] === 'ref')
        assertEq(condition[1].metadata.column, 29)
        const [inner] = guard[1].block[1]
        assert(inner[0] === 'return')
        assertStructurallySame(inner[1].value, ['primitive', 1])
        assertEq(inner[1].semicolon, true)
        assertStructurallySame(last[1].value, ['primitive', 2])
        assertEq(last[1].start.metadata.column, 46)
    },
    // A switch ends a block's list, tagged `switch`: the token it begins with,
    // its discriminant, its cases — each its labels and its block, read as a
    // body's — and its `default` block, `null` where it has none, the rest of
    // the block then following it in the same list, as the statements after
    // a guard do. It records no `;`, as a guard does not.
    switch: () => {
        const { exported } = unwrap(parseSyntax(tokenizeString('export default (a) => { switch (a) { case 1: case 2: { return 1; } case 3: { throw 3; } } return 0; };')))
        assert(exported !== null && exported.value[0] === '=>')
        const body = exported.value[2]
        assert(body[0] === 'block')
        const [sw, last] = body[1]
        assert(sw[0] === 'switch' && last[0] === 'return')
        assertEq(sw[1].start.metadata.column, 25)
        assert(sw[1].discriminant[0] === 'ref')
        assertEq(sw[1].discriminant[1].metadata.column, 33)
        assertEq(sw[1].default, null)
        const [first, second] = sw[1].cases
        assertStructurallySame(first.labels, [['primitive', 1], ['primitive', 2]])
        assertStructurallySame(second.labels, [['primitive', 3]])
        const [one] = first.block[1]
        assert(one[0] === 'return')
        assertStructurallySame(one[1].value, ['primitive', 1])
        const [three] = second.block[1]
        assert(three[0] === 'throw')
        assertStructurallySame(last[1].value, ['primitive', 0])
        assertEq(last[1].start.metadata.column, 91)
        const defaulted = unwrap(parseSyntax(tokenizeString('export default (a) => { switch (a) { case 1: { return 1; } default: { return 0; } } };')))
        assert(defaulted.exported !== null && defaulted.exported.value[0] === '=>')
        const block = defaulted.exported.value[2]
        assert(block[0] === 'block')
        assertEq(block[1].length, 1)
        const [end] = block[1]
        assert(end[0] === 'switch' && end[1].default !== null)
        const [zero] = end[1].default[1]
        assert(zero[0] === 'return')
        assertStructurallySame(zero[1].value, ['primitive', 0])
    },
    // A module ending in `throw` records it where its default would be, the
    // declarations before it kept with their export markers.
    thrownModule: () => {
        const source = unwrap(parseSyntax(tokenizeString('export const a = 1;\nthrow a')))
        assertEq(source.exported, null)
        assert(source.thrown !== null)
        assert(source.thrown.value[0] === 'ref')
        assertEq(source.thrown.semicolon, false)
        assertEq(source.thrown.start.metadata.line, 2)
        assertStructurallySame(source.statements.map(s => s[0] === 'const' || s[0] === 'let' ? s[1].exported : null), [true])
        const plain = unwrap(parseSyntax(tokenizeString('throw 1;')))
        assertStructurallySame([plain.exported, plain.statements], [null, []])
        assert(plain.thrown !== null)
        const exported = unwrap(parseSyntax(tokenizeString('export default 1;')))
        assertEq(exported.thrown, null)
    },
    // A module's statements as records, each with its export marker.
    // Beside every value's node, the reader keeps the binding target the
    // same text is: a name, a pattern of the literal's items, or `invalid`
    // at the token a value that is no target begins with — a group among
    // them, by its `paren` id, which the node itself no longer shows.
    targets: () => {
        const { statements } = unwrap(parseSyntax(tokenizeString(
            'const { a, "b": [c, (d), ...e], [k]: f, ...g } = v; const [h] = v; const i = v; export default 1;')))
        const [pattern, array, name] = statements.map(s => {
            assert(s[0] === 'const')
            return s[1].declaration.target
        })
        assert(pattern[0] === 'object' && array[0] === 'array' && name[0] === 'name')
        assertEq(pattern[1].token.kind, '{')
        const [a, b, k, g] = pattern[2]
        assert(hasEntry(a, 'key') && hasEntry(b, 'key') && hasEntry(k, 'key') && !hasEntry(g, 'key'))
        assert(!(a.key instanceof Array) && !(b.key instanceof Array) && k.key instanceof Array)
        assertStructurallySame(a.key.token, { kind: 'id', value: 'a' })
        assertStructurallySame(a.target[0], 'name')
        assertEq(b.key.token.kind, 'string')
        assert(b.target[0] === 'array')
        const [c, d, e] = b.target[2]
        assertStructurallySame([c[0], d[0], e[0]], ['name', 'invalid', '...'])
        assertEq(d[1].token.kind, '(')
        assert(e[0] === '...' && e[2][0] === 'name')
        assertEq(k.key[0], '[]')
        assertEq(g[0], '...')
        assertStructurallySame(array[2].map(t => t[0]), ['name'])
        assertStructurallySame(name[1].token, { kind: 'id', value: 'i' })
    },
    // A parameter list is its fixed targets, the head read off the value
    // the grammar read as a `const`'s pattern is and the others as targets
    // outright, and its rest parameter's token; a head that is no target —
    // a value, or a group — leaves the list `invalid` at its `(`.
    parameters: () => {
        const { exported } = unwrap(parseSyntax(tokenizeString(
            'export default ({ a, b: [c] }, d, [e], ...f) => 1;')))
        assert(exported !== null && exported.value[0] === '=>')
        const list = exported.value[1]
        assert(hasEntry(list, 'fixed') && list.rest !== null)
        assertStructurallySame(list.fixed.map(t => t[0]), ['object', 'name', 'array'])
        const [pattern, d] = list.fixed
        assert(pattern[0] === 'object' && d[0] === 'name')
        assertEq(pattern[1].metadata.column, 17)
        const [a, b] = pattern[2]
        assert(hasEntry(a, 'key') && hasEntry(b, 'key'))
        assertStructurallySame([a.target[0], b.target[0]], ['name', 'array'])
        assertStructurallySame(d[1].token, { kind: 'id', value: 'd' })
        assertStructurallySame(list.rest.token, { kind: 'id', value: 'f' })
        /** @type {(source: string) => ParameterList} */
        const listOf = source => {
            const { exported } = unwrap(parseSyntax(tokenizeString(source)))
            assert(exported !== null && exported.value[0] === '=>')
            return exported.value[1]
        }
        const bare = listOf('export default a => 1;')
        assert(hasEntry(bare, 'fixed') && bare.rest === null)
        assertStructurallySame(bare.fixed.map(t => t[0]), ['name'])
        const [head] = bare.fixed
        assert(head[0] === 'name')
        assertEq(head[1].metadata.column, 16)
        const rest = listOf('export default (...r) => 1;')
        assert(hasEntry(rest, 'fixed') && rest.rest !== null)
        assertStructurallySame(rest.fixed, [])
        assertEq(rest.rest.metadata.column, 20)
        for (const source of ['export default (1) => 1;', 'export default ((a)) => 1;', 'export default (a.b, c) => 1;', 'export default ((a) = 1) => 1;', 'export default (1 = 2) => 1;']) {
            const list = listOf(source)
            assert(hasEntry(list, 'invalid') && list.invalid.metadata.column === 16, source)
        }
    },
    // A fixed parameter with a default is `['=', target, token, value]`:
    // its target as a bare parameter's, the `=` it is anchored at, and the
    // value as written — the head's, read after the value the grammar read
    // as a group's, and every other's alike; one without keeps its target
    // alone, and the rest parameter takes none.
    defaults: () => {
        const { exported } = unwrap(parseSyntax(tokenizeString(
            'export default (a = 1, { b } = {}, c, d = x => x, ...e) => 1;')))
        assert(exported !== null && exported.value[0] === '=>')
        const list = exported.value[1]
        assert(hasEntry(list, 'fixed') && list.rest !== null)
        assertStructurallySame(list.fixed.map(t => t[0]), ['=', '=', 'name', '='])
        const [a, b, , d] = list.fixed
        assert(a[0] === '=' && b[0] === '=' && d[0] === '=')
        assertStructurallySame([a[1][0], b[1][0], d[1][0]], ['name', 'object', 'name'])
        assertStructurallySame([a[2].metadata.column, b[2].metadata.column, d[2].metadata.column], [19, 30, 41])
        assertStructurallySame(a[3], ['primitive', 1])
        assertStructurallySame([b[3][0], d[3][0]], ['object', '=>'])
        assertStructurallySame(list.rest.token, { kind: 'id', value: 'e' })
        const { exported: alone } = unwrap(parseSyntax(tokenizeString('export default (a = 1) => a;')))
        assert(alone !== null && alone.value[0] === '=>')
        const single = alone.value[1]
        assert(hasEntry(single, 'fixed') && single.rest === null)
        assertStructurallySame(single.fixed.map(t => t[0]), ['='])
    },
    namedExports: {
        syntax: () => {
            const source = unwrap(parseSyntax(tokenizeString('const x=1; export const a=x; let y=a; y=x; export const b=y;')))
            assertEq(source.exported, null)
            assertStructurallySame(source.statements.map(s => s[0]), ['const', 'const', 'let', 'assign', 'const'])
            assertStructurallySame(source.statements.map(s => s[0] === 'const' || s[0] === 'let' ? [s[1].exported, s[1].declaration.target[1].token] : s[0] === 'assign' ? s[1].name.token : null), [
                [false, { kind: 'id', value: 'x' }], [true, { kind: 'id', value: 'a' }], [false, { kind: 'id', value: 'y' }], { kind: 'id', value: 'y' }, [true, { kind: 'id', value: 'b' }],
            ])
        },
    },
    // The tokenizer's EOF contract, checked through the parser rather than
    // through `splitEof` alone.
    //
    // The parser requires exactly one `eof`, in final position, because the
    // backend synthesizes its own logical end and a second marker would be a
    // symbol the grammar has no rule for. Neither stream can come from the
    // tokenizer, so only a hand-built list reaches these.
    eofContract: [
        () => {
            const wellFormed = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1),
            ]
            assertEq(parseSyntax(wellFormed)[0], 'ok')
        },
        () => {
            // no `eof`: the state machine read this as a complete module
            const noEof = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1),
            ]
            const [tag, value] = parseSyntax(noEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
        () => {
            // a second `eof`: likewise invisible to the state machine
            const twoEof = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1), proofKind('eof', 2),
            ]
            const [tag, value] = parseSyntax(twoEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'end-of-input token is not final')
        },
        () => {
            const [tag, value] = parseSyntax([])
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
    ],
    // A lexical failure ends the token stream at an `error` token and emits no
    // `eof`. `splitEof` reads a missing `eof` that way rather than as a broken
    // tokenizer contract, and reports the error where it happened — so that
    // reading is pinned here against the real tokenizer, alongside the position
    // the current parser reports for the same input.
    lexicalErrorStreamShape: [
        () => {
            const tokens = tokenizeString('const a = "abc')
            assertEq(tokens.length, 1)
            assertEq(tokens[0].token.kind, 'error')
            assertEq(tokens[0].metadata.column, 11)
        },
        () => {
            const [tag, value] = parseSyntax(tokenizeString('const a = "abc'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
            assertEq(value.metadata?.column, 11)
        },
        () => {
            // anchored at the `/*` that was never closed, not at the end of
            // input — the same convention the unterminated string above uses
            const [tag, value] = parseSyntax(tokenizeString('const a = /* x'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.column, 11)
        },
    ],
    // A node whose tag no grammar branch produces is refused, not folded to
    // `undefined`.
    throw: {
        primitiveOf: () => _primitiveOf(/** @type {never} */ (['bogus', { meta: { token: {} } }])),
        baseOf: () => _baseOf(/** @type {never} */ (['bogus', []])),
        toMember: () => _toMember(/** @type {never} */ (['bogus', []])),
    },
}
