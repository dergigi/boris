// nip55.ts
function encodeParams(params) {
  return new URLSearchParams(params).toString();
}
function filterUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== void 0));
}
function buildUri({
  base,
  type,
  callbackUrl,
  returnType = "signature",
  compressionType = "none",
  ...params
}) {
  const baseParams = {
    type,
    compressionType,
    returnType,
    callbackUrl,
    id: params.id,
    current_user: params.currentUser,
    permissions: params.permissions && params.permissions.length > 0 ? encodeURIComponent(JSON.stringify(params.permissions)) : void 0,
    pubKey: params.pubKey,
    plainText: params.plainText,
    encryptedText: params.encryptedText,
    appName: params.appName
  };
  const filteredParams = filterUndefined(baseParams);
  return `${base}?${encodeParams(filteredParams)}`;
}
function buildDefaultUri(type, params) {
  return buildUri({
    base: "nostrsigner:",
    type,
    ...params
  });
}
function getPublicKeyUri({ permissions = [], ...params }) {
  return buildDefaultUri("get_public_key", { permissions, ...params });
}
function signEventUri({ eventJson, ...params }) {
  return buildUri({
    base: `nostrsigner:${encodeURIComponent(JSON.stringify(eventJson))}`,
    type: "sign_event",
    ...params
  });
}
function encryptUri(type, params) {
  return buildDefaultUri(type, { ...params, plainText: params.content });
}
function decryptUri(type, params) {
  return buildDefaultUri(type, { ...params, encryptedText: params.content });
}
function encryptNip04Uri(params) {
  return encryptUri("nip04_encrypt", params);
}
function decryptNip04Uri(params) {
  return decryptUri("nip04_decrypt", params);
}
function encryptNip44Uri(params) {
  return encryptUri("nip44_encrypt", params);
}
function decryptNip44Uri(params) {
  return decryptUri("nip44_decrypt", params);
}
function decryptZapEventUri({ eventJson, ...params }) {
  return buildUri({
    base: `nostrsigner:${encodeURIComponent(JSON.stringify(eventJson))}`,
    type: "decrypt_zap_event",
    ...params
  });
}
export {
  decryptNip04Uri,
  decryptNip44Uri,
  decryptZapEventUri,
  encryptNip04Uri,
  encryptNip44Uri,
  getPublicKeyUri,
  signEventUri
};
