import { Proof } from './index';
export type RawTransport = {
    t: PaymentRequestTransportType;
    a: string;
    g?: Array<Array<string>>;
};
export type RawPaymentRequest = {
    i?: string;
    a?: number;
    u?: string;
    s?: boolean;
    m?: Array<string>;
    d?: string;
    t: Array<RawTransport>;
};
export type PaymentRequestTransport = {
    type: PaymentRequestTransportType;
    target: string;
    tags?: Array<Array<string>>;
};
export declare enum PaymentRequestTransportType {
    POST = "post",
    NOSTR = "nostr"
}
export type PaymentRequestPayload = {
    id?: string;
    memo?: string;
    unit: string;
    mint: string;
    proofs: Array<Proof>;
};
