import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../../styles/AdminLogin.css';

const AdminLogin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const history = useHistory();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                throw new Error('Login fallito - Credenziali non valide');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('isAdmin', 'true');
            history.push('/admin/dashboard');
        } catch (err) {
            setError(err.message || 'Errore durante il login');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        history.push('/');
    };

    return (
        <div className="admin-login-container">
            <div className="admin-login-box">
                <div className="admin-header">
                    <h1>Accesso Admin</h1>
                    <p>Gestione Attività e Operatori</p>
                </div>

                <form onSubmit={handleLogin} className="admin-login-form">
                    <div className="form-group">
                        <label htmlFor="username">Nome Utente</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Inserisci il nome utente"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Inserisci la password"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button 
                        type="submit" 
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? 'Accesso in corso...' : 'Accedi'}
                    </button>
                </form>

                <div className="admin-footer">
                    <button onClick={handleBack} className="back-button">
                        ← Torna alla selezione operatori
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
