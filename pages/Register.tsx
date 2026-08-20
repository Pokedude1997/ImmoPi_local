import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

export const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const passwordsMatch = password === passwordConfirm && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim()) {
      setError('Please enter a username');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.register(username, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          📝 Register
        </h1>

        {success ? (
          <div style={{
            padding: '1rem',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            color: '#155724',
            textAlign: 'center',
            marginBottom: '1rem',
          }}>
            ✅ Registration successful! Redirecting to login...
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="username"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#555',
                  }}
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                  placeholder="Choose a username"
                />
              </div>

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
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${password.length > 0 && password.length < 8 ? '#fcc' : '#ddd'}`,
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter password (min 8 characters)"
                />
                {password.length > 0 && password.length < 8 && (
                  <p style={{ fontSize: '0.8rem', color: '#c33', marginTop: '0.25rem', marginBottom: 0 }}>
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="passwordConfirm"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '500',
                    color: '#555',
                  }}
                >
                  Confirm Password
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${passwordConfirm.length > 0 && !passwordsMatch ? '#fcc' : '#ddd'}`,
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Confirm your password"
                />
                {passwordConfirm.length > 0 && !passwordsMatch && (
                  <p style={{ fontSize: '0.8rem', color: '#c33', marginTop: '0.25rem', marginBottom: 0 }}>
                    Passwords do not match
                  </p>
                )}
                {passwordsMatch && password.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#28a745', marginTop: '0.25rem', marginBottom: 0 }}>
                    ✓ Passwords match
                  </p>
                )}
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
                disabled={loading || !username.trim() || !passwordsMatch || password.length < 8}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: loading || !username.trim() || !passwordsMatch || password.length < 8 ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: loading || !username.trim() || !passwordsMatch || password.length < 8 ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <p style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.9rem',
              color: '#666',
            }}>
              Already have an account? <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>Login here</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
