type BaseParams = {
    callbackUrl?: string;
    returnType?: 'signature' | 'event';
    compressionType?: 'none' | 'gzip';
};
type PermissionsParams = BaseParams & {
    permissions?: {
        type: string;
        kind?: number;
    }[];
};
type EventUriParams = BaseParams & {
    eventJson: Record<string, unknown>;
    id?: string;
    currentUser?: string;
};
type EncryptDecryptParams = BaseParams & {
    pubKey: string;
    content: string;
    id?: string;
    currentUser?: string;
};
export declare function getPublicKeyUri({ permissions, ...params }: PermissionsParams): string;
export declare function signEventUri({ eventJson, ...params }: EventUriParams): string;
export declare function encryptNip04Uri(params: EncryptDecryptParams): string;
export declare function decryptNip04Uri(params: EncryptDecryptParams): string;
export declare function encryptNip44Uri(params: EncryptDecryptParams): string;
export declare function decryptNip44Uri(params: EncryptDecryptParams): string;
export declare function decryptZapEventUri({ eventJson, ...params }: EventUriParams): string;
export {};
