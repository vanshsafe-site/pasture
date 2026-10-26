import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="setup-page"><section className="panel"><h1>Something interrupted the app</h1><p>Your saved records remain in your account. Reload the page to try again.</p><button className="button primary" onClick={() => window.location.reload()}>Reload page</button></section></main>
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>)
