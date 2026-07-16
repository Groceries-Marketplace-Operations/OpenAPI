import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.location.replace('/');
    } else {
      window.location.replace('/login');
    }
  }, []);

  return <div style={{ padding: 32 }}>Authenticating…</div>;
}
