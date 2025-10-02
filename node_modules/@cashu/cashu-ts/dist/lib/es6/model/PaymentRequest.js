import { encodeBase64toUint8 } from '../base64';
import { decodeCBOR, encodeCBOR } from '../cbor';
import { Buffer } from 'buffer';
var PaymentRequest = /** @class */ (function () {
    function PaymentRequest(transport, id, amount, unit, mints, description, singleUse) {
        if (singleUse === void 0) { singleUse = false; }
        this.transport = transport;
        this.id = id;
        this.amount = amount;
        this.unit = unit;
        this.mints = mints;
        this.description = description;
        this.singleUse = singleUse;
    }
    PaymentRequest.prototype.toEncodedRequest = function () {
        var rawRequest = {
            t: this.transport.map(function (t) { return ({ t: t.type, a: t.target, g: t.tags }); })
        };
        if (this.id) {
            rawRequest.i = this.id;
        }
        if (this.amount) {
            rawRequest.a = this.amount;
        }
        if (this.unit) {
            rawRequest.u = this.unit;
        }
        if (this.mints) {
            rawRequest.m = this.mints;
        }
        if (this.description) {
            rawRequest.d = this.description;
        }
        if (this.singleUse) {
            rawRequest.s = this.singleUse;
        }
        var data = encodeCBOR(rawRequest);
        var encodedData = Buffer.from(data).toString('base64');
        return 'creq' + 'A' + encodedData;
    };
    PaymentRequest.prototype.getTransport = function (type) {
        return this.transport.find(function (t) { return t.type === type; });
    };
    PaymentRequest.fromEncodedRequest = function (encodedRequest) {
        if (!encodedRequest.startsWith('creq')) {
            throw new Error('unsupported pr: invalid prefix');
        }
        var version = encodedRequest[4];
        if (version !== 'A') {
            throw new Error('unsupported pr version');
        }
        var encodedData = encodedRequest.slice(5);
        var data = encodeBase64toUint8(encodedData);
        var decoded = decodeCBOR(data);
        var transports = decoded.t.map(function (t) { return ({ type: t.t, target: t.a, tags: t.g }); });
        return new PaymentRequest(transports, decoded.i, decoded.a, decoded.u, decoded.m, decoded.d, decoded.s);
    };
    return PaymentRequest;
}());
export { PaymentRequest };
//# sourceMappingURL=PaymentRequest.js.map