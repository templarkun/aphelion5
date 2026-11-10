/** Vite "?raw" imports: a file's text. */
declare module "*?raw" {
  const text: string;
  export default text;
}

/** Vite's import.meta.glob (only the eager form is used: the art pictures, `src/web/glyphs.ts`). */
interface ImportMeta {
  glob(pattern: string, options: { eager: true; query: string; import: "default" }): Record<string, unknown>;
}
