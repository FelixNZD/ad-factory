import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Generator from './components/Generator';
import History from './components/History';
import Login from './components/Login';
import { supabase, getGenerations, saveGeneration, deleteGeneration } from './services/supabase';

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
        // Load local history first for immediate UI
        const saved = localStorage.getItem('ad_history');
        if (saved) {
            setHistory(JSON.parse(saved));
        }

        // Then fetch from Supabase if configured
        const syncHistory = async () => {
            if (supabase) {
                const cloudHistory = await getGenerations();
                if (cloudHistory.length > 0) {
                    setHistory(cloudHistory);
                    localStorage.setItem('ad_history', JSON.stringify(cloudHistory));
                }
            }
        };

        syncHistory();

        // Optional: Real-time subscription for "view each others generations" live
        let subscription;
        if (supabase) {
            subscription = supabase
                .channel('generations_changes')
                .on('postgres_changes', { event: '*', table: 'generations' }, () => {
                    syncHistory();
                })
                .subscribe();
        }

        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);

    // Save local backup whenever history changes
    useEffect(() => {
        try {
            localStorage.setItem('ad_history', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save history to localStorage:', e);
            if (e.name === 'QuotaExceededError') {
                // If storage is full, try to save only the last 10 items to remain functional
                try {
                    localStorage.setItem('ad_history', JSON.stringify(history.slice(0, 10)));
                } catch (innerE) {
                    console.error('Even sliced history failed to save:', innerE);
                }
            }
        }
    }, [history]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ad_factory_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const handleComplete = async (newVideo) => {
        setHistory(prev => [newVideo, ...prev]);
        if (supabase && user) {
            await saveGeneration(newVideo, user.email);
        }
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

    const handleDelete = async (timestamp) => {
        if (window.confirm('Are you sure you want to delete this record from your history?')) {
            setHistory(prev => prev.filter(item => item.timestamp !== timestamp));
            if (supabase) {
                await deleteGeneration(timestamp);
            }
        }
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
                        <History history={history} onRegenerate={handleRegenerate} onDelete={handleDelete} />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
