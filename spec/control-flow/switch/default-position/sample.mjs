/** @type {(n: number) => string} */
const name = n => {
    switch (n) {
        default: { return "many"; }
        case 1: { return "one"; }
    }
};
export default name(1);
