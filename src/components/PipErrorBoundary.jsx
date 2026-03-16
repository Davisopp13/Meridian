import { Component } from 'react';

export class PipErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[Meridian PiP] Widget error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: 680,
            height: 68,
            background: '#0f1117',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          <img
            src="/meridian-icon-512.png"
            width={20}
            height={20}
            style={{ objectFit: 'contain', flexShrink: 0 }}
            alt="Meridian"
          />
          <span
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Widget error — click to reload
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
