import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Trash2, Play, Clock, FolderOpen, Loader2 } from 'lucide-react';
import { getBatches, getBatchClips, getLegacyGenerations } from '../services/supabase';
import BatchCard from './BatchCard';
import BatchDetail from './BatchDetail';

const History = ({ history, onRegenerate, onDelete, user, onClipComplete }) => {
    const [batches, setBatches] = useState([]);
    const [batchClipCounts, setBatchClipCounts] = useState({});
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

        // Load batches
        const batchData = await getBatches();
        setBatches(batchData);

        // Load clip counts for each batch
        const counts = {};
        for (const batch of batchData) {
            const clips = await getBatchClips(batch.id);
            counts[batch.id] = clips.length;
        }
        setBatchClipCounts(counts);

        // Load legacy clips (without batch_id)
        const legacy = await getLegacyGenerations();
        setLegacyClips(legacy);

        // Also use local history for clips without batch_id as fallback
        const localLegacy = history.filter(h => !h.batch_id);
        if (legacy.length === 0 && localLegacy.length > 0) {
            setLegacyClips(localLegacy);
        }

        setLoading(false);
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            if (blob.type.includes('text') && blob.size < 1000) {
                throw new Error('Invalid response - not a video file');
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
            console.error('Download via fetch failed (CORS issue):', error);
            window.open(url, '_blank');
            alert('Video opened in new tab. Right-click the video and select \"Save video as...\" to download.');
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
                                        clipCount={batchClipCounts[batch.id] || 0}
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
                            <button
                                onClick={() => setShowLegacy(!showLegacy)}
                                className="card"
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Clock size={18} color="var(--text-muted)" />
                                    <span style={{ fontWeight: '600' }}>Legacy Clips ({legacyClips.length})</span>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
                                    {showLegacy ? '−' : '+'}
                                </span>
                            </button>

                            {showLegacy && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {legacyClips.map((item, i) => (
                                        <div key={i} className="card animate-slide-up" style={{ display: 'flex', gap: '24px', alignItems: 'stretch', animationDelay: `${i * 0.05}s` }}>
                                            <div style={{
                                                width: '160px',
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
                                                        <img src={item.imageUrl} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255, 0, 0, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Play size={20} fill="white" color="white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '4px' }}>{item.presetName}</h3>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div className="status-dot" style={{ width: '4px', height: '4px' }}></div>
                                                            {new Date(item.timestamp).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '5px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: '800' }}>
                                                        LEGACY
                                                    </div>
                                                </div>

                                                <p style={{
                                                    fontSize: '13px',
                                                    color: 'var(--text-muted)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    marginBottom: '16px',
                                                    lineHeight: '1.6'
                                                }}>
                                                    {item.script}
                                                </p>

                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleDownload(item.videoUrl, `ad-${item.timestamp}.mp4`)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                                                        <Download size={14} /> Download
                                                    </button>
                                                    <button onClick={() => onRegenerate(item)} className="card" style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                                                        <RefreshCw size={14} color="var(--text-color)" />
                                                    </button>
                                                    <button onClick={() => onDelete(item.timestamp)} className="card" style={{ padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
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
