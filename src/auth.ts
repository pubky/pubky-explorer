import { createSignal } from "solid-js";
import { AuthFlowKind } from "@synonymdev/pubky";
import type { Capabilities, Path, Session } from "@synonymdev/pubky";
import { pubky as pubkyInstance } from "./state";

const STORAGE_KEY = "pkx-session";
const AUTH_CAPABILITIES: Capabilities = "/pub/:rw";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 min

// --- reactive state ---

export const [session, setSession] = createSignal<Session | null>(null);
export const [currentUserPubky, setCurrentUserPubky] = createSignal<string | null>(null);
export const [showSignIn, setShowSignIn] = createSignal(false);
export const [authUrl, setAuthUrl] = createSignal<string | null>(null);
export const [authError, setAuthError] = createSignal<string | null>(null);
export const [authLoading, setAuthLoading] = createSignal(false);

export const isAuthenticated = () => session() !== null;

export function isOwnData(dir: string): boolean {
  const pk = currentUserPubky();
  if (!pk || !dir) return false;
  return dir.startsWith(pk + "/");
}

/** Convert explorer full path to session-relative `/pub/...` path. */
export function toStoragePath(explorerPath: string): Path {
  const pk = currentUserPubky();
  if (pk && explorerPath.startsWith(pk)) {
    return explorerPath.slice(pk.length) as Path;
  }
  return ("/" + explorerPath) as Path;
}

// --- auth flow ---

let flowRef: { free(): void } | null = null;
let canceled = false;

export async function startSignIn() {
  // Cancel any existing flow first
  if (flowRef) {
    try {
      flowRef.free();
    } catch {}
    flowRef = null;
  }

  setAuthError(null);
  setAuthLoading(true);
  canceled = false;

  try {
    const flow = pubkyInstance.startAuthFlow(
      AUTH_CAPABILITIES,
      AuthFlowKind.signin(),
    );

    flowRef = flow;
    setAuthUrl(flow.authorizationUrl);

    let attempts = 0;
    while (!canceled && attempts < POLL_MAX_ATTEMPTS) {
      attempts++;
      try {
        const maybeSession = await flow.tryPollOnce();
        if (maybeSession) {
          onSessionReceived(maybeSession);
          return;
        }
      } catch {
        // retryable – continue polling
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (!canceled) setAuthError("Sign-in timed out. Please try again.");
  } catch (e: any) {
    if (!canceled) setAuthError(e?.message || "Sign-in failed");
  } finally {
    setAuthLoading(false);
    flowRef = null;
  }
}

export function cancelSignIn() {
  canceled = true;
  if (flowRef) {
    try {
      flowRef.free();
    } catch {}
  }
  flowRef = null;
  setShowSignIn(false);
  setAuthUrl(null);
  setAuthError(null);
  setAuthLoading(false);
}

export async function signOut() {
  const s = session();
  if (s) {
    try {
      await s.signout();
    } catch {}
  }
  setSession(null);
  setCurrentUserPubky(null);
  localStorage.removeItem(STORAGE_KEY);
}

export async function restoreSession() {
  const exported = localStorage.getItem(STORAGE_KEY);
  if (!exported) return;
  try {
    const s = await pubkyInstance.restoreSession(exported);
    setSession(s);
    setCurrentUserPubky(s.info.publicKey.z32());
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// --- storage operations ---

export async function putFileContent(relativePath: Path, content: string) {
  const s = session();
  if (!s) throw new Error("Not authenticated");
  if (!relativePath.startsWith("/pub/"))
    throw new Error("Can only write to /pub/ directory");

  const trimmed = content.trim();
  let parsed: any;
  let isJson = false;
  try {
    parsed = JSON.parse(trimmed);
    isJson = true;
  } catch {}

  if (isJson) {
    await s.storage.putJson(relativePath, parsed);
  } else {
    await s.storage.putText(relativePath, content);
  }
}

export async function putFileBytes(relativePath: Path, bytes: Uint8Array) {
  const s = session();
  if (!s) throw new Error("Not authenticated");
  if (!relativePath.startsWith("/pub/"))
    throw new Error("Can only write to /pub/ directory");
  await s.storage.putBytes(relativePath, bytes);
}

export async function deleteFileAtPath(relativePath: Path) {
  const s = session();
  if (!s) throw new Error("Not authenticated");
  await s.storage.delete(relativePath);
}

// --- internal ---

function onSessionReceived(s: Session) {
  const pk = s.info.publicKey.z32();
  setSession(s);
  setCurrentUserPubky(pk);
  setShowSignIn(false);
  setAuthUrl(null);
  try {
    localStorage.setItem(STORAGE_KEY, s.export());
  } catch {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
