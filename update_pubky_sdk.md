# Pubky SDK 0.6.0 upgrade plan (pubky-explorer)

## Current usage snapshot
- Dependency: `@synonymdev/pubky` is pinned to `^0.4.0-rc3` in `package.json`.
- Code usage is limited to `Client.testnet()`, `client.list(...)`, and `client.fetch(...)` for read-only public browsing.

## Breaking changes in 0.6.0 (vs 0.4.x)

### API surface changes
- **`Client` is now a low-level HTTP bridge only.**
  - Removed methods: `signup`, `signin`, `signout`, `session`, `authRequest`, `sendAuthToken`, and **`list`**.
  - `fetch` remains but is documented for raw HTTP usage; the SDK now prefers higher-level storage actors.
- **New high-level facade `Pubky`.**
  - `new Pubky()` and `Pubky.testnet(host?)` are the primary entrypoints.
  - Provides `publicStorage` (read-only), `signer(...)`, `startAuthFlow(...)`, `restoreSession(...)`, etc.
- **Storage APIs split into `PublicStorage` and `SessionStorage`.**
  - `PublicStorage.list/get/getText/getJson/...` works on *addressed* paths like `pubky<pk>/pub/...` or `pubky://<pk>/pub/...`.
  - `SessionStorage.list/get/put/...` works on *absolute* paths like `/pub/...` for authenticated sessions.
- **Auth flows are now explicit.**
  - `Client.authRequest` + `sendAuthToken` replaced by `Pubky.startAuthFlow(...)` and `Signer.approveAuthRequest(...)`.
- **`Session` changed.**
  - Old `session.pubky()` and `session.capabilities()` replaced by `session.info.publicKey` and `session.info.capabilities`.
  - New `session.storage` for list/get/put/delete operations.
- **Key APIs renamed and relocated.**
  - `Keypair.fromSecretKey(...)` → `Keypair.fromSecret(...)`.
  - `keypair.secretKey()` → `keypair.secret()`.
  - Top-level `createRecoveryFile(...)` / `decryptRecoveryFile(...)` removed; now `keypair.createRecoveryFile(...)` and `Keypair.fromRecoveryFile(...)`.
  - `PublicKey.to_uint8array()` → `PublicKey.toUint8Array()`.
- **New utilities and error types.**
  - `resolvePubky(...)` for converting `pubky...` identifiers to transport URLs.
  - `validateCapabilities(...)` for capability strings.
  - `PubkyError` now exposes structured `name` + optional `data`.
- **Runtime requirement tightened.**
  - Node 20+ is required for dev/build (fetch + WebCrypto).

### Behavioral changes relevant to this app
- **Directory listing is no longer on `Client`.** It now lives on `PublicStorage.list(...)` (for public read-only) or `SessionStorage.list(...)` (for authenticated reads).
- **Public fetches should use `PublicStorage.get(...)`** (returns a `Response`) instead of `Client.fetch(pubky://...)`.
- **Address format is more explicit.**
  - Public operations require `pubky<pk>/pub/...` (preferred) or `pubky://<pk>/pub/...`.
  - Paths must include `/pub/` and directory listings must end with `/`.

## Required changes in this repo

### Code updates
- Replace `Client` usage in `src/state.ts` with the new `Pubky` facade and its `publicStorage` API.
  - `Client.testnet()` → `Pubky.testnet()`.
  - `client.list(...)` → `pubky.publicStorage.list(...)`.
  - `client.fetch(...)` → `pubky.publicStorage.get(...)`.
- Ensure the list cursor matches the new method signature.
  - `cursor` should be `null` when unset (not empty string).
- Keep address formatting with `pubky://.../pub/...` (still valid), or switch to `pubky<pk>/pub/...`.
- Update error handling if needed to surface `PubkyError.name` / `PubkyError.data` (especially for `RequestError` status codes).

### Dependency updates
- Bump `@synonymdev/pubky` to `^0.6.0` in `package.json`.
- Regenerate `package-lock.json` via `npm install`.

### Environment
- Ensure local dev/build runs on Node 20+.

## Step-by-step plan

1. **Update dependencies**
   - Edit `package.json` to `@synonymdev/pubky: "^0.6.0"`.
   - Run `npm install` to refresh `package-lock.json`.

2. **Refactor SDK usage in `src/state.ts`**
   - Replace `Client` import with `Pubky`.
   - Initialize `const pubky = import.meta.env.VITE_TESTNET === "true" ? Pubky.testnet() : new Pubky();`.
   - Replace all `client.list(...)` calls with `pubky.publicStorage.list(...)`.
     - Ensure the path passed is `pubky://${path}` or `pubky<pk>/pub/...` and ends with `/`.
     - Change cursor fallback from `""` to `null`.
   - Replace all `client.fetch(...)` calls with `pubky.publicStorage.get(...)`.
     - Keep using the returned `Response` for `blob()`, `text()`, and header checks.

3. **Update error normalization**
   - Extend `normalizeError(...)` to handle the new `PubkyError` shape (`name`, `data.statusCode`).
   - Keep existing message fallbacks for network/timeout cases.

4. **Verify behavior**
   - Run `npm run build` and manually test:
     - Load a known public key root (auto appends `/pub/`).
     - List directories with shallow/non-shallow toggles.
     - Preview image/text/binary files.
     - Download a file.

## Notes / optional improvements
- If you later add authenticated features, route them through `Pubky.startAuthFlow(...)` and `Session.storage` instead of `Client`.
- If raw fetch is ever needed for pubky identifiers, use `resolvePubky(...)` with `pubky.client.fetch(...)`.
