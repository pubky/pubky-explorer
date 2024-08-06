import pubkyLogo from '/pubky.ico'
import './css/App.css'
import { Explorer } from './Explorer.tsx'
import { Spinner } from './Spinner.tsx'
import { Switch, Match, Show, } from "solid-js"
import { store, setStore, updateDir, } from "./state.ts"


function App() {

  return (
    <>
      <div class="head">
        <Show when={store.loading}>
          <Spinner></Spinner>
        </Show>
      </div>
      <Switch>
        <Match when={store.view === "home"}>
          <div class="home-container">
            <div class="home">
              <div>
                <a href="https://github.com/pubky/pubky" target="_blank">
                  <img src={pubkyLogo} class="logo" alt="Pubky logo" />
                </a>
              </div>
              <h1>Pubky Explorer</h1>
              <div class="card">
                <input style={"margin-right:.5rem"} placeholder="pubky://o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy" value={store.dir} oninput={(e) => updateDir(e.target.value)} ></input>
                <button onClick={() => {
                  try {
                    let pubky = store.dir;

                    if (!pubky.startsWith("pubky://")) {
                      if (pubky.length < 52) {
                        throw new Error("Pubky should be 52 characters at least")
                      }

                      pubky = "pubky://" + store.dir
                    }

                    new URL(pubky)

                    setStore('loading', true)
                    setStore('view', "explorer")
                  }
                  //@ts-ignore
                  catch (error: Error) {
                    if (error.message.length > 0) {
                      alert("Invalid Pubky: " + error.message)
                    }
                    else {

                      alert("Invalid Pubky")
                    }
                  }

                }}>
                  Explore
                </button>
                <p>
                  Enter a Pubky to explore their public data.
                </p>
              </div >
              <p class="read-the-docs">
                Click on the Pubky logo to visit the Github repository.
              </p>
            </div>
          </div>
        </Match>
        <Match when={store.view === "explorer"}>
          <Explorer></Explorer>
        </Match>
      </Switch >
    </>
  )
}

export default App
