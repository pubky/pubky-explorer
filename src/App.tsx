import pubkyLogo from "/pubky.svg";
import "./css/App.css";
import { Explorer } from "./Explorer.tsx";
import { Spinner } from "./Spinner.tsx";
import { Show, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { store, setStore, updateDir, switchShallow } from "./state.ts";

function App() {
  const [input, setInput] = createSignal("");

  // keep the address bar in sync with the current directory at all times
  createEffect(() => {
    const path = store.dir;
    setInput(path ? `pubky://${path}` : "");
  });

  function updateInput(value: string) {
    setInput(value);
  }

  onMount(() => {
    // hydrate from URL (#p= or ?p=)
    const url = new URL(window.location.href);
    const hashP = url.hash.startsWith("#p=")
      ? decodeURIComponent(url.hash.slice(3))
      : null;
    const queryP = url.searchParams.get("p");
    const path = hashP || queryP;
    if (path && path.trim().length > 0) {
      setStore("explorer", true);
      updateDir(path);
    }
    const onPop = () => {
      const u = new URL(window.location.href);
      const hp = u.hash.startsWith("#p=")
        ? decodeURIComponent(u.hash.slice(3))
        : null;
      const qp = u.searchParams.get("p");
      const p = hp || qp || "";
      if (p) {
        setStore("explorer", true);
        updateDir(p);
      }
    };
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
            // do not clear input; the effect above will sync it to the new path after navigation
            updateDir(input());
            setStore("explorer", true);
          }}
        >
          <input
            placeholder="pubky://o4dksf...89uj56uyy or pk:o4dksf... or bare key"
            value={input()}
            oninput={(e) => updateInput((e.target as HTMLInputElement).value)}
          />
          <div class="form-buttons">
            <div class="checkbox-wrapper" onClick={switchShallow}>
              <input type="checkbox" checked={store.shallow} />
              <label for="s1-14">Shallow</label>
            </div>
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
