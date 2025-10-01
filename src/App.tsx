import pubkyLogo from "/pubky.svg";
import "./css/App.css";
import { Explorer } from "./Explorer.tsx";
import { Spinner } from "./Spinner.tsx";
import { Show, createSignal } from "solid-js";
import { store, setStore, updateDir, switchShallow } from "./state.ts";

function App() {
  let [input, setInput] = createSignal("");

  function updateInput(value: string) {
    // Accept pk:, pubky://, or bare key/path; minimal client-side guard for obviously invalid short keys
    if (/^([a-z0-9]{0,51})$/i.test(value.trim())) {
      // too short to be a key but might be a path; allow typing to proceed
      setInput(value);
      return;
    }
    setInput(value);
  }

  return (
    <>
      <Spinner></Spinner>
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
            updateDir(input());

            setStore("explorer", true);
            setInput("");
          }}
        >
          <input
            placeholder="pubky://o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy"
            value={input()}
            oninput={(e) => updateInput(e.target.value)}
          ></input>
          <div class="form-buttons">
            <div class="checkbox-wrapper" onClick={switchShallow}>
              <input type="checkbox" checked={store.shallow}></input>
              <label for="s1-14">Shallow</label>
            </div>
            <button type="submit" disabled={input().length === 0}>
              Explore
            </button>
          </div>
        </form>
      </div>
      <Show when={store.explorer}>
        <Explorer></Explorer>
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
