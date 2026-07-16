export default function LoginPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 48, boxShadow: '0 2px 16px rgba(0,0,0,.08)', textAlign: 'center', minWidth: 320 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>OpenAPI</h1>
        <p style={{ color: '#666', marginBottom: 32 }}>API Management Platform</p>
        <a
          href="/api/auth/google"
          style={{ display: 'inline-block', background: '#FF6B00', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
