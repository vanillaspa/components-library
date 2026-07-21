export const rawComponents = import.meta.glob('/node_modules/@vanillaspa/components-library/components/**/*.sfc.html', {
    eager: true,
    query: '?raw'
});
