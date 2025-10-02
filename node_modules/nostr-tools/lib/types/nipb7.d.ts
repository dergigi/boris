import { Signer } from './signer.ts';
export type BlobDescriptor = {
    url: string;
    sha256: string;
    size: number;
    type: string;
    uploaded: number;
};
export declare class BlossomClient {
    private mediaserver;
    private signer;
    constructor(mediaserver: string, signer: Signer);
    private httpCall;
    private authorizationHeader;
    private isValid32ByteHex;
    check(hash: string): Promise<void>;
    uploadBlob(file: File | Blob, contentType?: string): Promise<BlobDescriptor>;
    uploadFile(file: File): Promise<BlobDescriptor>;
    download(hash: string): Promise<ArrayBuffer>;
    downloadAsBlob(hash: string): Promise<Blob>;
    list(): Promise<BlobDescriptor[]>;
    delete(hash: string): Promise<void>;
}
