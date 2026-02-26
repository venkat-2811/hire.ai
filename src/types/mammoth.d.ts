declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    buffer?: ArrayBuffer | Uint8Array | Buffer;
    path?: string;
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type?: string; message?: string }>;
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}
