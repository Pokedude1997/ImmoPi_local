import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authExpiry', data.expiresAt);
        
        // Redirect to dashboard
        navigate('/');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Failed to connect to server. Please check if the server is running.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '1.5rem',
          color: '#333',
        }}>
          🏠 ImmoPi Manager
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label 
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#555',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c33',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading || !password ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading && password) {
                (e.target as HTMLButtonElement).style.backgroundColor = '#45a049';
              }
            }}
            onMouseOut={(e) => {
              if (!loading && password) {
                (e.target as HTMLButtonElement).style.backgroundColor = '#4CAF50';
              }
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#888',
        }}>
          🔒 Local authentication for your privacy
        </p>
      </div>
    </div>
  );
};
