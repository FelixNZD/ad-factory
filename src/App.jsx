import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Generator from './components/Generator';
import History from './components/History';
import Login from './components/Login';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('ad_history');
        return saved ? JSON.parse(saved) : [];
    });

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('ad_factory_auth') === 'true';
    });
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('ad_factory_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    useEffect(() => {
        localStorage.setItem('ad_history', JSON.stringify(history));
    }, [history]);

    const handleComplete = (newVideo) => {
        setHistory(prev => [newVideo, ...prev]);
    };

    const handleLogin = (userData) => {
        setIsAuthenticated(true);
        setUser(userData);
        localStorage.setItem('ad_factory_auth', 'true');
        localStorage.setItem('ad_factory_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('ad_factory_auth');
        localStorage.removeItem('ad_factory_user');
    };

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="layout-root">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                user={user}
                onLogout={handleLogout}
            />
            <main className="main-content">
                <div className="container">
                    {activeTab === 'dashboard' && (
                        <Dashboard history={history} onNavigate={setActiveTab} />
                    )}
                    {activeTab === 'generator' && (
                        <Generator onComplete={handleComplete} setActiveTab={setActiveTab} />
                    )}
                    {activeTab === 'history' && (
                        <History history={history} />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
