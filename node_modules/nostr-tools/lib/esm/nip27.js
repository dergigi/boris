// nip19.ts
import { bytesToHex as bytesToHex2, concatBytes, hexToBytes as hexToBytes2 } from "@noble/hashes/utils";
import { bech32 } from "@scure/base";

// utils.ts
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();

// nip19.ts
var Bech32MaxSize = 5e3;
function decode(code) {
  let { prefix, words } = bech32.decode(code, Bech32MaxSize);
  let data = new Uint8Array(bech32.fromWords(words));
  switch (prefix) {
    case "nprofile": {
      let tlv = parseTLV(data);
      if (!tlv[0]?.[0])
        throw new Error("missing TLV 0 for nprofile");
      if (tlv[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      return {
        type: "nprofile",
        data: {
          pubkey: bytesToHex2(tlv[0][0]),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
        }
      };
    }
    case "nevent": {
      let tlv = parseTLV(data);
      if (!tlv[0]?.[0])
        throw new Error("missing TLV 0 for nevent");
      if (tlv[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      if (tlv[2] && tlv[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (tlv[3] && tlv[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "nevent",
        data: {
          id: bytesToHex2(tlv[0][0]),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
          author: tlv[2]?.[0] ? bytesToHex2(tlv[2][0]) : void 0,
          kind: tlv[3]?.[0] ? parseInt(bytesToHex2(tlv[3][0]), 16) : void 0
        }
      };
    }
    case "naddr": {
      let tlv = parseTLV(data);
      if (!tlv[0]?.[0])
        throw new Error("missing TLV 0 for naddr");
      if (!tlv[2]?.[0])
        throw new Error("missing TLV 2 for naddr");
      if (tlv[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (!tlv[3]?.[0])
        throw new Error("missing TLV 3 for naddr");
      if (tlv[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "naddr",
        data: {
          identifier: utf8Decoder.decode(tlv[0][0]),
          pubkey: bytesToHex2(tlv[2][0]),
          kind: parseInt(bytesToHex2(tlv[3][0]), 16),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
        }
      };
    }
    case "nsec":
      return { type: prefix, data };
    case "npub":
    case "note":
      return { type: prefix, data: bytesToHex2(data) };
    default:
      throw new Error(`unknown prefix ${prefix}`);
  }
}
function parseTLV(data) {
  let result = {};
  let rest = data;
  while (rest.length > 0) {
    let t = rest[0];
    let l = rest[1];
    let v = rest.slice(2, 2 + l);
    rest = rest.slice(2 + l);
    if (v.length < l)
      throw new Error(`not enough data to read on TLV ${t}`);
    result[t] = result[t] || [];
    result[t].push(v);
  }
  return result;
}

// nip27.ts
var noCharacter = /\W/m;
var noURLCharacter = /\W |\W$|$|,| /m;
function* parse(content) {
  const max = content.length;
  let prevIndex = 0;
  let index = 0;
  while (index < max) {
    let u = content.indexOf(":", index);
    if (u === -1) {
      break;
    }
    if (content.substring(u - 5, u) === "nostr") {
      const m = content.substring(u + 60).match(noCharacter);
      const end = m ? u + 60 + m.index : max;
      try {
        let pointer;
        let { data, type } = decode(content.substring(u + 1, end));
        switch (type) {
          case "npub":
            pointer = { pubkey: data };
            break;
          case "nsec":
          case "note":
            index = end + 1;
            continue;
          default:
            pointer = data;
        }
        if (prevIndex !== u - 5) {
          yield { type: "text", text: content.substring(prevIndex, u - 5) };
        }
        yield { type: "reference", pointer };
        index = end;
        prevIndex = index;
        continue;
      } catch (_err) {
        index = u + 1;
        continue;
      }
    } else if (content.substring(u - 5, u) === "https" || content.substring(u - 4, u) === "http") {
      const m = content.substring(u + 4).match(noURLCharacter);
      const end = m ? u + 4 + m.index : max;
      const prefixLen = content[u - 1] === "s" ? 5 : 4;
      try {
        let url = new URL(content.substring(u - prefixLen, end));
        if (url.hostname.indexOf(".") === -1) {
          throw new Error("invalid url");
        }
        if (prevIndex !== u - prefixLen) {
          yield { type: "text", text: content.substring(prevIndex, u - prefixLen) };
        }
        if (url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg") || url.pathname.endsWith(".gif") || url.pathname.endsWith(".webp")) {
          yield { type: "image", url: url.toString() };
          index = end;
          prevIndex = index;
          continue;
        }
        if (url.pathname.endsWith(".mp4") || url.pathname.endsWith(".avi") || url.pathname.endsWith(".webm") || url.pathname.endsWith(".mkv")) {
          yield { type: "video", url: url.toString() };
          index = end;
          prevIndex = index;
          continue;
        }
        if (url.pathname.endsWith(".mp3") || url.pathname.endsWith(".aac") || url.pathname.endsWith(".ogg") || url.pathname.endsWith(".opus")) {
          yield { type: "audio", url: url.toString() };
          index = end;
          prevIndex = index;
          continue;
        }
        yield { type: "url", url: url.toString() };
        index = end;
        prevIndex = index;
        continue;
      } catch (_err) {
        index = end + 1;
        continue;
      }
    } else if (content.substring(u - 3, u) === "wss" || content.substring(u - 2, u) === "ws") {
      const m = content.substring(u + 4).match(noURLCharacter);
      const end = m ? u + 4 + m.index : max;
      const prefixLen = content[u - 1] === "s" ? 3 : 2;
      try {
        let url = new URL(content.substring(u - prefixLen, end));
        if (url.hostname.indexOf(".") === -1) {
          throw new Error("invalid ws url");
        }
        if (prevIndex !== u - prefixLen) {
          yield { type: "text", text: content.substring(prevIndex, u - prefixLen) };
        }
        yield { type: "relay", url: url.toString() };
        index = end;
        prevIndex = index;
        continue;
      } catch (_err) {
        index = end + 1;
        continue;
      }
    } else {
      index = u + 1;
      continue;
    }
  }
  if (prevIndex !== max) {
    yield { type: "text", text: content.substring(prevIndex) };
  }
}
export {
  parse
};
