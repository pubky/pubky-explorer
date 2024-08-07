import { PubkyClient } from '@synonymdev/pubky'
import { createStore } from 'solid-js/store';

export const client = PubkyClient.testnet();

export const [store, setStore] = createStore<{ explorer: Boolean, dir: string, loading: boolean, list: Array<{ link: string, name: string, isFolder: bool }> }>({
  explorer: false,
  dir: "",
  loading: false,
  list: []
})

export function resetStore() {
  setStore('dir', '')
  setStore('loading', false)
  setStore('list', [])
  setStore('explorer', false)
}

export function loadList(cursor?: string) {
  let path = store.dir

  setStore('list', [])
  loadMore()
}

export function loadMore() {

  // @ts-ignore
  const cursor = (store.list.length > 0 && store.list[store.list.length - 1])['link']

  let path = store.dir

  setStore('loading', true)

  // ITEMS IN VIEW
  let limit = Math.ceil(window.innerHeight / 40);

  console.log({ limit })

  client.list(`pubky://${path}`, cursor || "", false, limit).then((l: Array<string>) => {
    const list = l.map(link => {
      let name = link.replace('pubky://', '').replace(store.dir, '');
      let isFolder = name.endsWith('/');

      return {
        link,
        isFolder,
        name
      }
    })

    setStore('loading', false)

    // @ts-ignore
    setStore('list', [...[...store.list], ...list])
    setStore('dir', path)
  });
}

export function updateDir(path: string) {
  path = path.replace('pubky://', '')

  let parts = path.split("/").filter(Boolean);

  // if (parts.length > 1 && !path.endsWith("/")) {
  //   parts = parts.slice(0, parts.length - 1)
  // }

  path = parts.join('/')

  // Homeserver doesn't support reading root.
  if (path.length == 52) {
    path = path + "/pub/"
  }

  if (!path.endsWith('/')) {
    path = path + '/'
  }

  setStore("dir", path)
  loadList()
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

      element.remove()
    }
  })
}

