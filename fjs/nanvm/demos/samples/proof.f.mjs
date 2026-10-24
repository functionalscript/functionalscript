import { assert, assertEq } from '../../../asserts/module.f.js'
import { functionPlaceAt, placeAt, samples } from './module.f.mjs'

export const proof = {
    // A name is the sample's WASM export, so no two may share one, nor two a directory.
    unique: () => {
        assertEq(new Set(samples.map(({ name }) => name)).size, samples.length)
        assertEq(new Set(samples.map(({ directory }) => directory)).size, samples.length)
    },
    // A function sample lists at least one call, each input once.
    calls: () => {
        for (const place of samples) {
            if (!('calls' in place)) { continue }
            assert(place.calls.length > 0, place.name)
            assertEq(new Set(place.calls.map(([input]) => input)).size, place.calls.length)
        }
    },
    placeAt: () => assertEq(placeAt('spec/operators/comma').name, 'comma'),
    functionPlaceAt: () => assertEq(functionPlaceAt('spec/operators/comma').calls[0][0], 1),
    throw: {
        // A page that names a directory no sample is in.
        unlisted: () => placeAt('spec/nowhere'),
        // A program sample has no calls to make.
        program: () => functionPlaceAt('fjs/nanvm/demos/hello'),
    },
}
