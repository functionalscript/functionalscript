/**
 * @import { TNode } from '../types/types.ts'
 */

import { nodeRemove } from './module.f.mjs'
import { cmp } from '../../string/module.f.mjs'
import { assertEq, assertNotNullish } from '../../../asserts/module.f.mjs'
import { expectedSquares38, jsonStr, set, squares } from '../testlib.f.mjs'

/** @type {(node: TNode<string>) => (value: string) => TNode<string> | null} */
const remove = node => value =>
    nodeRemove(cmp(value))(node)

const test = () => {
    /** @type {TNode<string> | null} */
    let _map = squares(38)
    assertEq(jsonStr(_map), expectedSquares38)
    {
        // "0" is not in the tree, so removing it changes nothing.
        _map = assertNotNullish(remove(_map)("0"), null)
        assertEq(jsonStr(_map), expectedSquares38)
    }
    {
        _map = assertNotNullish(remove(_map)("1"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]],' +
            '"25",' +
            '[[["256"],"289",["324"],"36",["361"]],"4",[["400"],"441",["484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"9",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("4"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]],' +
            '"25",' +
            '[[["256"],"289",["324"]],"36",[["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"9",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("9"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]],' +
            '"25",' +
            '[[["256"],"289",["324"]],"36",[["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("16"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]]],' +
            '"25",' +
            '[[["256"],"289",["324"]],"36",[["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("25"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289","324"],"36",["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("36"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("49"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576","625"],"64",["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("64"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("81"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("100"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("121"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("144"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("169"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"196",["225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("196"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("225"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("256"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"289",[["324","361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("289"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"324",[["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("324"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"361",[["400"],"441",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("361"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("400"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"441",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("441"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("484"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],' +
            '"529",' +
            '[["576"],"625",["676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("529"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"576",["625","676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("576"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"625",["676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("625"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("676"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("729"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],' +
            '"784",' +
            '[["841"],"900",["961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("784"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("841"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"900",["961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("900"), null)
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["961"]]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("961"), null)
        const r = jsonStr(_map)
        if (r !==
            '[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1024"), null)
        const r = jsonStr(_map)
        if (r !==
            '[["1089"],"1156",["1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1089"), null)
        const r = jsonStr(_map)
        if (r !==
            '[["1156","1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1156"), null)
        const r = jsonStr(_map)
        if (r !==
            '[["1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1225"), null)
        const r = jsonStr(_map)
        if (r !==
            '[["1296"],"1369",["1444"]]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1296"), null)
        const r = jsonStr(_map)
        if (r !==
            '["1369","1444"]'
        ) { throw r }
    }
    {
        _map = assertNotNullish(remove(_map)("1369"), null)
        const r = jsonStr(_map)
        assertEq(r, '["1444"]')
    }
    {
        _map = remove(_map)("1444")
        assertEq(_map, null)
    }
}

const test2 = () => {
    /** @type {TNode<string> | null} */
    let _map = squares(10)
    assertEq(_map.length, 3, _map)
    let _s = jsonStr(_map)
    assertEq(_s, '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]')

    {
        _map = assertNotNullish(remove(_map)("4"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[[["1","100"],"16",["25","36"]],"49",[["64"],"81",["9"]]]')
    }

    {
        _map = assertNotNullish(remove(_map)("49"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1","100"],"16",["25","36"],"64",["81","9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("64"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1","100"],"16",["25","36"],"81",["9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("81"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1","100"],"16",["25"],"36",["9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("36"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1","100"],"16",["25","9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("16"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1","100"],"25",["9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("25"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '[["1"],"100",["9"]]')
    }

    {
        _map = assertNotNullish(remove(_map)("100"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '["1","9"]')
    }

    {
        _map = assertNotNullish(remove(_map)("9"), _map)
        _s = jsonStr(_map);
        assertEq(_s, '["1"]')
    }

    {
        _map = remove(_map)("1")
        assertEq(_map, null)
    }
}

/**
 * `['1']` with the integers `2..n` inserted. Deliberately not the shared
 * squares corpus: `test3` removes `'40'` and `'10'`, which are not squares, and
 * needs this tree's shape to reach the path it exists for.
 *
 * @type {(n: number) => TNode<string>}
 */
const sequential = n => n <= 1 ? ['1'] : set(sequential(n - 1))(n.toString())

// Exercises the branch-merge-into-Branch5-sibling path in reduceValue0
// (removing an underflowed left leaf merges into a 5-wide right branch).
const test3 = () => {
    /** @type {TNode<string> | null} */
    let _map = sequential(50)

    _map = assertNotNullish(remove(_map)('40'), _map)

    _map = assertNotNullish(remove(_map)('10'), _map)
    const r = jsonStr(_map)
    if (r !==
        '[[[[["1","11"],"12",["13"],"14",["15"]],"16",[["17"],"18",["19"]],"2",[["20"],"21",["22"]]],' +
        '"23",' +
        '[[["24"],"25",["26"]],"27",[["28"],"29",["3"]]]],' +
        '"30",' +
        '[[[["31"],"32",["33"]],"34",[["35"],"36",["37"],"38",["39"]]],' +
        '"4",' +
        '[[["41","42"],"43",["44"],"45",["46"]],"47",[["48"],"49",["5","50"]],"6",[["7"],"8",["9"]]]]]'
    ) { throw r }
}

export const proof = {
    test,
    test2,
    test3,
}
