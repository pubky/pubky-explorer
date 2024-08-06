import { Show } from 'solid-js'
import './css/Spinner.css'
import { store } from './state'

export function Spinner() {
  return (
    <>
      <Show when={store.loading}>
        <div class="spinner"></div>
      </Show >
    </>)
}
