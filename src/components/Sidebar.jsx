import React from 'react';
import { LayoutDashboard, PlusCircle, History, LogOut, User, Sparkles, Sun, Moon, Building2 } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, theme, toggleTheme }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'generator', label: 'Create Ad', icon: PlusCircle },
        { id: 'history', label: 'History', icon: History },
        { id: 'workspaces', label: 'Workspaces', icon: Building2 },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-main">
                    <Sparkles className="text-gradient-red" size={24} />
                    <span className="logo-text">Ad Factory</span>
                </div>
                <span className="logo-subtitle">By Axe Revenue</span>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <button
                    onClick={toggleTheme}
                    className="nav-item"
                    style={{ width: '100%', marginBottom: '8px' }}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {user && (
                    <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--surface-hover)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User size={16} color="var(--text-muted)" />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ADMIN</p>
                            <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-color)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {user.email.split('@')[0]}
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={onLogout}
                    className="nav-item"
                    style={{ width: '100%', color: 'var(--text-muted)' }}
                >
                    <LogOut size={20} />
                    <span>Log Out</span>
                </button>

                <div className="status-badge">
                    <div className="status-dot"></div>
                    <span>System Active</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
