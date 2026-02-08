import "./css/Explorer.css";
import "./css/Auth.css";
import { For, Show, onCleanup, onMount, createSignal, createEffect } from "solid-js";
import {
  store,
  updateDir,
  openPreview,
  loadMore,
  loadList,
  prefetchDir,
  cacheSaveScroll,
  isPubkeySegment,
} from "./state.ts";
import { isOwnData, toStoragePath, putFileContent, putFileBytes } from "./auth";
import type { Path } from "@synonymdev/pubky";
import Preview from "./Preview";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function Explorer() {
  let loadMoreRef: Element | undefined = undefined;
  const [selected, setSelected] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [uploadMsg, setUploadMsg] = createSignal<string | null>(null);
  let dragCounter = 0;

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    if (!isOwnData(store.dir)) return;
    dragCounter++;
    setDragging(true);
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (isOwnData(store.dir)) e.dataTransfer!.dropEffect = "copy";
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      setDragging(false);
    }
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter = 0;
    setDragging(false);
    if (!isOwnData(store.dir) || !e.dataTransfer?.files.length) return;

    setUploading(true);
    setUploadMsg(null);
    const files = Array.from(e.dataTransfer.files);
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        skipped++;
        continue;
      }
      try {
        const fullPath = store.dir + file.name;
        const storagePath = toStoragePath(fullPath) as Path;
        const buf = await file.arrayBuffer();
        await putFileBytes(storagePath, new Uint8Array(buf));
        ok++;
      } catch {
        fail++;
      }
    }
    setUploading(false);
    const parts = [`Uploaded ${ok} file${ok !== 1 ? "s" : ""}`];
    if (fail) parts.push(`${fail} failed`);
    if (skipped) parts.push(`${skipped} too large (>5MB)`);
    const msg = parts.join(", ");
    setUploadMsg(msg);
    setTimeout(() => setUploadMsg(null), 3000);
    loadList();
  }

  function focusItem(i: number) {
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>("li.file > button"),
    );
    if (items.length === 0) return;
    const idx = Math.max(0, Math.min(i, items.length - 1));
    items[idx].focus();
    setSelected(idx);

    // prefetch on keyboard highlight if directory
    const entry = store.list[idx];
    if (entry?.isDirectory) {
      prefetchDir(store.dir + entry.name);
    }
  }

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: "10px", threshold: 0.5 },
    );

    if (loadMoreRef) observer.observe(loadMoreRef);
    onCleanup(() => observer.disconnect());

    const onKey = (e: KeyboardEvent) => {
      if (!store.explorer) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as any).isContentEditable)
      )
        return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusItem(selected() + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusItem(selected() - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const items = Array.from(
          document.querySelectorAll<HTMLButtonElement>("li.file > button"),
        );
        if (items[selected()]) items[selected()].click();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const dir = store.dir.replace(/\/+$/, "").split("/");
        if (dir.length > 1) {
          const parent = dir.slice(0, -1).join("/") + "/";
          cacheSaveScroll();
          updateDir(parent);
          setSelected(0);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        history.back();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        history.forward();
      } else if (e.key === "/") {
        e.preventDefault();
        const input =
          document.querySelector<HTMLInputElement>("form.form input");
        if (input) input.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    const len = store.list.length;
    if (len === 0) return;
    if (selected() >= len) setSelected(len - 1);
    if (document.activeElement?.tagName !== "INPUT") {
      focusItem(selected());
    }
  });

  return (
    <div
      class="explorer"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Show when={dragging() && isOwnData(store.dir)}>
        <div class="drop-overlay">Drop files to upload</div>
      </Show>
      <Show when={uploadMsg()}>
        <div class="upload-msg">{uploadMsg()}</div>
      </Show>
      <Show when={uploading()}>
        <div class="upload-msg">Uploading...</div>
      </Show>
      <div class="explorer">
        <DirectoryButtons />
        <Show when={isOwnData(store.dir)}>
          <NewFileBar />
        </Show>
        <ShowErrorOrEmpty />
        <ul>
          <For each={store.list}>
            {({ link, name, isDirectory }) => (
              <li class="file">
                <button
                  onMouseEnter={() => {
                    if (isDirectory) prefetchDir(store.dir + name);
                  }}
                  onFocus={() => {
                    if (isDirectory) prefetchDir(store.dir + name);
                  }}
                  onClick={() =>
                    isDirectory
                      ? (cacheSaveScroll(), updateDir(store.dir + name))
                      : openPreview(link, name)
                  }
                >
                  <span class="icon">{isDirectory ? "📁" : "📄"}</span>
                  <For each={name.split("/")}>
                    {(x, i) => (
                      <span style={i() % 2 == 0 ? { opacity: 0.7 } : {}}>
                        {i() === 0 ? "" : "/"}
                        {x}
                      </span>
                    )}
                  </For>
                </button>
              </li>
            )}
          </For>
        </ul>
        <div ref={loadMoreRef as any}></div>
      </div>
      <Preview />
    </div>
  );
}

function DirectoryButtons() {
  function buttons() {
    const root = store.dir.split("/");
    let previous = "";
    let buttons: Array<{ text: string; path: string }> = [];
    for (let part of root) {
      if (part.length == 0) continue;
      previous += part + "/";
      const text =
        buttons.length === 0 && isPubkeySegment(part) ? `pubky${part}` : part;
      buttons.push({ text, path: previous });
    }
    return buttons;
  }

  return (
    <div class="path">
      <For each={buttons()}>
        {({ text, path }, i) => (
          <button
            disabled={i() === buttons().length - 1 || buttons().length == 2}
            onclick={() => {
              cacheSaveScroll();
              updateDir(path);
            }}
          >
            {text + "/"}
          </button>
        )}
      </For>
    </div>
  );
}

function ShowErrorOrEmpty() {
  const hasEmpty = () =>
    !store.loading && !store.error && store.list.length === 0;
  return (
    <>
      {store.error && <div class="status error">Error: {store.error}</div>}
      {hasEmpty() && <div class="status empty">No results.</div>}
    </>
  );
}

function NewFileBar() {
  const [showForm, setShowForm] = createSignal(false);
  const [fileName, setFileName] = createSignal("");
  const [fileContent, setFileContent] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function createFile() {
    const name = fileName().trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      const fullPath = store.dir + name;
      const storagePath = toStoragePath(fullPath);
      await putFileContent(storagePath, fileContent());
      setShowForm(false);
      setFileName("");
      setFileContent("");
      loadList();
    } catch (e: any) {
      setError(e?.message || "Failed to create file");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div class="own-data-bar">
        <button onClick={() => setShowForm(!showForm())}>
          {showForm() ? "Cancel" : "New File"}
        </button>
      </div>
      <Show when={showForm()}>
        <div class="new-file-form">
          <input
            placeholder="filename (e.g. data.json)"
            value={fileName()}
            onInput={(e) =>
              setFileName((e.target as HTMLInputElement).value)
            }
          />
          <textarea
            placeholder="file content"
            value={fileContent()}
            onInput={(e) =>
              setFileContent((e.target as HTMLTextAreaElement).value)
            }
          />
          <Show when={error()}>
            <div class="status error">{error()}</div>
          </Show>
          <div class="new-file-actions">
            <button onClick={createFile} disabled={creating() || !fileName().trim()}>
              {creating() ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
