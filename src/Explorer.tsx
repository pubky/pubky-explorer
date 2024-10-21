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
          {({ link, name, isDirectory }, _) => (
            <li class="file">
              <button onClick={() => isDirectory ? updateDir(store.dir + name) : downloadFile(link)} >
                <span class="icon">{(isDirectory ? "📁" : "📄")}</span>
                <For each={name.split('/')}>
                  {(x, i) => <span style={(i() % 2) == 0 ? { opacity: 0.7 } : {}}>{i() === 0 ? "" : "/"}{x}</span>}
                </For>
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

    let buttons = parts.map((text, i) => {
      let btn = { text: "", path: "" };

      btn.text = i == 0
        ? text.slice(0, 4) + ".." + text.slice(48, 52)
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
