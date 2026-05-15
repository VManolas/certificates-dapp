// Type definitions for circomlibjs
// circomlibjs doesn't include TypeScript definitions, so we declare them here

declare module 'circomlibjs' {
  export interface PoseidonInstance {
    (inputs: bigint[]): any;
    F: {
      toString(field: any): string;
    };
  }

  export function buildPoseidon(): Promise<PoseidonInstance>;
}
