// nipb7.ts
import { sha256 } from "@noble/hashes/sha256";

// utils.ts
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();

// nipb7.ts
var BlossomClient = class {
  mediaserver;
  signer;
  constructor(mediaserver, signer) {
    if (!mediaserver.startsWith("http")) {
      mediaserver = "https://" + mediaserver;
    }
    this.mediaserver = mediaserver.replace(/\/$/, "") + "/";
    this.signer = signer;
  }
  async httpCall(method, url, contentType, addAuthorization, body, result) {
    const headers = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    if (addAuthorization) {
      const auth = await addAuthorization();
      if (auth) {
        headers["Authorization"] = auth;
      }
    }
    const response = await fetch(this.mediaserver + url, {
      method,
      headers,
      body
    });
    if (response.status >= 300) {
      const reason = response.headers.get("X-Reason") || response.statusText;
      throw new Error(`${url} returned an error (${response.status}): ${reason}`);
    }
    if (result !== null && response.headers.get("content-type")?.includes("application/json")) {
      return await response.json();
    }
    return response;
  }
  async authorizationHeader(modify) {
    const now = Math.floor(Date.now() / 1e3);
    const event = {
      created_at: now,
      kind: 24242,
      content: "blossom stuff",
      tags: [["expiration", String(now + 60)]]
    };
    if (modify) {
      modify(event);
    }
    try {
      const signedEvent = await this.signer.signEvent(event);
      const eventJson = JSON.stringify(signedEvent);
      return "Nostr " + btoa(eventJson);
    } catch (error) {
      return "";
    }
  }
  isValid32ByteHex(hash) {
    return /^[a-f0-9]{64}$/i.test(hash);
  }
  async check(hash) {
    if (!this.isValid32ByteHex(hash)) {
      throw new Error(`${hash} is not a valid 32-byte hex string`);
    }
    try {
      await this.httpCall("HEAD", hash);
    } catch (error) {
      throw new Error(`failed to check for ${hash}: ${error}`);
    }
  }
  async uploadBlob(file, contentType) {
    const hash = bytesToHex(sha256(new Uint8Array(await file.arrayBuffer())));
    const actualContentType = contentType || file.type || "application/octet-stream";
    const bd = await this.httpCall(
      "PUT",
      "upload",
      actualContentType,
      () => this.authorizationHeader((evt) => {
        evt.tags.push(["t", "upload"]);
        evt.tags.push(["x", hash]);
      }),
      file,
      {}
    );
    return bd;
  }
  async uploadFile(file) {
    return this.uploadBlob(file, file.type);
  }
  async download(hash) {
    if (!this.isValid32ByteHex(hash)) {
      throw new Error(`${hash} is not a valid 32-byte hex string`);
    }
    const authHeader = await this.authorizationHeader((evt) => {
      evt.tags.push(["t", "get"]);
      evt.tags.push(["x", hash]);
    });
    const response = await fetch(this.mediaserver + hash, {
      method: "GET",
      headers: {
        Authorization: authHeader
      }
    });
    if (response.status >= 300) {
      throw new Error(`${hash} is not present in ${this.mediaserver}: ${response.status}`);
    }
    return await response.arrayBuffer();
  }
  async downloadAsBlob(hash) {
    const arrayBuffer = await this.download(hash);
    return new Blob([arrayBuffer]);
  }
  async list() {
    const pubkey = await this.signer.getPublicKey();
    if (!this.isValid32ByteHex(pubkey)) {
      throw new Error(`pubkey ${pubkey} is not valid`);
    }
    try {
      const bds = await this.httpCall(
        "GET",
        `list/${pubkey}`,
        void 0,
        () => this.authorizationHeader((evt) => {
          evt.tags.push(["t", "list"]);
        }),
        void 0,
        []
      );
      return bds;
    } catch (error) {
      throw new Error(`failed to list blobs: ${error}`);
    }
  }
  async delete(hash) {
    if (!this.isValid32ByteHex(hash)) {
      throw new Error(`${hash} is not a valid 32-byte hex string`);
    }
    try {
      await this.httpCall(
        "DELETE",
        hash,
        void 0,
        () => this.authorizationHeader((evt) => {
          evt.tags.push(["t", "delete"]);
          evt.tags.push(["x", hash]);
        }),
        void 0,
        null
      );
    } catch (error) {
      throw new Error(`failed to delete ${hash}: ${error}`);
    }
  }
};
export {
  BlossomClient
};
