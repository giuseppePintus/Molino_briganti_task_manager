import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/OperatorsCarousel.css';

interface Operator {
    id: string;
    name: string;
    image?: string;
}

const OperatorsCarousel: React.FC = () => {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const history = useHistory();

    useEffect(() => {
        const fetchOperators = async () => {
            try {
                const response = await fetch('/api/operators');
                if (!response.ok) {
                    throw new Error('Failed to fetch operators');
                }
                const data = await response.json();
                setOperators(data);
            } catch (err) {
                setError(err.message);
                // Fallback: mock operators for testing
                setOperators([
                    { id: '1', name: 'Operatore 1', image: '👤' },
                    { id: '2', name: 'Operatore 2', image: '👤' },
                    { id: '3', name: 'Operatore 3', image: '👤' },
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchOperators();
    }, []);

    const handleOperatorClick = (operatorId: string, operatorName: string) => {
        localStorage.setItem('operatorId', operatorId);
        localStorage.setItem('operatorName', operatorName);
        history.push('/dashboard');
    };

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + operators.length) % operators.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % operators.length);
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
                <button className="carousel-button prev" onClick={handlePrevious}>
                    ❮
                </button>

                <div className="carousel-slide">
                    {operators.map((operator, index) => (
                        <div
                            key={operator.id}
                            className={`carousel-item ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => handleOperatorClick(operator.id, operator.name)}
                        >
                            <div className="operator-image">
                                {operator.image || '👤'}
                            </div>
                            <div className="operator-name">{operator.name}</div>
                        </div>
                    ))}
                </div>

                <button className="carousel-button next" onClick={handleNext}>
                    ❯
                </button>
            </div>

            <div className="carousel-indicators">
                {operators.map((_, index) => (
                    <div
                        key={index}
                        className={`indicator ${index === currentIndex ? 'active' : ''}`}
                        onClick={() => setCurrentIndex(index)}
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
