import { APP_VERSION } from './version';

export function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 12, color: '#666' }}>v{APP_VERSION}</div>
      <h1>LIFE &amp; WEALTH</h1>
    </main>
  );
}
