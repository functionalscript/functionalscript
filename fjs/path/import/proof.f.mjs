import { resolve, decode } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    decode: () => assertEq(decode('./%64ep.f.js'), './dep.f.js'),
    // Only the specifier is decoded, once; the importer's filesystem root stays put.
    importPath: () => {
        assertEq(resolve('main.f.js')('./%64ep.f.js'), 'dep.f.js')
        assertEq(resolve('C:/repo/main.f.js')('./%64ep.f.js'), 'C:/repo/dep.f.js')
        assertEq(resolve('dir%25/main.f.js')('./dep.f.js'), 'dir%25/dep.f.js')
        assertEq(resolve('main.f.js')('./%255C.f.js'), '%5C.f.js')
        assertEq(resolve('main.f.js')('./%253A.f.js'), '%3A.f.js')
    },
    importPathRefusals: () => {
        for (const specifier of [
            './bad%.f.js', './%ff.f.js', './a%2Fb.f.js', './a%5Cb.f.js', './a%00b.f.js',
            './C%3A/x.f.js', './dir/../c%3a/x.f.js', './%43%3a/x.f.js', './C:relative.f.js',
            './name%3Astream.f.js', './%ED%A0%80.f.js', './%ED%B0%80.f.js',
        ]) {
            assertEq(resolve('main.f.js')(specifier), null, specifier)
        }
    },
    // Native URL input is a scalar-value string. Do not apply that replacement
    // to percent-encoded UTF-8: the ED A0 80 case above must still fail.
    importPathSurrogates: () => {
        assertEq(resolve('main.f.js')('./\ud800.f.js'), '\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\udc00.f.js'), '\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\ud800%20.f.js'), '\ufffd .f.js')
        assertEq(resolve('main.f.js')('./%61\udc00.f.js'), 'a\ufffd.f.js')
        assertEq(resolve('main.f.js')('./\ud83d\ude00.f.js'), '\ud83d\ude00.f.js')
    },
}
