import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    if (!hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-sand-50 p-6">
        <div className="max-w-2xl rounded-3xl border border-sand-200 bg-white p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
            Notizen
          </p>
          <h2 className="mt-2 text-2xl font-display text-sand-900">
            Fehler im Pinboard
          </h2>
          <p className="mt-3 text-sm text-sand-600">
            Die Notizen konnten nicht geladen werden. Bitte neu versuchen oder die Seite neu laden.
          </p>
          {error ? (
            <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-sand-50 p-3 text-xs text-sand-500">
              {String(error)}
            </pre>
          ) : null}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
            >
              Neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }
}
