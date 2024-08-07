import './css/Explorer.css'
import { For, onCleanup, onMount } from 'solid-js'
import { store, updateDir, downloadFile, loadMore } from './state.ts'


export function Explorer() {
  let loadMoreRef: Element | undefined = undefined;


  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, {
      root: null, // use the viewport
      rootMargin: "10px",
      threshold: 1.0
    });

    if (loadMoreRef) {
      observer.observe(loadMoreRef);
    }

    onCleanup(() => {
      if (loadMoreRef) {
        observer.unobserve(loadMoreRef);
      }
    });
  });

  return (<div class="explorer">
    <div class="explorer">
      <DirectoryButtons ></DirectoryButtons>

      <ul>
        <For each={store.list}>
          {({ link, name, isFolder }, _) => (
            <li class="file">
              <button onClick={() => downloadFile(link)} >
                <span>{(isFolder ? "📁" : "📄")}</span>
                {name}
              </button>
            </li>
          )}
        </For>
      </ul>
      <div ref={loadMoreRef}></div>
    </div >
  </div >
  )
}

function DirectoryButtons() {
  let buttons = () => {
    let parts = store.dir.split("/").filter(Boolean);

    const pubky = parts.shift()

    let buttons = parts.map((text, i) => {
      let btn = { text: "", path: "" };

      btn.text = text

      btn.path = pubky + "/" + parts.slice(0, i + 1).join("/") + "/"


      return btn
    })

    return buttons
  }




  return (
    <div class="path">
      <For each={buttons()}>
        {({ text, path }, i) => (
          <button disabled={i() === (buttons().length - 1) || buttons().length == 1} onclick={() => {
            updateDir(path)
          }}>{text + "/"}</button>
        )}
      </For>
    </div>
  )
}
