import { Show, onCleanup, createSignal } from "solid-js";
import { store, closePreview, downloadFile, loadList, openPreview } from "./state";
import { ShareButton } from "./ShareButton";
import {
  isOwnData,
  toStoragePath,
  putFileContent,
  deleteFileAtPath,
} from "./auth";
import "./css/Preview.css";
import "./css/Auth.css";

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
        colon,
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
  const [editing, setEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [saveMsg, setSaveMsg] = createSignal<{
    ok: boolean;
    text: string;
  } | null>(null);

  let escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (editing()) {
        setEditing(false);
        return;
      }
      closePreview();
    }
  };
  window.addEventListener("keydown", escHandler);
  onCleanup(() => window.removeEventListener("keydown", escHandler));

  const canEdit = () =>
    store.preview.open &&
    store.preview.kind === "text" &&
    isOwnData(store.dir);

  const canDelete = () => store.preview.open && isOwnData(store.dir);

  function startEdit() {
    setEditContent(store.preview.text || "");
    setSaveMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveMsg(null);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const filePath = store.dir + store.preview.name;
      const storagePath = toStoragePath(filePath);
      await putFileContent(storagePath, editContent());
      setSaveMsg({ ok: true, text: "Saved" });
      setEditing(false);
      // reload preview content
      openPreview(store.preview.link, store.preview.name, {
        updateUrl: false,
      });
    } catch (e: any) {
      setSaveMsg({ ok: false, text: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${store.preview.name}"?`)) return;
    setSaving(true);
    try {
      const filePath = store.dir + store.preview.name;
      const storagePath = toStoragePath(filePath);
      await deleteFileAtPath(storagePath);
      closePreview();
      loadList();
    } catch (e: any) {
      setSaveMsg({ ok: false, text: e?.message || "Delete failed" });
    } finally {
      setSaving(false);
    }
  }

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
              <Show when={canEdit() && !editing()}>
                <button onClick={startEdit}>Edit</button>
              </Show>
              <Show when={canDelete() && !editing()}>
                <button
                  class="delete-btn"
                  onClick={handleDelete}
                  disabled={saving()}
                >
                  Delete
                </button>
              </Show>
              <ShareButton
                path={(store.dir + store.preview.name).replace(/\/+$/, "")}
              />
              <button onClick={() => downloadFile(store.preview.link)}>
                Download
              </button>
              <button onClick={closePreview}>Close</button>
            </div>
          </div>

          <Show when={saveMsg()}>
            <div class={saveMsg()!.ok ? "pv-save-ok" : "pv-save-err"}>
              {saveMsg()!.text}
            </div>
          </Show>

          <Show when={store.preview.error}>
            <div class="pv-error">{store.preview.error}</div>
          </Show>

          <Show when={store.preview.loading}>
            <div class="pv-loading">Loading...</div>
          </Show>

          <Show when={editing()}>
            <div class="pv-body">
              <textarea
                class="pv-edit-area"
                value={editContent()}
                onInput={(e) =>
                  setEditContent((e.target as HTMLTextAreaElement).value)
                }
              />
            </div>
            <div class="pv-edit-actions">
              <button class="save-btn" onClick={saveEdit} disabled={saving()}>
                {saving() ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelEdit}>Cancel</button>
            </div>
          </Show>

          <Show when={!store.preview.loading && !store.preview.error && !editing()}>
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
                          2,
                        ),
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
