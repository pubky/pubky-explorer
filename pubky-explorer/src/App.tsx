import pubkyLogo from '/pubky.ico'
import './css/App.css'
import { Explorer } from './Explorer.tsx'
import { Spinner } from './Spinner.tsx'
import { Show, createSignal, } from "solid-js"
import { store, setStore, updateDir, resetStore, switchShallow, } from "./state.ts"


function App() {
  let [input, setInput] = createSignal('')

  function updateInput(value: string) {
    if (store.dir.length == 0) {
      try {
        let pubky = value;

        if (!pubky.startsWith("pubky://")) {
          if (pubky.length < 52) {
            throw new Error("Pubky should be 52 characters at least")
          }

          pubky = "pubky://" + store.dir
        }

        new URL(pubky)

        setInput(value)
      } catch (_) { }
    } else {
      setInput(value)
    }
  }

  return (
    <>
      <Spinner></Spinner>
      <div class="head">
        <div>
          <a href="https://github.com/pubky/pubky" target="_blank">
            <img src={pubkyLogo} class="logo" alt="Pubky logo" />
          </a>
        </div>
        <h1>Pubky Explorer</h1>
      </div>
      <div class="card">
        <p>
          Enter a Pubky {store.explorer ? "or relative path" : ""} to explore their public data.
        </p>
        <form class="form" onsubmit={(e) => {
          e.preventDefault()

          updateDir(store.dir + input())

          setStore('explorer', true)
          setInput("")
        }}>
          <input placeholder="pubky://o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy" value={input()} oninput={(e) => updateInput(e.target.value)} ></input>
          <div class="form-buttons">
            <div class="checkbox-wrapper" onClick={switchShallow}>
              <input type="checkbox" checked={store.shallow}>
              </input>
              <label for="s1-14">Shallow</label>
            </div>
            <button type="submit" disabled={input().length === 0}>
              Explore
            </button>
          </div>
        </form>
      </div >
      <Show when={store.explorer}>
        <Explorer></Explorer>
      </Show >
      <div class="home-container">
        <div class="home">
          <p class="read-the-docs">
            Click on the Pubky logo to visit the Github repository.
          </p>
        </div>
      </div>
    </>
  )
}

export default App
