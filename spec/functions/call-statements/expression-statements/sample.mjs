/** @type {(o: { readonly x: number }) => number} */
const f = o => {
    o.x;
    return o.x + 1;
};
export default f({ x: 0 });
