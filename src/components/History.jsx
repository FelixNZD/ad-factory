import React from 'react';
import { Download, RefreshCw, Trash2, ExternalLink } from 'lucide-react';

const History = ({ history }) => {
    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const blob = await response.blob();
            // If the blob is very small and contains text, it might be an error page
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
            // Fallback: Open in new tab if blob download fails
            window.open(url, '_blank');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>Generation History</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage and download your previous AI UGC ads</p>
            </header>

            {history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {history.map((item, i) => (
                        <div key={i} className="card" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div style={{ width: '120px', aspectRatio: '9/16', backgroundColor: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                                <img src={item.imageUrl} alt="Ref" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{item.presetName}</h3>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                        SUCCESS
                                    </div>
                                </div>

                                <p style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    marginBottom: '16px'
                                }}>
                                    {item.script}
                                </p>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => handleDownload(item.videoUrl, `ad-${item.timestamp}.mp4`)}
                                        className="btn-primary"
                                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                    <button className="card" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <RefreshCw size={14} /> Regenerate
                                    </button>
                                    <button className="card" style={{ padding: '8px', color: 'var(--text-muted)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
                    <div style={{ marginBottom: '16px', opacity: 0.3 }}>
                        {/* Icon placeholder */}
                    </div>
                    <h3>No history found</h3>
                    <p>Your generated videos will appear here.</p>
                </div>
            )}
        </div>
    );
};

export default History;
