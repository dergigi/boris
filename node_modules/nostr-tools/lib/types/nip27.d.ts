import { AddressPointer, EventPointer, ProfilePointer } from './nip19.ts';
export type Block = {
    type: 'text';
    text: string;
} | {
    type: 'reference';
    pointer: ProfilePointer | AddressPointer | EventPointer;
} | {
    type: 'url';
    url: string;
} | {
    type: 'relay';
    url: string;
} | {
    type: 'image';
    url: string;
} | {
    type: 'video';
    url: string;
} | {
    type: 'audio';
    url: string;
};
export declare function parse(content: string): Iterable<Block>;
