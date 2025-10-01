import { Show, onCleanup } from "solid-js";
import { store, closePreview, downloadFile } from "./state";
import { ShareButton } from "./ShareButton";
import "./css/Preview.css";

export default function Preview() {
  let escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closePreview();
  };
  window.addEventListener("keydown", escHandler);
  onCleanup(() => window.removeEventListener("keydown", escHandler));

  return (
    <Show when={store.preview.open}>
      <div class="pv-overlay" onClick={closePreview}>
        <div
          class="pv-panel"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="pv-head">
            <div class="pv-title" title={store.preview.name}>
              {store.preview.name}
            </div>
            <div class="pv-actions">
              <ShareButton
                path={(store.dir + store.preview.name).replace(/\/+$/, "")}
              />
              <button onClick={() => downloadFile(store.preview.link)}>
                Download
              </button>
              <button onClick={closePreview}>Close</button>
            </div>
          </div>

          <Show when={store.preview.error}>
            <div class="pv-error">{store.preview.error}</div>
          </Show>

          <Show when={store.preview.loading}>
            <div class="pv-loading">Loading…</div>
          </Show>

          <Show when={!store.preview.loading && !store.preview.error}>
            <div class="pv-body">
              <Show when={store.preview.kind === "image"}>
                <img
                  class="pv-image"
                  src={store.preview.url || ""}
                  alt={store.preview.name}
                />
              </Show>
              <Show when={store.preview.kind === "text"}>
                <pre class="pv-text">{store.preview.text}</pre>
              </Show>
              <Show when={store.preview.kind === "other"}>
                <div class="pv-unknown">
                  Preview not available for this file type.
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
