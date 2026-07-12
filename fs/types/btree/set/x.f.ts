export type F =
    | readonly[0  , readonly[number]]
    | readonly[0|1, readonly[number,number]]
    | readonly[  1, readonly[number,number,number]]

const f = ([i, x]: F): undefined => {
    switch (i) {
        // cover cases:
        // - `readonly[0, readonly[number]]` and
        // - `readonly[0, readonly[number,number]]`
        case 0: {
            const _x0: 1|2 = x.length
            switch (x.length) {
                case 1: case 2: { return undefined }
            }
            // // Workaround (w/o this workaround TS 7.0.2 fails to compile the valid code):
            // throw 'unreachable'
        }
        // cover cases:
        // `readonly[1, readonly[number,number]]` and
        // `readonly[1, readonly[number,number,number]]`
        case 1: {
            // TS 6.0.3: no errors
            // TS 7.0.2: error TS2339: Property 'length' does not exist on type 'never'.
            const _x1: 2|3 = x.length
        }
    }
}
