import React, { useState, useEffect } from 'react';
import { Users, Building2, Loader2, Clock, Download, Play } from 'lucide-react';
import { WORKSPACES, getWorkspaceBatches, getBatchClips, getWorkspaceGenerations } from '../services/supabase';
import { getDownloadUrl } from '../services/kieService';
import BatchCard from './BatchCard';
import BatchDetail from './BatchDetail';

const Workspaces = ({ user, onClipComplete }) => {
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [batches, setBatches] = useState([]);
    const [batchClipCounts, setBatchClipCounts] = useState({});
    const [legacyClips, setLegacyClips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showLegacy, setShowLegacy] = useState(false);
    const [playingId, setPlayingId] = useState(null);

    useEffect(() => {
        // Auto-select Axe Revenue for MVP
        const workspace = WORKSPACES['axe-revenue'];
        if (workspace) {
            setSelectedWorkspace(workspace);
            loadWorkspaceData('axe-revenue');
        }
    }, []);

    const loadWorkspaceData = async (workspaceId) => {
        setLoading(true);

        // Load batches
        const batchData = await getWorkspaceBatches(workspaceId);
        setBatches(batchData);

        // Load clip counts for each batch
        const counts = {};
        for (const batch of batchData) {
            const clips = await getBatchClips(batch.id);
            counts[batch.id] = clips.length;
        }
        setBatchClipCounts(counts);

        // Load legacy clips (without batch_id) from workspace members
        const allGenerations = await getWorkspaceGenerations(workspaceId);
        const legacy = allGenerations.filter(g => !g.batch_id);
        setLegacyClips(legacy);

        setLoading(false);
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const downloadUrl = await getDownloadUrl(url);
            const link = document.createElement('a');
            link.href = downloadUrl || url;
            link.download = filename || 'clip.mp4';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    if (selectedBatch) {
        return (
            <BatchDetail
                batch={selectedBatch}
                onBack={() => {
                    setSelectedBatch(null);
                    loadWorkspaceData('axe-revenue');
                }}
                onClipComplete={onClipComplete}
                userEmail={user?.email}
            />
        );
    }

    return (
        <div className="container animate-fade-in">
            <header className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Building2 className="text-gradient-red" size={28} />
                    <h1 className="section-title" style={{ marginBottom: 0 }}>Workspaces</h1>
                </div>
                <p className="section-subtitle">Collaborate with your team on ad productions</p>
            </header>

            {selectedWorkspace ? (
                <>
                    {/* Workspace Header */}
                    <div className="card" style={{
                        marginBottom: '24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
                                {selectedWorkspace.name}
                            </h2>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13px',
                                color: 'var(--text-muted)'
                            }}>
                                <Users size={14} />
                                {selectedWorkspace.members.length} team members
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {selectedWorkspace.members.map((email) => (
                                <div
                                    key={email}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        backgroundColor: 'var(--surface-hover)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: 'var(--text-muted)',
                                        border: '1px solid var(--border-color)',
                                        textTransform: 'uppercase'
                                    }}
                                    title={email}
                                >
                                    {email.charAt(0)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Batches List */}
                    {loading ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: 'var(--text-muted)'
                        }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                            Loading workspace content...
                        </div>
                    ) : (
                        <>
                            {batches.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                    {batches.map((batch, idx) => (
                                        <BatchCard
                                            key={batch.id}
                                            batch={batch}
                                            clipCount={batchClipCounts[batch.id] || 0}
                                            onClick={() => setSelectedBatch(batch)}
                                            showCreator={true}
                                            style={{ animationDelay: `${idx * 0.05}s` }}
                                        />
                                    ))}
                                </div>
                            ) : legacyClips.length === 0 ? (
                                <div className="card card-ghost" style={{
                                    textAlign: 'center',
                                    padding: '80px 20px'
                                }}>
                                    <div style={{ opacity: 0.2, marginBottom: '16px' }}>
                                        <Building2 size={48} style={{ margin: '0 auto' }} />
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                                        No content yet
                                    </h3>
                                    <p className="section-subtitle">
                                        Content created by team members will appear here.
                                    </p>
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
                                            <span style={{ fontWeight: '600' }}>Team Legacy Clips ({legacyClips.length})</span>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
                                            {showLegacy ? '−' : '+'}
                                        </span>
                                    </button>

                                    {showLegacy && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                            {legacyClips.map((clip, i) => (
                                                <div key={clip.timestamp || i} className="card" style={{ padding: '12px' }}>
                                                    <div style={{
                                                        aspectRatio: (clip.aspectRatio || '9:16').replace(':', '/'),
                                                        backgroundColor: 'var(--video-bg)',
                                                        borderRadius: '10px',
                                                        overflow: 'hidden',
                                                        marginBottom: '12px',
                                                        border: '1px solid var(--border-color)',
                                                        position: 'relative'
                                                    }}>
                                                        {playingId === i ? (
                                                            <video
                                                                src={clip.videoUrl}
                                                                controls
                                                                autoPlay
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                onPause={() => setPlayingId(null)}
                                                            />
                                                        ) : (
                                                            <div
                                                                onClick={() => setPlayingId(i)}
                                                                style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                                                            >
                                                                <img
                                                                    src={clip.imageUrl}
                                                                    alt="Thumbnail"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                                                                />
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    inset: 0,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <div style={{
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: 'rgba(255, 0, 0, 0.6)',
                                                                        backdropFilter: 'blur(8px)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}>
                                                                        <Play size={18} fill="white" color="white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <p style={{
                                                            fontSize: '11px',
                                                            color: 'var(--text-muted)',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {clip.script || 'No script'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDownload(clip.videoUrl, `clip-${clip.timestamp}.mp4`)}
                                                        className="btn-primary"
                                                        style={{ width: '100%', padding: '8px', fontSize: '11px' }}
                                                    >
                                                        <Download size={12} /> Download
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : (
                <div className="card card-ghost" style={{
                    textAlign: 'center',
                    padding: '80px 20px'
                }}>
                    <p className="section-subtitle">No workspaces available.</p>
                </div>
            )}
        </div>
    );
};

export default Workspaces;
