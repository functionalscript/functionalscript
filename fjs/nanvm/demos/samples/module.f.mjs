/**
 * The WASM demo pages' samples, each by its name and the directory that
 * holds its `sample.f.js`: the one list the generator compiles
 * ([`../module.f.mjs`](../module.f.mjs)), the deployment build publishes
 * (`gen.cloudflare/build.sh`), and each page finds its own place in.
 *
 * A function sample, a spec page's example, also lists its calls: each
 * input the page's Run button calls it with, and what JavaScript answers,
 * as [`spell`](../spell/module.f.mjs) writes it. The list is their one
 * statement: the host proof beside this module holds JavaScript to them,
 * and the generator writes them into Rust tests that hold the compiled
 * sample to the same answers, so a page whose two runs would disagree fails
 * a test before it is deployed.
 *
 * **Data alone, imported by the pages.** A page reads its place from here,
 * so this module imports nothing: the compiler the generator needs stays
 * out of the browser.
 *
 * @module
 *
 * @import { FunctionPlace, Place } from '../page/types.ts'
 */

/** The samples. A name is the sample's module and export in `nanvm-demos`, so no two share one. @type {readonly (Place | FunctionPlace)[]} */
export const samples = [
    { name: 'hello', directory: 'fjs/nanvm/demos/hello' },
    { name: 'sort', directory: 'fjs/nanvm/demos/sort' },
    { name: 'collatz', directory: 'fjs/nanvm/demos/collatz' },
    { name: 'comma', directory: 'spec/operators/comma', calls: [
        [1, ['returned', '3']],
        [-1, ['threw', '"negative"']],
    ] },
    { name: 'constants', directory: 'spec/bindings/constants', calls: [
        [0, ['returned', '[true,8080,"localhost"]']],
        [1, ['returned', '[true,8081,"localhost"]']],
    ] },
    { name: 'variables', directory: 'spec/bindings/variables', calls: [
        [3, ['returned', '[3,1,6]']],
        [-2, ['returned', '[2,1]']],
    ] },
    { name: 'destructuring', directory: 'spec/bindings/destructuring', calls: [
        [1, ['returned', '[1,2,[3,4]]']],
        [5, ['returned', '[5,10,[3,4]]']],
    ] },
    { name: 'member_functions', directory: 'spec/built-ins/member-functions', calls: [
        [0, ['returned', '"10-20-30-40"']],
        [2, ['returned', '"30-40"']],
    ] },
    { name: 'static_functions', directory: 'spec/built-ins/static-functions', calls: [
        [0, ['returned', '[false,true,false,[["0",2],["b",0]]]']],
        [1.5, ['returned', '[false,false,true,[["0",2],["b",1.5]]]']],
    ] },
    { name: 'guards', directory: 'spec/control-flow/guards', calls: [
        [-5, ['returned', '"negative"']],
        [0, ['returned', '"zero"']],
        [7, ['returned', '"positive"']],
    ] },
    { name: 'loops', directory: 'spec/control-flow/loops', calls: [
        [5, ['returned', '8']],
        [100, ['returned', '128']],
    ] },
    { name: 'switch_statement', directory: 'spec/control-flow/switch', calls: [
        [0, ['returned', '"container"']],
        [1, ['returned', '"container"']],
        [2, ['returned', '"text"']],
        [3, ['threw', '["unknown",3]']],
    ] },
    { name: 'number_conversion', directory: 'spec/conversions/number', calls: [
        [7, ['returned', '[7,16,1,7]']],
        [0.5, ['returned', '[0.5,16,1,0.5]']],
    ] },
    { name: 'string_conversion', directory: 'spec/conversions/string', calls: [
        [42, ['returned', '["42","42","1,2","true"]']],
        [-0.5, ['returned', '["-0.5","42","1,2","false"]']],
    ] },
    { name: 'functions', directory: 'spec/functions', calls: [
        [1, ['returned', '[1,10]']],
        [2, ['returned', '[1,20]']],
    ] },
    { name: 'call_statements', directory: 'spec/functions/call-statements', calls: [
        [2, ['returned', '3']],
        [5, ['threw', '"out of range"']],
    ] },
    { name: 'calls', directory: 'spec/functions/calls', calls: [
        [1, ['returned', '[11,[3,1,4,5]]']],
        [3, ['returned', '[13,[3,3,4,5]]']],
    ] },
    { name: 'captures', directory: 'spec/functions/captures', calls: [
        [1, ['returned', '7']],
        [10, ['returned', '16']],
    ] },
    { name: 'function_outputs', directory: 'spec/functions/function-outputs', calls: [
        [0, ['returned', '[2,1]']],
        [2, ['returned', '[2,3]']],
    ] },
    { name: 'names_and_identity', directory: 'spec/functions/names-and-identity', calls: [
        [0, ['returned', '[true,false,true]']],
        [1, ['returned', '[true,false,false]']],
    ] },
    { name: 'parameters', directory: 'spec/functions/parameters', calls: [
        [1, ['returned', '[[1,10,0],[1,2,2]]']],
        [4, ['returned', '[[4,10,0],[4,8,2]]']],
    ] },
    { name: 'comments', directory: 'spec/lexical/comments', calls: [
        [1, ['returned', '2']],
        [-42.5, ['returned', '-85']],
    ] },
    { name: 'identifiers', directory: 'spec/lexical/identifiers', calls: [
        [1, ['returned', '[2,2,3,4]']],
        [2, ['returned', '[3,2,3,4]']],
    ] },
    { name: 'string_escapes', directory: 'spec/lexical/string-escapes', calls: [
        [0, ['returned', '8']],
        [1, ['returned', '4']],
        [2, ['returned', '1']],
    ] },
    { name: 'whitespace', directory: 'spec/lexical/whitespace', calls: [
        [1, ['returned', '2']],
        [2, ['returned', '3']],
    ] },
    { name: 'exports', directory: 'spec/modules/exports', calls: [
        [1, ['returned', '5']],
        [2, ['returned', '10']],
    ] },
    { name: 'operators', directory: 'spec/operators', calls: [
        [1, ['returned', '[7,0,2,-2,false,"number","small"]']],
        [2, ['returned', '[8,1,4,-3,false,"number","big"]']],
    ] },
    { name: 'grouping', directory: 'spec/operators/grouping', calls: [
        [1, ['returned', '[9,7,2]']],
        [2, ['returned', '[12,8,2]']],
    ] },
    { name: 'instanceof', directory: 'spec/operators/instanceof', calls: [
        [0, ['returned', 'true']],
        [1, ['returned', 'false']],
    ] },
    { name: 'property_access', directory: 'spec/property-access', calls: [
        [0, ['returned', '[80,2]']],
        [1, ['returned', '[443,2]']],
    ] },
    { name: 'entries', directory: 'spec/property-access/entries', calls: [
        [0, ['returned', '"newline"']],
        [1, ['returned', 'undefined']],
    ] },
    { name: 'optional_chaining', directory: 'spec/property-access/optional-chaining', calls: [
        [0, ['returned', '[1,[2],[3]]']],
        [1, ['returned', '[undefined,undefined,undefined]']],
    ] },
    { name: 'values', directory: 'spec/values', calls: [
        [1, ['returned', '[1,"s",true,null,[1],-1,"bigint"]']],
        [2, ['returned', '[2,"s",true,null,[2],-2,"bigint"]']],
    ] },
    { name: 'arrays', directory: 'spec/values/arrays', calls: [
        [1, ['returned', '[3,["hello",1,[true,null],2],true]']],
        [2, ['returned', '[3,["hello",2,[true,null],3],true]']],
    ] },
    { name: 'bigints', directory: 'spec/values/bigints', calls: [
        [0, ['returned', '[0n,"bigint"]']],
        [1, ['returned', '[68n,"bigint"]']],
        [2, ['returned', '[-68n,"bigint"]']],
    ] },
    { name: 'numbers', directory: 'spec/values/numbers', calls: [
        [0, ['returned', '0']],
        [1, ['returned', '-85']],
        [2, ['returned', '600']],
        [3, ['returned', '2e-7']],
    ] },
    { name: 'objects', directory: 'spec/values/objects', calls: [
        [1, ['returned', '4']],
        [2, ['returned', '5']],
    ] },
    { name: 'strings', directory: 'spec/values/strings', calls: [
        [0, ['returned', '6']],
        [1, ['returned', '3']],
    ] },
    { name: 'template_literals', directory: 'spec/values/template-literals', calls: [
        [1, ['returned', '"Hello, 1 world!"']],
        [2, ['returned', '"Hello, 2 worlds!"']],
    ] },
]

/**
 * The listed sample in `directory`, which the page of that sample shows.
 * A directory no sample lists is a page that names the wrong place, refused
 * when the page is loaded rather than when the reader presses Run.
 *
 * @type {(directory: string) => Place}
 */
export const placeAt = directory => {
    const place = samples.find(s => s.directory === directory)
    if (place === undefined) { throw `no sample is listed in ${directory}` }
    return place
}

/**
 * The listed function sample in `directory`, with its calls.
 *
 * @type {(directory: string) => FunctionPlace}
 */
export const functionPlaceAt = directory => {
    const place = placeAt(directory)
    if (!('calls' in place)) { throw `the sample in ${directory} lists no calls` }
    return /** @type {FunctionPlace} */ (place)
}
