import { Component, type ReactNode } from 'react'

/** A stale tab or failed chunk download should leave navigation usable. */
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="route-status" role="alert">
          <p>This page could not be loaded.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      )
    }
    return this.props.children
  }
}
