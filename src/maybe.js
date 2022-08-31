export function maybe(o, ...path) {
    return (!o || !path.length) ? o :
      maybe(o[path[0]], ...path.slice(1));
};