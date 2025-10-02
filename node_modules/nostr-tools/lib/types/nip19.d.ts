export type NProfile = `nprofile1${string}`;
export type NEvent = `nevent1${string}`;
export type NAddr = `naddr1${string}`;
export type NSec = `nsec1${string}`;
export type NPub = `npub1${string}`;
export type Note = `note1${string}`;
export type Ncryptsec = `ncryptsec1${string}`;
export declare const NostrTypeGuard: {
    isNProfile: (value?: string | null) => value is NProfile;
    isNEvent: (value?: string | null) => value is NEvent;
    isNAddr: (value?: string | null) => value is NAddr;
    isNSec: (value?: string | null) => value is NSec;
    isNPub: (value?: string | null) => value is NPub;
    isNote: (value?: string | null) => value is Note;
    isNcryptsec: (value?: string | null) => value is Ncryptsec;
};
export declare const Bech32MaxSize = 5000;
/**
 * Bech32 regex.
 * @see https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki#bech32
 */
export declare const BECH32_REGEX: RegExp;
export type ProfilePointer = {
    pubkey: string;
    relays?: string[];
};
export type EventPointer = {
    id: string;
    relays?: string[];
    author?: string;
    kind?: number;
};
export type AddressPointer = {
    identifier: string;
    pubkey: string;
    kind: number;
    relays?: string[];
};
export declare function decodeNostrURI(nip19code: string): ReturnType<typeof decode> | {
    type: 'invalid';
    data: null;
};
export type DecodedNevent = {
    type: 'nevent';
    data: EventPointer;
};
export type DecodedNprofile = {
    type: 'nprofile';
    data: ProfilePointer;
};
export type DecodedNaddr = {
    type: 'naddr';
    data: AddressPointer;
};
export type DecodedNsec = {
    type: 'nsec';
    data: Uint8Array;
};
export type DecodedNpub = {
    type: 'npub';
    data: string;
};
export type DecodedNote = {
    type: 'note';
    data: string;
};
export type DecodedResult = DecodedNevent | DecodedNprofile | DecodedNaddr | DecodedNpub | DecodedNsec | DecodedNote;
export declare function decode(nip19: NEvent): DecodedNevent;
export declare function decode(nip19: NProfile): DecodedNprofile;
export declare function decode(nip19: NAddr): DecodedNaddr;
export declare function decode(nip19: NSec): DecodedNsec;
export declare function decode(nip19: NPub): DecodedNpub;
export declare function decode(nip19: Note): DecodedNote;
export declare function decode(code: string): DecodedResult;
export declare function nsecEncode(key: Uint8Array): NSec;
export declare function npubEncode(hex: string): NPub;
export declare function noteEncode(hex: string): Note;
export declare function encodeBytes<Prefix extends string>(prefix: Prefix, bytes: Uint8Array): `${Prefix}1${string}`;
export declare function nprofileEncode(profile: ProfilePointer): NProfile;
export declare function neventEncode(event: EventPointer): NEvent;
export declare function naddrEncode(addr: AddressPointer): NAddr;
