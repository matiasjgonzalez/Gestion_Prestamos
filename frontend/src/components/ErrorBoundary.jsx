import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <AlertTriangle size={40} style={{ color: 'var(--danger)' }} />
        <h3>Algo salió mal</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          Ocurrió un error inesperado en esta pantalla.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        >
          Recargar página
        </button>
      </div>
    );
  }
}
