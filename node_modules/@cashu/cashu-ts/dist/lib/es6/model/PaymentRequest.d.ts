import { PaymentRequestTransport, PaymentRequestTransportType } from './types';
export declare class PaymentRequest {
    transport: Array<PaymentRequestTransport>;
    id?: string | undefined;
    amount?: number | undefined;
    unit?: string | undefined;
    mints?: string[] | undefined;
    description?: string | undefined;
    singleUse: boolean;
    constructor(transport: Array<PaymentRequestTransport>, id?: string | undefined, amount?: number | undefined, unit?: string | undefined, mints?: string[] | undefined, description?: string | undefined, singleUse?: boolean);
    toEncodedRequest(): string;
    getTransport(type: PaymentRequestTransportType): PaymentRequestTransport | undefined;
    static fromEncodedRequest(encodedRequest: string): PaymentRequest;
}
