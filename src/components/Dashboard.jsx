import React from 'react';
import { Play, TrendingUp, Clock, ArrowRight } from 'lucide-react';

const Dashboard = ({ history, onGenerate }) => {
    const totalGens = history.length;
    const recentVideos = history.slice(0, 3);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '48px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px' }}>Welcome back.</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>Automate your UGC ad workflow with Veo 3.1</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={16} /> TOTAL GENERATIONS
                        </div>
                        <div style={{ fontSize: '48px', fontWeight: '800', color: 'var(--primary-color)' }}>{totalGens}</div>
                    </div>
                    <button onClick={onGenerate} className="btn-primary" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        New Generation <ArrowRight size={18} />
                    </button>
                </div>

                <div className="card">
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} /> RECENT ESTIMATED COST
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '800' }}>${(totalGens * 0.25).toFixed(2)}</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>*Based on 0.25 credits/gen</p>
                </div>
            </div>

            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Recent Videos</h2>
                    {history.length > 0 && <span style={{ color: 'var(--primary-color)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>View all</span>}
                </div>

                {recentVideos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {recentVideos.map((video, i) => (
                            <div key={i} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                <div style={{ aspectRatio: '9/16', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <img src={video.thumbnail || video.imageUrl} alt="Ad Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Play fill="white" size={24} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '16px' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.presetName || 'Life Insurance Ad'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(video.timestamp).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                        No generations yet. Start by creating your first ad.
                    </div>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
