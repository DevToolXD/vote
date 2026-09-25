import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import type { Tab } from './data'
import './styles.css'

// Preview options mirror the design tool's controls: ?tab=rank&palette=swap
const params = new URLSearchParams(location.search)
const tab = params.get('tab')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      startTab={tab === 'acct' || tab === 'rank' ? (tab as Tab) : 'home'}
      swapPalette={params.get('palette') === 'swap'}
    />
  </StrictMode>,
)
