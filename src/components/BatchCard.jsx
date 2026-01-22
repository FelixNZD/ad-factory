import React from 'react';
import { FolderOpen, Clock, Film, User } from 'lucide-react';

const BatchCard = ({ batch, clipCount, thumbnails = [], onClick, showCreator = false }) => {
    return (
        <div
            onClick={onClick}
            className="card animate-slide-up"
            style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
                padding: '20px'
            }}
        >
            {/* Thumbnails Stack/Grid */}
            <div style={{
                width: '120px',
                height: '80px',
                borderRadius: '12px',
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: 'var(--video-bg)',
                border: '1px solid var(--border-color)',
                position: 'relative',
                display: 'flex',
                gap: '2px',
                padding: '2px'
            }}>
                {thumbnails.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: thumbnails.length === 1 ? '1fr' : '1fr 1fr',
                        width: '100%',
                        height: '100%',
                        gap: '2px'
                    }}>
                        {thumbnails.slice(0, 4).map((url, i) => (
                            <img
                                key={i}
                                src={url}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    borderRadius: '4px'
                                }}
                            />
                        ))}
                    </div>
                ) : (batch.image_url || batch.imageUrl) ? (
                    <img
                        src={batch.image_url || batch.imageUrl}
                        alt={batch.name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '8px'
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 0, 0, 0.05)'
                    }}>
                        <FolderOpen size={24} color="var(--text-muted)" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '800',
                    marginBottom: '8px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {batch.name}
                </h3>

                <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '13px',
                    color: 'var(--text-muted)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Film size={14} />
                        {clipCount} {clipCount === 1 ? 'clip' : 'clips'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {new Date(batch.created_at).toLocaleDateString()}
                    </span>
                </div>

                {showCreator && batch.created_by && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '8px'
                    }}>
                        <User size={10} />
                        {batch.created_by.split('@')[0]}
                    </div>
                )}
            </div>

            {/* Arrow indicator */}
            <div style={{
                color: 'var(--text-muted)',
                fontSize: '24px',
                fontWeight: '300',
                paddingRight: '10px'
            }}>
                →
            </div>
        </div>
    );
};

export default BatchCard;
