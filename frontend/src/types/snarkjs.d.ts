declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      input: Record<string, string>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;

    verify(
      vk: object,
      publicSignals: string[],
      proof: object
    ): Promise<boolean>;
  };
}
