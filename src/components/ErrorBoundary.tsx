import { Component, type ReactNode } from 'react';
import { downloadText } from '../export/download';
import { STORAGE_KEY } from '../state/store';

interface State {
  error: Error | null;
}

/**
 * Last-resort recovery UI. compute() runs during render of the app header,
 * so corrupted persisted data would otherwise white-screen the app on every
 * load with no way out short of devtools.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private downloadData = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    downloadText(raw ?? '{}', 'application/json', 'agile-pricer-recovered-data.json');
  };

  private resetData = () => {
    if (
      window.confirm(
        'Delete the locally stored portfolio and restart with seed data? Download the stored data first if you want to keep it.',
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 640, margin: '80px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p>
          The app hit an unexpected error while rendering. Your pursuits are stored locally and are usually intact —
          reload to try again, or download the stored data and reset if the error repeats.
        </p>
        <pre
          style={{
            background: '#f6f6f8',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => location.reload()}>
            Reload
          </button>
          <button type="button" onClick={this.downloadData}>
            Download stored data
          </button>
          <button type="button" onClick={this.resetData}>
            Reset local data…
          </button>
        </div>
      </div>
    );
  }
}
