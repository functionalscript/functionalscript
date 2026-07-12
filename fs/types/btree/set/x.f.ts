export type F =
    | readonly[0  , readonly[number]]
    | readonly[0|1, readonly[number,number]]
    | readonly[  1, readonly[number,number,number]]

const f = ([i, x]: F): undefined => {
    switch (i) {
        case 0: {
            const _x0: 1|2 = x.length
            switch (x.length) {
                case 1: case 2: { return undefined }
            }
            // // Workaround:
            // throw 'unreachable'
        }
        case 1: {
            const _x1: 2|3 = x.length
        }
    }
}
