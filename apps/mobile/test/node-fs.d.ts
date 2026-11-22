// The app has no Node types (it targets React Native). Tests read a few generated assets, so declare just that.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): { readUInt32BE(offset: number): number };
}
