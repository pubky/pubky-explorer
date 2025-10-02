import { Show, onCleanup } from "solid-js";
import { store, closePreview, downloadFile } from "./state";
import { ShareButton } from "./ShareButton";
import "./css/Preview.css";

/* --- tiny JSON pretty-printer + highlighter (no deps) --- */

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function syntaxHighlightJSON(pretty: string) {
  const re =
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
  let out = "";
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pretty)) !== null) {
    out += escapeHtml(pretty.slice(i, m.index));
    const full = m[0];
    const isKey = !!m[2];
    let cls = "number";
    if (full[0] === '"') cls = isKey ? "key" : "string";
    else if (full === "true" || full === "false") cls = "boolean";
    else if (full === "null") cls = "null";

    if (isKey) {
      const cut = full.lastIndexOf(":");
      const key = full.slice(0, cut);
      const colon = full.slice(cut);
      out += `<span class="${cls}">${escapeHtml(key)}</span>${escapeHtml(
        colon
      )}`;
    } else {
      out += `<span class="${cls}">${escapeHtml(full)}</span>`;
    }
    i = re.lastIndex;
  }
  out += escapeHtml(pretty.slice(i));
  return out;
}

function prettyJsonHTML(raw: string | null | undefined) {
  if (!raw) return null;
  const t = raw.trim();
  try {
    if (t.startsWith("{") || t.startsWith("[")) {
      const pretty = JSON.stringify(JSON.parse(t), null, 2);
      return syntaxHighlightJSON(pretty);
    }
  } catch {
    /* fallthrough to plain text */
  }
  return null;
}

/* --- component --- */

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
                {(() => {
                  const html = store.preview.mime.includes("json")
                    ? syntaxHighlightJSON(
                        JSON.stringify(
                          JSON.parse(store.preview.text || "{}"),
                          null,
                          2
                        )
                      )
                    : prettyJsonHTML(store.preview.text);
                  return html ? (
                    <pre class="pv-text pv-json" innerHTML={html} />
                  ) : (
                    <pre class="pv-text">{store.preview.text}</pre>
                  );
                })()}
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
