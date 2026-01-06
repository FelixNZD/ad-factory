import React from 'react';
import { FolderOpen, Clock, Film, User } from 'lucide-react';

const BatchCard = ({ batch, clipCount, onClick, showCreator = false }) => {
    return (
        <div
            onClick={onClick}
            className="card animate-slide-up"
            style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
            }}
        >
            {/* Thumbnail */}
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#111',
                border: '1px solid var(--border-color)'
            }}>
                {batch.image_url ? (
                    <img
                        src={batch.image_url}
                        alt={batch.name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
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
                    fontSize: '16px',
                    fontWeight: '700',
                    marginBottom: '6px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {batch.name}
                </h3>

                <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'var(--text-muted)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Film size={12} />
                        {clipCount} {clipCount === 1 ? 'clip' : 'clips'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
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
                        marginTop: '6px'
                    }}>
                        <User size={10} />
                        {batch.created_by.split('@')[0]}
                    </div>
                )}
            </div>

            {/* Arrow indicator */}
            <div style={{
                color: 'var(--text-muted)',
                fontSize: '18px',
                fontWeight: '300'
            }}>
                →
            </div>
        </div>
    );
};

export default BatchCard;
