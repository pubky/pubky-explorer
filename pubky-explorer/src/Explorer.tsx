import './css/Explorer.css'
import { For } from 'solid-js'
import { store, updateDir, resetStore, loadList } from './state.ts'

export function Explorer() {

  loadList()

  return (<div class="explorer">
    <div class="explorer">
      <div>
        <button onClick={resetStore}>Home</button>
      </div>
      <br />
      <br />
      <DirectoryButtons ></DirectoryButtons>
      <br />
      <br />

      <For each={store.list}>
        {(link, _) => (
          < div>
            <button value={link} >
              {link.replace("pubky://", "").replace(store.dir, "")}
            </button>
          </div>
        )}
      </For>
    </div >
  </div >
  )
}

function DirectoryButtons() {
  let buttons = () => {
    let parts = store.dir.split("/").filter(Boolean);

    let buttons = parts.map((text, i) => {
      let btn = { text: "", path: "" };

      btn.text = i == 0
        ? text.slice(0, 5) + ".." + text.slice(47, 52)
        : text

      btn.path = parts.slice(0, i + 1).join("/") + "/"


      return btn
    })

    return buttons
  }




  return (
    <For each={buttons()}>
      {({ text, path }, _) => (
        <button onclick={() => {
          updateDir(path)
          loadList()
        }}>{text}</button>
      )}
    </For>
  )
}
