import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Trash2, Play, Clock, FolderOpen, Loader2, WifiOff } from 'lucide-react';
import { getBatchSummaries, getLegacyGenerations, supabase } from '../services/supabase';
import { getDownloadUrl } from '../services/kieService';
import BatchCard from './BatchCard';
import BatchDetail from './BatchDetail';

const History = ({ history, onRegenerate, onDelete, user, onClipComplete }) => {
    const [batches, setBatches] = useState([]);
    const [legacyClips, setLegacyClips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [videoErrors, setVideoErrors] = useState({});
    const [showLegacy, setShowLegacy] = useState(false);

    useEffect(() => {
        loadData();
    }, [history]);

    const loadData = async () => {
        setLoading(true);

        try {
            // Optimized batch summaries (includes counts and thumbnails)
            // This is ONE network request instead of N+1
            const batchSummaries = await getBatchSummaries();
            setBatches(batchSummaries);

            // Get legacy clips
            const legacy = await getLegacyGenerations();
            setLegacyClips(legacy);

            // Also use local history for clips without batch_id as fallback
            const localLegacy = history.filter(h => !h.batch_id);
            if (legacy.length === 0 && localLegacy.length > 0) {
                setLegacyClips(localLegacy);
            }
        } catch (error) {
            console.error('Error loading history data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            // Get the official temporary download URL from Kie API
            const downloadUrl = await getDownloadUrl(url);

            const link = document.createElement('a');
            link.href = downloadUrl || url;
            link.download = filename || 'ad-video.mp4';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };


    // Show batch detail view
    if (selectedBatch) {
        return (
            <BatchDetail
                batch={selectedBatch}
                onBack={() => {
                    setSelectedBatch(null);
                    loadData();
                }}
                onClipComplete={onClipComplete}
                userEmail={user?.email}
            />
        );
    }

    return (
        <div className="container animate-fade-in">
            <header className="section-header">
                <h1 className="section-title">Generation History</h1>
                <p className="section-subtitle">Manage and download your AI UGC ad batches</p>
            </header>

            {/* Database Connection Warning */}
            {!supabase && (
                <div className="card" style={{
                    padding: '12px 16px',
                    marginBottom: '24px',
                    backgroundColor: 'rgba(255, 165, 0, 0.1)',
                    border: '1px solid rgba(255, 165, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: 'orange' }}>
                            Offline Mode
                        </span>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Database not connected. Showing local history only.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: 'var(--text-muted)'
                }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                    Loading batches...
                </div>
            ) : (
                <>
                    {/* Batches Section */}
                    {batches.length > 0 ? (
                        <div style={{ marginBottom: '40px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {batches.map((batch, idx) => (
                                    <BatchCard
                                        key={batch.id}
                                        batch={batch}
                                        clipCount={batch.clipCount || 0}
                                        thumbnails={batch.thumbnails || []}
                                        onClick={() => setSelectedBatch(batch)}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : legacyClips.length === 0 ? (
                        <div className="card card-ghost" style={{ textAlign: 'center', padding: '80px 20px' }}>
                            <div style={{ opacity: 0.2, marginBottom: '16px' }}>
                                <FolderOpen size={48} style={{ margin: '0 auto' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>No batches found</h3>
                            <p className="section-subtitle">Your generated batches will appear here once you start production.</p>
                        </div>
                    ) : null}

                    {/* Legacy Clips Section */}
                    {legacyClips.length > 0 && (
                        <div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '20px',
                                marginTop: '40px'
                            }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Individual Clips (Legacy)</h2>
                                <button
                                    onClick={() => setShowLegacy(!showLegacy)}
                                    className="btn-primary"
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '12px',
                                        backgroundColor: 'var(--surface-color)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-color)'
                                    }}
                                >
                                    {showLegacy ? 'Hide' : 'Show All'}
                                </button>
                            </div>

                            {showLegacy && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: '20px'
                                }}>
                                    {legacyClips.map((item, i) => (
                                        <div key={i} className="card animate-slide-up" style={{
                                            padding: '12px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            animationDelay: `${i * 0.05}s`
                                        }}>
                                            <div style={{
                                                aspectRatio: item.aspectRatio ? item.aspectRatio.replace(':', '/') : '9/16',
                                                backgroundColor: 'var(--video-bg)',
                                                borderRadius: '10px',
                                                overflow: 'hidden',
                                                marginBottom: '12px',
                                                border: '1px solid var(--border-color)',
                                                position: 'relative'
                                            }}>
                                                {playingId === i ? (
                                                    <video
                                                        src={item.videoUrl || item.video_url}
                                                        controls
                                                        autoPlay
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        onPause={() => setPlayingId(null)}
                                                        onError={(e) => {
                                                            setVideoErrors(prev => ({ ...prev, [i]: true }));
                                                            setPlayingId(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        onClick={() => {
                                                            if (videoErrors[i]) {
                                                                alert('This video failed to load.');
                                                                return;
                                                            }
                                                            setPlayingId(i);
                                                        }}
                                                        style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                                                    >
                                                        <img
                                                            src={item.imageUrl || item.image_url}
                                                            alt="Reference"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255, 0, 0, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Play size={20} fill="white" color="white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '4px' }}>{item.presetName || 'Legacy Clip'}</h3>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Clock size={10} />
                                                            {new Date(item.timestamp).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <p style={{
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    marginBottom: '16px',
                                                    lineHeight: '1.5'
                                                }}>
                                                    {item.script}
                                                </p>

                                                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                                                    <button
                                                        onClick={() => handleDownload(item.videoUrl || item.video_url, `ad-${item.timestamp}.mp4`)}
                                                        className="btn-primary"
                                                        style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                                                    >
                                                        <Download size={14} /> Download
                                                    </button>
                                                    <button
                                                        onClick={() => onRegenerate(item)}
                                                        className="card"
                                                        style={{ padding: '8px', border: '1px solid var(--border-color)' }}
                                                        title="Regenerate"
                                                    >
                                                        <RefreshCw size={14} color="var(--text-color)" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(item.timestamp)}
                                                        className="card"
                                                        style={{ padding: '8px', border: '1px solid var(--border-color)' }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} color="var(--text-color)" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default History;
