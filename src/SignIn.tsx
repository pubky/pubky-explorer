import { Show, createEffect, createSignal, onMount, onCleanup } from "solid-js";
import {
  showSignIn,
  authUrl,
  authError,
  authLoading,
  startSignIn,
  cancelSignIn,
} from "./auth";
import "./css/Auth.css";

export default function SignIn() {
  const [qrSrc, setQrSrc] = createSignal<string | null>(null);

  createEffect(async () => {
    const url = authUrl();
    if (!url) {
      setQrSrc(null);
      return;
    }
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrSrc(dataUrl);
    } catch {
      setQrSrc(null);
    }
  });

  // trigger auth flow when modal opens
  createEffect(() => {
    if (showSignIn()) startSignIn();
  });

  onMount(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSignIn()) cancelSignIn();
    };
    window.addEventListener("keydown", onEsc);
    onCleanup(() => window.removeEventListener("keydown", onEsc));
  });

  return (
    <Show when={showSignIn()}>
      <div class="auth-overlay" onClick={cancelSignIn}>
        <div class="auth-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Sign In with Pubky Ring</h2>

          <Show when={authError()}>
            <div class="auth-error">{authError()}</div>
          </Show>

          <Show when={authLoading() && !authUrl()}>
            <div class="auth-status">Generating auth link...</div>
          </Show>

          <Show when={authUrl()}>
            <div class="qr-container">
              <Show
                when={qrSrc()}
                fallback={<div class="auth-status">Loading QR...</div>}
              >
                <img
                  src={qrSrc()!}
                  alt="Scan with Pubky Ring"
                  class="qr-image"
                />
              </Show>
            </div>
            <p class="auth-hint">Scan with Pubky Ring app</p>
            <a
              href={authUrl()!}
              class="auth-deeplink"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Pubky Ring
            </a>
            <Show when={authLoading()}>
              <div class="auth-status polling">Waiting for approval...</div>
            </Show>
          </Show>

          <button class="auth-cancel" onClick={cancelSignIn}>
            Cancel
          </button>
        </div>
      </div>
    </Show>
  );
}
