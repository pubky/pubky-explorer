import { PubkyClient } from '@synonymdev/pubky'
import { createStore } from 'solid-js/store';

export const client = PubkyClient.testnet();

export const [store, setStore] = createStore<{ view: string, dir: string, loading: Boolean, list: Array<string> }>({
  view: "home",
  dir: "",
  loading: false,
  list: []
})

export function resetStore() {
  setStore('dir', '')
  setStore('loading', false)
  setStore('list', [])
  setStore('view', 'home')
}

export function loadList() {
  let path = store.dir

  setStore('loading', true)

  client.list(`pubky://${path}`).then((list: Array<string>) => {
    setStore('loading', false)

    // @ts-ignore
    setStore('list', list)
    setStore('dir', path)
  });
}

export function updateDir(path: string) {
  path = path.toLowerCase()


  path = path.replace('pubky://', '')

  let parts = path.split("/").filter(Boolean);

  if (parts.length > 1 && !path.endsWith("/")) {
    parts = parts.slice(0, parts.length - 1)
  }

  path = parts.join('/')

  // Homeserver doesn't support reading root.
  if (path.length == 52) {
    path = path + "/pub/"
  }

  if (!path.endsWith('/')) {
    path = path + '/'
  }

  setStore("dir", path)
}

export function downloadFile(link: string) {
  setStore("loading", true);

  client.get(link).then(bytes => {
    if (bytes) {
      setStore("loading", false);

      const element = document.createElement('a');

      const fileBlob = new Blob([bytes]);

      element.href = URL.createObjectURL(fileBlob);
      let parts = link.split('/')
      element.download = parts[parts.length - 1];
      document.body.appendChild(element); // Required for this to work in FireFox
      element.click();
    }
  })
}
