import { PubkyClient } from '@synonymdev/pubky'
import { createStore } from 'solid-js/store';

export const client = PubkyClient.testnet();

export const [store, setStore] = createStore<{
  explorer: Boolean,
  dir: string,
  loading: boolean,
  shallow: boolean,
  list: Array<{ link: string, name: string, isDirectory: boolean }>
}>({
  explorer: false,
  dir: "",
  loading: false,
  shallow: true,
  list: []
})

export function resetStore() {
  setStore('dir', '')
  setStore('loading', false)
  setStore('list', [])
  setStore('explorer', false)
}

export function loadList() {
  setStore('list', [])
  loadMore()
}

export function switchShallow() {
  setStore('shallow', !store.shallow)
  if (store.dir.length > 0) {
    loadList()
  }
}

export function loadMore() {
  // @ts-ignore
  const cursor = (store.list.length > 0 && store.list[store.list.length - 1])['link']

  let path = store.dir

  setStore('loading', true)

  // ITEMS IN VIEW
  let limit = Math.ceil(window.innerHeight / 40);

  client.list(`pubky://${path}`, cursor || "", false, limit, store.shallow).then((l: Array<string>) => {
    const list = l.map(link => {
      let name = link.replace('pubky://', '').replace(store.dir, '');
      let isDirectory = name.endsWith('/');

      return {
        link,
        isDirectory,
        name
      }
    })

    setStore('loading', false)

    let map = new Map();

    for (let item of store.list) {
      map.set(item.name, item)
    }
    for (let item of list) {
      map.set(item.name, item)
    }

    // @ts-ignore
    setStore('list', Array.from(map.values()))
    setStore('dir', path)
  });
}

export function updateDir(path: string) {
  path = path?.split('://')[1] || path

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

