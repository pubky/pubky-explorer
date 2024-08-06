import './css/Explorer.css'
import { For } from 'solid-js'
import { store, updateDir, downloadFile } from './state.ts'

export function Explorer() {

  return (<div class="explorer">
    <div class="explorer">
      <DirectoryButtons ></DirectoryButtons>

      <For each={store.list}>
        {({ link, name }, _) => (
          <ul>
            <li class="file">
              <button onClick={() => downloadFile(link)} >
                {name}
              </button>
            </li>
          </ul>
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
    <div class="path">
      <For each={buttons()}>
        {({ text, path }, i) => (
          <button disabled={i() === (buttons().length - 1) || buttons().length == 2} onclick={() => {
            updateDir(path)
          }}>{text + "/"}</button>
        )}
      </For>
    </div>
  )
}
