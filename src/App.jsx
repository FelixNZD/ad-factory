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

    const [prefillData, setPrefillData] = useState(null);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('ad_factory_theme') || 'dark';
    });

    useEffect(() => {
        localStorage.setItem('ad_history', JSON.stringify(history));
    }, [history]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ad_factory_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const handleComplete = (newVideo) => {
        setHistory(prev => [newVideo, ...prev]);
    };

    const handleRegenerate = (video) => {
        setPrefillData({
            snippets: [video.script],
            gender: video.gender,
            aspectRatio: video.aspectRatio,
            imagePreview: video.imageUrl
        });
        setActiveTab('generator');
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
        return <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;
    }

    return (
        <div className="layout-root">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                user={user}
                onLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            <main className="main-content">
                <div className="container">
                    {activeTab === 'dashboard' && (
                        <Dashboard history={history} onNavigate={setActiveTab} />
                    )}
                    {activeTab === 'generator' && (
                        <Generator
                            onComplete={handleComplete}
                            setActiveTab={setActiveTab}
                            prefill={prefillData}
                            onClearPrefill={() => setPrefillData(null)}
                        />
                    )}
                    {activeTab === 'history' && (
                        <History history={history} onRegenerate={handleRegenerate} />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
