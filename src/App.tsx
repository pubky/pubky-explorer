import pubkyLogo from "/pubky.svg";
import "./css/App.css";
import { Explorer } from "./Explorer.tsx";
import { Spinner } from "./Spinner.tsx";
import { ShareButton } from "./ShareButton";
import { Show, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import {
  store,
  setStore,
  updateDir,
  switchShallow,
  setSort,
  toggleDirsFirst,
  openPreview,
  closePreview,
} from "./state.ts";

function App() {
  const [input, setInput] = createSignal("");
  const [displayPrefix, setDisplayPrefix] = createSignal<
    "" | "pubky://" | "pk:"
  >("");

  // mirror address bar; only add a prefix if the user used one
  createEffect(() => {
    const path = store.dir;
    const prefix = displayPrefix();
    setInput(path ? (prefix ? prefix + path : path) : "");
  });

  function updateInput(value: string) {
    setInput(value);
  }

  function handleUrl() {
    const u = new URL(window.location.href);
    const hashP = u.hash.startsWith("#p=")
      ? decodeURIComponent(u.hash.slice(3))
      : null;
    const queryP = u.searchParams.get("p");
    const raw = (hashP || queryP || "").trim();
    if (!raw) return;

    setStore("explorer", true);

    // If it ends with '/', treat as directory. Otherwise treat as "file in dir".
    if (raw.endsWith("/")) {
      updateDir(raw, "none"); // keep exact hash
      closePreview();
      return;
    }

    // Split into dir + file; update dir without touching the URL; open preview without rewriting hash
    const cut = raw.lastIndexOf("/");
    const dir = cut >= 0 ? raw.slice(0, cut + 1) : raw; // handles bare key
    const file = cut >= 0 ? raw.slice(cut + 1) : "";

    updateDir(dir, "none");
    if (file)
      openPreview(`pubky://${store.dir}${file}`, file, { updateUrl: false });
  }

  onMount(() => {
    handleUrl();
    const onPop = () => handleUrl();
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });

  return (
    <>
      <Spinner />
      <div class="head">
        <div>
          <a href="https://pubky.app" target="_blank" rel="noopener noreferrer">
            <img src={pubkyLogo} class="logo" alt="Pubky logo" />
          </a>
        </div>
        <h1>Pubky Explorer</h1>
      </div>
      <div class="card">
        <p>
          Enter a Pubky {store.explorer ? "or relative path" : ""} to explore
          their public data.
        </p>
        <form
          class="form"
          onsubmit={(e) => {
            e.preventDefault();
            setStore("error", null);
            setStore("list", []);

            const raw = input().trim();
            const m = raw.match(/^(pubky:\/\/|pk:)/i);
            setDisplayPrefix(
              m ? (m[1].toLowerCase() as "pubky://" | "pk:") : "",
            );

            // Treat no trailing slash as "file in dir" for direct preview
            const stripped = raw
              .replace(/^pubky:\/\/?/i, "")
              .replace(/^pk:/i, "");
            const isBareKey = /^[A-Za-z0-9]{52}$/.test(stripped);
            const isFileIntent = !stripped.endsWith("/") && !isBareKey;

            if (isFileIntent) {
              const cut = stripped.lastIndexOf("/");
              const dir = cut >= 0 ? stripped.slice(0, cut + 1) : stripped;
              const file = cut >= 0 ? stripped.slice(cut + 1) : "";
              updateDir(dir, "push");
              if (file)
                openPreview(`pubky://${store.dir}${file}`, file, {
                  updateUrl: true,
                });
              setStore("explorer", true);
            } else {
              updateDir(stripped, "push");
              setStore("explorer", true);
            }
          }}
        >
          <input
            placeholder="public key (and file path)"
            value={input()}
            oninput={(e) => updateInput((e.target as HTMLInputElement).value)}
          />
          <div class="form-buttons">
            <div class="checkbox-wrapper" onClick={switchShallow}>
              <input type="checkbox" checked={store.shallow} />
              <label for="s1-14">Shallow</label>
            </div>

            <div class="sort-controls">
              <label>Sort</label>
              <select
                value={store.sortOrder}
                onChange={(e) =>
                  setSort(
                    (e.target as HTMLSelectElement).value as "asc" | "desc",
                  )
                }
              >
                <option value="asc">A–Z</option>
                <option value="desc">Z–A</option>
              </select>
              <label class="dirs-first">
                <input
                  type="checkbox"
                  checked={store.dirsFirst}
                  onChange={toggleDirsFirst}
                />
                Dirs first
              </label>
            </div>

            <ShareButton />

            <button type="submit" disabled={input().length === 0}>
              Explore
            </button>
          </div>
        </form>
      </div>
      <Show when={store.explorer}>
        <Explorer />
      </Show>
      <div class="home-container">
        <div class="home">
          <p class="read-the-docs">
            <a
              href="https://github.com/pubky/pubky-explorer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Check out the Pubky Explorer codebase.
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
