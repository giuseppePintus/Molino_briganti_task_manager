import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import TaskList from '../../components/TaskList';
import '../../styles/AdminDashboard.css';

const AdminDashboard: React.FC = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const history = useHistory();

    useEffect(() => {
        // Verifica che l'utente sia autenticato come admin
        const token = localStorage.getItem('token');
        const isAdmin = localStorage.getItem('isAdmin');

        if (!token || isAdmin !== 'true') {
            history.push('/admin');
            return;
        }

        const fetchTasks = async () => {
            try {
                const response = await fetch('/api/tasks', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                
                if (!response.ok) {
                    throw new Error('Errore nel caricamento delle attività');
                }
                
                const data = await response.json();
                setTasks(data);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching tasks:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [history]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('isAdmin');
        history.push('/admin');
    };

    if (loading) {
        return <div className="admin-dashboard"><p>Caricamento...</p></div>;
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-header-section">
                <h1>Pannello Admin</h1>
                <button onClick={handleLogout} className="logout-button">
                    Esci
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="admin-content">
                <h2>Tutte le Attività</h2>
                {tasks.length > 0 ? (
                    <TaskList tasks={tasks} />
                ) : (
                    <p>Nessuna attività disponibile</p>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
