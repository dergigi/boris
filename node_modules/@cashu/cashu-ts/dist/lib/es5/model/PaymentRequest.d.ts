import { PaymentRequestTransport, PaymentRequestTransportType } from './types';
export declare class PaymentRequest {
    transport: Array<PaymentRequestTransport>;
    id?: string;
    amount?: number;
    unit?: string;
    mints?: Array<string>;
    description?: string;
    singleUse: boolean;
    constructor(transport: Array<PaymentRequestTransport>, id?: string, amount?: number, unit?: string, mints?: Array<string>, description?: string, singleUse?: boolean);
    toEncodedRequest(): string;
    getTransport(type: PaymentRequestTransportType): PaymentRequestTransport;
    static fromEncodedRequest(encodedRequest: string): PaymentRequest;
}
