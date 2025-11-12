import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/OperatorsCarousel.css';

interface Operator {
    id: string | number;
    username: string;
    image?: string;
}

const OperatorsCarousel: React.FC = () => {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loginAttempting, setLoginAttempting] = useState(false);
    const history = useHistory();

    useEffect(() => {
        const fetchOperators = async () => {
            try {
                const response = await fetch('/api/auth/operators/public');
                if (!response.ok) {
                    throw new Error('Failed to fetch operators');
                }
                const data = await response.json();
                if (data.length > 0) {
                    setOperators(data);
                } else {
                    throw new Error('No operators available');
                }
            } catch (err) {
                console.error('Error fetching operators:', err);
                setError(err instanceof Error ? err.message : 'Error loading operators');
                // Fallback: mock operators for testing
                setOperators([
                    { id: '1', username: 'Operatore 1', image: '👤' },
                    { id: '2', username: 'Operatore 2', image: '👤' },
                    { id: '3', username: 'Operatore 3', image: '👤' },
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchOperators();
    }, []);

    const handleOperatorClick = async (operator: Operator) => {
        setLoginAttempting(true);
        try {
            const response = await fetch('/api/auth/quick-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ operatorId: operator.id }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('operatorId', String(data.user.id));
            localStorage.setItem('operatorName', data.user.username);
            
            history.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setLoginAttempting(false);
        }
    };

    const handlePrevious = () => {
        setCurrentIndex((prev: number) => (prev - 1 + operators.length) % operators.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev: number) => (prev + 1) % operators.length);
    };

    if (loading) {
        return <div className="carousel-container"><p>Caricamento operatori...</p></div>;
    }

    if (error && operators.length === 0) {
        return <div className="carousel-container"><p style={{ color: 'red' }}>Errore: {error}</p></div>;
    }

    if (operators.length === 0) {
        return <div className="carousel-container"><p>Nessun operatore disponibile</p></div>;
    }

    return (
        <div className="carousel-container">
            <h1>Seleziona un Operatore</h1>
            
            <div className="carousel-wrapper">
                <button 
                    className="carousel-button prev" 
                    onClick={handlePrevious}
                    disabled={loginAttempting}
                >
                    ❮
                </button>

                <div className="carousel-slide">
                    {operators.map((operator: Operator, index: number) => (
                        <div
                            key={operator.id}
                            className={`carousel-item ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => !loginAttempting && handleOperatorClick(operator)}
                        >
                            <div className="operator-image">
                                {operator.image ? (
                                    operator.image.startsWith('data:') || operator.image.startsWith('http') ? (
                                        <img src={operator.image} alt={operator.username} />
                                    ) : (
                                        operator.image
                                    )
                                ) : (
                                    '👤'
                                )}
                            </div>
                            <div className="operator-name">{operator.username}</div>
                            {loginAttempting && index === currentIndex && (
                                <div className="login-spinner">Accesso in corso...</div>
                            )}
                        </div>
                    ))}
                </div>

                <button 
                    className="carousel-button next" 
                    onClick={handleNext}
                    disabled={loginAttempting}
                >
                    ❯
                </button>
            </div>

            <div className="carousel-indicators">
                {operators.map((_: Operator, index: number) => (
                    <div
                        key={index}
                        className={`indicator ${index === currentIndex ? 'active' : ''}`}
                        onClick={() => !loginAttempting && setCurrentIndex(index)}
                    />
                ))}
            </div>

            <div className="carousel-footer">
                <p>Clicca sulla foto di un operatore per accedere</p>
                <a href="/admin" className="admin-link">Accesso Admin</a>
            </div>
        </div>
    );
};

export default OperatorsCarousel;
