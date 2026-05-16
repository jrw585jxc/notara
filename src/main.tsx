import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StickyNoteView } from './components/StickyNoteView.tsx'

const stickyId = new URLSearchParams(window.location.search).get('sticky')

const root = createRoot(document.getElementById('root')!)

if (stickyId) {
  root.render(<StickyNoteView noteId={stickyId} />)
} else {
  root.render(<App />)
}
