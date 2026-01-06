import React from 'react';
import { Play, TrendingUp, Clock, ArrowRight } from 'lucide-react';

const Dashboard = ({ history, onNavigate }) => {
    const totalGens = history.length;
    const recentVideos = history.slice(0, 3);

    return (
        <div className="container animate-fade-in">
            <header className="section-header">
                <h1 className="section-title">Welcome back.</h1>
                <p className="section-subtitle">Automate your UGC ad workflow with Veo 3.1 Pro</p>
            </header>

            <div style={{ marginBottom: '48px' }}>
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px' }}>
                    <div>
                        <span className="label-caps">Total Generations</span>
                        <div style={{ fontSize: '48px', fontWeight: '800', color: 'var(--primary-color)', lineHeight: 1 }}>{totalGens}</div>
                    </div>
                    <button onClick={() => onNavigate('generator')} className="btn-primary" style={{ padding: '16px 32px' }}>
                        New Generation <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Recent Production</h2>
                        <p className="section-subtitle">Your latest AI generated clips</p>
                    </div>
                    {history.length > 0 && (
                        <button onClick={() => onNavigate('history')} className="nav-item" style={{ width: 'auto', padding: '8px 16px' }}>
                            View all history
                        </button>
                    )}
                </div>

                {recentVideos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                        {recentVideos.map((video, i) => (
                            <div key={i} className="card card-interactive animate-slide-up" onClick={() => onNavigate('history')} style={{ padding: '0', overflow: 'hidden', animationDelay: `${i * 0.1}s` }}>
                                <div style={{ aspectRatio: '9/16', backgroundColor: 'var(--video-bg)', position: 'relative' }}>
                                    <img src={video.imageUrl} alt="Ad Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255, 0, 0, 0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Play fill="white" size={24} />
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                                        <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', fontSize: '10px', fontWeight: '800', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {video.aspectRatio || '9:16'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '20px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {video.presetName || 'AI Generation'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                        <Clock size={12} />
                                        {new Date(video.timestamp).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card card-ghost" style={{ textAlign: 'center', padding: '64px 32px' }}>
                        <div style={{ marginBottom: '20px', opacity: 0.3 }}><Play size={48} style={{ margin: '0 auto' }} /></div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>No generations yet</h3>
                        <p className="section-subtitle" style={{ marginBottom: '24px' }}>Start by creating your first AI ad clip with our production engine.</p>
                        <button onClick={() => onNavigate('generator')} className="btn-primary">
                            Create First Ad
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
