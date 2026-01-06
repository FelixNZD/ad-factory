import React from 'react';
import { Download, RefreshCw, Trash2, Play, Clock } from 'lucide-react';

const History = ({ history, onRegenerate, onDelete }) => {
    const [playingId, setPlayingId] = React.useState(null);
    const [videoErrors, setVideoErrors] = React.useState({});

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            if (blob.type.includes('text') && blob.size < 1000) {
                window.open(url, '_blank');
                return;
            }
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'ad-video.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    return (
        <div className="container animate-fade-in">
            <header className="section-header">
                <h1 className="section-title">Generation History</h1>
                <p className="section-subtitle">Manage and download your previous AI UGC ads</p>
            </header>

            {history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {history.map((item, i) => (
                        <div key={i} className="card animate-slide-up" style={{ display: 'flex', gap: '24px', alignItems: 'stretch', animationDelay: `${i * 0.05}s` }}>
                            <div style={{
                                width: '200px',
                                aspectRatio: item.aspectRatio ? item.aspectRatio.replace(':', '/') : '9/16',
                                backgroundColor: '#000',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                border: '1px solid var(--border-color)',
                                position: 'relative'
                            }}>
                                {playingId === i ? (
                                    <video
                                        src={item.videoUrl}
                                        controls
                                        autoPlay
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        onPause={() => setPlayingId(null)}
                                        onError={(e) => {
                                            console.error('❌ HISTORY VIDEO LOAD ERROR:', e.target.error);
                                            console.error('Video URL:', item.videoUrl);
                                            console.error('Error code:', e.target.error?.code);
                                            console.error('Item:', item);
                                            setVideoErrors(prev => ({ ...prev, [i]: true }));
                                            setPlayingId(null);
                                        }}
                                        onLoadedMetadata={(e) => {
                                            console.log('✅ History video loaded successfully');
                                            console.log('Video URL:', item.videoUrl);
                                            console.log('Duration:', e.target.duration, 'seconds');
                                        }}
                                    />
                                ) : (
                                    <div
                                        onClick={() => {
                                            if (videoErrors[i]) {
                                                alert('This video failed to load. The URL may be invalid or expired.');
                                                return;
                                            }
                                            console.log('🎬 Attempting to play video:', item.videoUrl);
                                            setPlayingId(i);
                                        }}
                                        style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                                    >
                                        <img src={item.imageUrl} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {videoErrors[i] ? (
                                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255, 0, 0, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <AlertCircle size={24} color="white" />
                                                </div>
                                            ) : (
                                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255, 0, 0, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s ease' }}>
                                                    <Play size={24} fill="white" color="white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>{item.presetName}</h3>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div className="status-dot" style={{ width: '4px', height: '4px' }}></div>
                                            {new Date(item.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '6px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                                        READY
                                    </div>
                                </div>

                                <p style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    marginBottom: '20px',
                                    lineHeight: '1.6'
                                }}>
                                    {item.script}
                                </p>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => handleDownload(item.videoUrl, `ad-${item.timestamp}.mp4`)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                                        <Download size={14} /> Download MP4
                                    </button>
                                    <button onClick={() => onRegenerate(item)} className="card" style={{ padding: '10px 14px', fontSize: '13px', border: '1px solid var(--border-color)' }}>
                                        <RefreshCw size={14} color="var(--text-color)" />
                                    </button>
                                    <button onClick={() => onDelete(item.timestamp)} className="card" style={{ padding: '10px 14px', fontSize: '13px', border: '1px solid var(--border-color)' }}>
                                        <Trash2 size={14} color="var(--text-color)" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card card-ghost" style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{ opacity: 0.2, marginBottom: '16px' }}>
                        <Clock size={48} style={{ margin: '0 auto' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>No history found</h3>
                    <p className="section-subtitle">Your generated videos will appear here once you start production.</p>
                </div>
            )}
        </div>
    );
};

export default History;
