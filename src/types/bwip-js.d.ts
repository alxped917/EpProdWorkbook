declare module "bwip-js" {
  interface BarcodeOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
  }
  function toBuffer(options: BarcodeOptions): Promise<Buffer>;
  export default { toBuffer };
}
