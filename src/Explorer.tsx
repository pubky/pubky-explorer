import "./css/Explorer.css";
import { For, onCleanup, onMount, createSignal, createEffect } from "solid-js";
import {
  store,
  updateDir,
  openPreview,
  loadMore,
  prefetchDir,
  cacheSaveScroll,
} from "./state.ts";
import Preview from "./Preview";

export function Explorer() {
  let loadMoreRef: Element | undefined = undefined;
  const [selected, setSelected] = createSignal(0);

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
    <div class="explorer">
      <div class="explorer">
        <DirectoryButtons />
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
      buttons.push({ text: part, path: previous });
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
