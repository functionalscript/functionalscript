const _ = require('./module.f.cjs')
const btree = require('../types/module.f.cjs')
const s = require('../set/module.f.cjs')
const { stringCmp } = require('../../function/compare/module.f.cjs')
const json = require('../../../json/module.f.cjs')
const { sort } = require('../../object/module.f.cjs')

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => s.set(stringCmp(value))(value)(node)

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string> | undefined} */
const remove = node => value => _.nodeRemove(stringCmp(value))(node)

const jsonStr = json.stringify(sort)

{
    /** @type {btree.Node<string> | undefined} */
    let _map = ['1']
    for (let i = 2; i <= 38; i++)
        _map = set(_map)((i * i).toString())
    {
        const r = jsonStr(_map)
        if (r !==
            '[[[[["1"],"100",["1024"]],"1089",[["1156"],"121",["1225"]]],' +
            '"1296",' +
            '[[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]]],' +
            '"25",' +
            '[[[["256"],"289",["324"],"36",["361"]],"4",[["400"],"441",["484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"9",["900","961"]]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("0")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[[["1"],"100",["1024"]],"1089",[["1156"],"121",["1225"]]],' +
            '"1296",' +
            '[[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]]],' +
            '"25",' +
            '[[[["256"],"289",["324"],"36",["361"]],"4",[["400"],"441",["484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"9",["900","961"]]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1")
        if (_map === undefined) { throw 'undefined' }
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
        _map = remove(_map)("4")
        if (_map === undefined) { throw 'undefined' }
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
        _map = remove(_map)("9")
        if (_map === undefined) { throw 'undefined' }
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
        _map = remove(_map)("16")
        if (_map === undefined) { throw 'undefined' }
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
        _map = remove(_map)("25")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289","324"],"36",["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("36")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"49",' +
            '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("49")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576","625"],"64",["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("64")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"],"729",["784"]],"81",[["841"],"900",["961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("81")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["100","1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("100")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156"],"121",["1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("121")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"144",["1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("144")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"169",["196","225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("169")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"196",["225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("196")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["225"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("225")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"256",[["289"],"324",["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("256")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"289",[["324","361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("289")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"324",[["361"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("324")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],"361",[["400"],"441",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("361")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"400",["441","484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("400")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"441",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("441")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["484"]]],' +
            '"529",' +
            '[[["576"],"625",["676"]],"729",[["784"],"841",["900","961"]]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("484")
        if (_map === undefined) { throw 'undefined' }
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
        _map = remove(_map)("529")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"576",["625","676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("576")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"625",["676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("625")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["676"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("676")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],' +
            '"729",' +
            '[["784"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("729")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]],' +
            '"784",' +
            '[["841"],"900",["961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("784")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"841",["900","961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("841")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369","1444"],"900",["961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("900")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[[["1024"],"1089",["1156","1225"]],"1296",[["1369"],"1444",["961"]]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("961")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[["1024"],"1089",["1156","1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1024")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[["1089"],"1156",["1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1089")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[["1156","1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1156")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[["1225"],"1296",["1369","1444"]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1225")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '[["1296"],"1369",["1444"]]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1296")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !==
            '["1369","1444"]'
        ) { throw r }
    }
    {
        _map = remove(_map)("1369")
        if (_map === undefined) { throw 'undefined' }
        const r = jsonStr(_map)
        if (r !== '["1444"]') { throw r }
    }
    {
        _map = remove(_map)("1444")
        if (_map !== undefined) { throw _map }
    }
}

{
    /** @type {btree.Node<string>|undefined} */
    let _map = ['1']
    for (let i = 2; i <= 10; i++)
        _map = set(_map)((i * i).toString())
    if (_map.length !== 3) { throw _map }
    let _s = jsonStr(_map)
    if (_s !== '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]') { throw _s }

    {
        _map = remove(_map)("4")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[[["1","100"],"16",["25","36"]],"49",[["64"],"81",["9"]]]') { throw _s }
    }

    {
        _map = remove(_map)("49")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1","100"],"16",["25","36"],"64",["81","9"]]') { throw _s }
    }

    {
        _map = remove(_map)("64")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1","100"],"16",["25","36"],"81",["9"]]') { throw _s }
    }

    {
        _map = remove(_map)("81")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1","100"],"16",["25"],"36",["9"]]') { throw _s }
    }

    {
        _map = remove(_map)("36")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1","100"],"16",["25","9"]]') { throw _s }
    }

    {
        _map = remove(_map)("16")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1","100"],"25",["9"]]') { throw _s }
    }

    {
        _map = remove(_map)("25")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '[["1"],"100",["9"]]') { throw _s }
    }

    {
        _map = remove(_map)("100")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '["1","9"]') { throw _s }
    }

    {
        _map = remove(_map)("9")
        if (_map === undefined) { throw _map }
        _s = jsonStr(_map);
        if (_s !== '["1"]') { throw _s }
    }

    {
        _map = remove(_map)("1")
        if (_map !== undefined) { throw _map }
    }
}