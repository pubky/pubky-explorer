/* @refresh reload */
import { render } from 'solid-js/web'

import './css/index.css'
import App from './App'

import './state.ts'

const root = document.getElementById('root')

render(() => <App />, root!)
