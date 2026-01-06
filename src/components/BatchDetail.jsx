import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, RefreshCw, Trash2, Play, Plus, Loader2, FileArchive, X, Send } from 'lucide-react';
import { getBatchClips, saveGeneration } from '../services/supabase';
import { generateAdVideo, pollTaskStatus } from '../services/kieService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const AUSTRALIAN_LIFE_INSURANCE = {
    name: 'Australian Life Insurance',
    basePrompt: (script, context, gender) => {
        const actor = gender === 'male' ? 'Man' : 'Woman';
        const subject = gender === 'male' ? 'He' : 'She';
        const possessive = gender === 'male' ? 'his' : 'her';

        return `Make the ${actor} in the video speak with a clear Australian accent while delivering the following lines. ${subject} is mid 60s and is talking about ${possessive} experience with life insurance. The voice should be direct, not too expressive, just matter of fact talking about ${possessive} experience.\n\n"${script}"${context ? `\n\nAdditional Context: ${context}` : ''}`
    }
};

const BatchDetail = ({ batch, onBack, onClipComplete, userEmail }) => {
    const [clips, setClips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState(null);
    const [isZipping, setIsZipping] = useState(false);
    const [showAddScript, setShowAddScript] = useState(false);
    const [newScript, setNewScript] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generatingProgress, setGeneratingProgress] = useState(0);

    useEffect(() => {
        loadClips();
    }, [batch.id]);

    const loadClips = async () => {
        setLoading(true);
        const data = await getBatchClips(batch.id);
        setClips(data);
        setLoading(false);
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const isProduction = window.location.hostname !== 'localhost';
            const fetchUrl = isProduction
                ? `/api/download?url=${encodeURIComponent(url)}`
                : url;

            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'clip.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    const handleDownloadAll = async () => {
        if (clips.length === 0) return;

        setIsZipping(true);
        const zip = new JSZip();
        const folder = zip.folder(batch.name.replace(/[^a-z0-9]/gi, '-'));

        try {
            const downloadPromises = clips.map(async (clip, idx) => {
                const response = await fetch(clip.videoUrl);
                const blob = await response.blob();
                folder.file(`Clip ${idx + 1}.mp4`, blob);
            });

            await Promise.all(downloadPromises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${batch.name.replace(/[^a-z0-9]/gi, '-')}.zip`);
        } catch (error) {
            console.error('Error creating zip:', error);
            alert('Failed to create zip file. Individual downloads are still available.');
        } finally {
            setIsZipping(false);
        }
    };

    const handleAddScript = async () => {
        if (!newScript.trim()) return;

        setGenerating(true);
        setGeneratingProgress(5);

        try {
            const finalPrompt = AUSTRALIAN_LIFE_INSURANCE.basePrompt(
                newScript,
                '',
                batch.gender || 'male'
            );

            const response = await generateAdVideo(
                {
                    prompt: finalPrompt,
                    imageUrl: batch.image_url,
                    model: 'veo3_fast',
                    aspectRatio: batch.aspect_ratio || '9:16'
                },
                (step, prog) => setGeneratingProgress(prog)
            );

            if (!response.taskId) throw new Error('API failed to return a valid Task ID');

            setGeneratingProgress(25);

            let isTaskDone = false;
            while (!isTaskDone) {
                const pollResponse = await pollTaskStatus(response.taskId);

                if (pollResponse.status === 'completed' && pollResponse.videoUrl) {
                    const finalResult = {
                        videoUrl: pollResponse.videoUrl,
                        taskId: response.taskId,
                        timestamp: new Date().toISOString(),
                        script: newScript,
                        imageUrl: response.imageUrl || batch.image_url,
                        presetName: `Clip ${clips.length + 1}`,
                        aspectRatio: batch.aspect_ratio,
                        gender: batch.gender
                    };

                    await saveGeneration(finalResult, userEmail, batch.id);
                    if (onClipComplete) onClipComplete(finalResult);

                    setClips(prev => [...prev, { ...finalResult, batch_id: batch.id }]);
                    setNewScript('');
                    setShowAddScript(false);
                    isTaskDone = true;
                } else if (pollResponse.status === 'failed') {
                    throw new Error(pollResponse.error || 'Production failed.');
                }

                if (pollResponse.progress > 0) {
                    setGeneratingProgress(25 + (pollResponse.progress * 0.73));
                }

                if (!isTaskDone) await new Promise(r => setTimeout(r, 5000));
            }
        } catch (err) {
            console.error('Error generating clip:', err);
            alert('Failed to generate clip: ' + err.message);
        } finally {
            setGenerating(false);
            setGeneratingProgress(0);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={onBack}
                        className="card"
                        style={{
                            padding: '10px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{batch.name}</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {clips.length} clips • Created {new Date(batch.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setShowAddScript(true)}
                        className="btn-primary"
                        style={{ padding: '10px 16px', fontSize: '13px' }}
                    >
                        <Plus size={16} /> Add Clip
                    </button>
                    {clips.length > 0 && (
                        <button
                            onClick={handleDownloadAll}
                            className="card"
                            style={{
                                padding: '10px 16px',
                                fontSize: '13px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            disabled={isZipping}
                        >
                            {isZipping ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <FileArchive size={16} />
                            )}
                            Download All
                        </button>
                    )}
                </div>
            </div>

            {/* Add Script Modal */}
            {showAddScript && (
                <div className="card" style={{
                    marginBottom: '24px',
                    padding: '20px',
                    border: '1px solid var(--primary-color)',
                    backgroundColor: 'rgba(255, 0, 0, 0.02)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                    }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Add New Clip</h3>
                        <button
                            onClick={() => setShowAddScript(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={18} color="var(--text-color)" />
                        </button>
                    </div>

                    {generating ? (
                        <div style={{ padding: '20px 0' }}>
                            <div className="progress-bar-container" style={{ marginBottom: '10px' }}>
                                <div className="progress-bar-fill" style={{ width: `${generatingProgress}%` }} />
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                fontWeight: '600'
                            }}>
                                <span>GENERATING CLIP...</span>
                                <span>{Math.floor(generatingProgress)}%</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={newScript}
                                onChange={(e) => setNewScript(e.target.value)}
                                placeholder="Enter voice script for new clip..."
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    marginBottom: '16px',
                                    resize: 'vertical'
                                }}
                            />
                            <button
                                onClick={handleAddScript}
                                className="btn-primary"
                                style={{ width: '100%', padding: '14px' }}
                                disabled={!newScript.trim()}
                            >
                                Generate Clip <Send size={16} />
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Clips Grid */}
            {loading ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: 'var(--text-muted)'
                }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                    Loading clips...
                </div>
            ) : clips.length > 0 ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px'
                }}>
                    {clips.map((clip, idx) => (
                        <div key={clip.timestamp || idx} className="card" style={{ padding: '16px' }}>
                            {/* Video Preview */}
                            <div style={{
                                aspectRatio: (batch.aspect_ratio || '9:16').replace(':', '/'),
                                backgroundColor: '#000',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                marginBottom: '16px',
                                border: '1px solid var(--border-color)',
                                position: 'relative'
                            }}>
                                {playingId === idx ? (
                                    <video
                                        src={clip.videoUrl}
                                        controls
                                        autoPlay
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        onPause={() => setPlayingId(null)}
                                    />
                                ) : (
                                    <div
                                        onClick={() => setPlayingId(idx)}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                    >
                                        <img
                                            src={clip.imageUrl || batch.image_url}
                                            alt="Thumbnail"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                opacity: 0.6
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(255, 0, 0, 0.6)',
                                                backdropFilter: 'blur(8px)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Play size={20} fill="white" color="white" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Clip Info */}
                            <div style={{ marginBottom: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
                                    Clip {idx + 1}
                                </h4>
                                <p style={{
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {clip.script}
                                </p>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleDownload(clip.videoUrl, `Clip ${idx + 1}.mp4`)}
                                    className="btn-primary"
                                    style={{ flex: 1, padding: '10px', fontSize: '12px' }}
                                >
                                    <Download size={14} /> Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card card-ghost" style={{
                    textAlign: 'center',
                    padding: '60px 20px'
                }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                        No clips in this batch yet. Add a script to get started.
                    </p>
                </div>
            )}
        </div>
    );
};

export default BatchDetail;
