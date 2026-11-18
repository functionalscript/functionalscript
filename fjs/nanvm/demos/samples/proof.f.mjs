import { assert, assertEq } from '../../../asserts/module.f.js'
import { functionPlaceAt, placeAt, samples } from './module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'
import { dedup } from '../../../types/array/module.f.js'

export const proof = {
    // A name is the sample's WASM export, so no two may share one, nor two a directory.
    unique: () => {
        assertEq(dedup(samples.map(({ name }) => name)).length, samples.length)
        assertEq(dedup(samples.map(({ directory }) => directory)).length, samples.length)
    },
    // A function sample lists at least one call, each input once.
    calls: () => {
        for (const place of samples) {
            if (!hasEntry(place, 'calls')) { continue }
            assert(place.calls.length > 0, place.name)
            assertEq(dedup(place.calls.map(([input]) => input)).length, place.calls.length)
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
