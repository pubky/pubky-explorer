import { createResource, createSignal, For } from 'solid-js'
import pubkyLogo from '/pubky.ico'
import './App.css'
import { client } from './state.ts'

const listDir = async (dir: string) =>
  await client.list(`pubky://${dir}`);

function App() {
  const [dir, setDir] = createSignal<string>("5y97ixn1i7937shbbpjcr8bpkwfar9eyukr48d55nq19pnhg637y/pub/example.com/")
  const [list] = createResource(dir, listDir);


  return (
    <>
      <div>
        <a href="https://github.com/pubky/pubky" target="_blank">
          <img src={pubkyLogo} class="logo" alt="Pubky logo" />
        </a>
      </div>
      <h1>Pubky Explorer</h1>
      <div class="card">
        <input placeholder="pubky://o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy">
        </input>
        <button onClick={() => { }}>
          Explore
        </button>
        <p>
          Enter a Pubky to explore their public data.
        </p>
        <div style={"text-align: left"}>
          <div>{dir()}</div>
          <div>
            <button onclick={() => {
              let parts = dir().split("/").filter(Boolean);
              setDir(parts.slice(0, parts.length - 1).join("/"))
            }}>..</button>
          </div>
          <For each={list()}>
            {(link, i) => (
              < div>
                <button value={link}>
                  {link.replace("pubky://", "").replace(dir(), "")}
                </button>
              </div>
            )}
          </For>
        </div >
      </div >
      <p class="read-the-docs">
        Click on the Pubky logo to visit the Github repository.
      </p>
    </>
  )
}

export default App
