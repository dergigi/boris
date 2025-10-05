import { NostrEvent, type Event, type EventTemplate } from './pure.ts';
export declare function useFetchImplementation(fetchImplementation: any): void;
export declare function getZapEndpoint(metadata: Event): Promise<null | string>;
type ProfileZap = {
    pubkey: string;
    amount: number;
    comment?: string;
    relays: string[];
};
type EventZap = {
    event: NostrEvent;
    amount: number;
    comment?: string;
    relays: string[];
};
export declare function makeZapRequest(params: ProfileZap | EventZap): EventTemplate;
export declare function validateZapRequest(zapRequestString: string): string | null;
export declare function makeZapReceipt({ zapRequest, preimage, bolt11, paidAt, }: {
    zapRequest: string;
    preimage?: string;
    bolt11: string;
    paidAt: Date;
}): EventTemplate;
export declare function getSatoshisAmountFromBolt11(bolt11: string): number;
export {};
