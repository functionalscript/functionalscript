export type F =
    | readonly[2    , readonly[number]]
    | readonly[2|3|4, readonly[number,number]]
    | readonly[  3  , readonly[number,number,number,number,number]]

const f = ([i, x]: F): undefined => {
    switch (i) {
        case 2: {
            // TODO: remove after TSGO fix the regression.
            const _xl: 1|2 = x.length
            switch (x.length) {
                case 1: case 2: { return undefined }
            }
            // TODO: remove after TSGO fix the regression.
            //throw 'unreachable'
        }
        case 3: {
            // replace
            // TODO: remove after TSGO fix the regression.
            const _xl: 2|5 = x.length
            switch (x.length) {
                case 2: case 5: { return undefined }
            }
            // TODO: remove after TSGO fix the regression.
            throw 'unreachable'
        }
        case 4: {
            // insert
            // TODO: remove after TSGO fix the regression.
            const _xl: 2 = x.length
            return undefined
        }
    }
}
