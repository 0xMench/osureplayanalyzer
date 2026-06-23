// Type stub for the vendored worker-free LZMA decompress build.
export const LZMA: {
  decompress(
    input: Uint8Array | number[],
    on_finish: (result: string | number[] | null, error: unknown) => void,
    on_progress?: (percent: number) => void
  ): void
}
