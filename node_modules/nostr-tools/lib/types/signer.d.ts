import { EventTemplate, VerifiedEvent } from './core.ts';
export interface Signer {
    getPublicKey(): Promise<string>;
    signEvent(event: EventTemplate): Promise<VerifiedEvent>;
}
export declare class PlainKeySigner implements Signer {
    private secretKey;
    constructor(secretKey: Uint8Array);
    getPublicKey(): Promise<string>;
    signEvent(event: EventTemplate): Promise<VerifiedEvent>;
}
