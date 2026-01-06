import React, { useState, useEffect } from 'react';
import { Users, Building2, Loader2 } from 'lucide-react';
import { WORKSPACES, getWorkspaceBatches, getBatchClips } from '../services/supabase';
import BatchCard from './BatchCard';
import BatchDetail from './BatchDetail';

const Workspaces = ({ user, onClipComplete }) => {
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [batches, setBatches] = useState([]);
    const [batchClipCounts, setBatchClipCounts] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);

    useEffect(() => {
        // Auto-select Axe Revenue for MVP
        const workspace = WORKSPACES['axe-revenue'];
        if (workspace) {
            setSelectedWorkspace(workspace);
            loadWorkspaceBatches('axe-revenue');
        }
    }, []);

    const loadWorkspaceBatches = async (workspaceId) => {
        setLoading(true);
        const data = await getWorkspaceBatches(workspaceId);
        setBatches(data);

        // Load clip counts for each batch
        const counts = {};
        for (const batch of data) {
            const clips = await getBatchClips(batch.id);
            counts[batch.id] = clips.length;
        }
        setBatchClipCounts(counts);
        setLoading(false);
    };

    if (selectedBatch) {
        return (
            <BatchDetail
                batch={selectedBatch}
                onBack={() => {
                    setSelectedBatch(null);
                    loadWorkspaceBatches('axe-revenue');
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
                            Loading workspace batches...
                        </div>
                    ) : batches.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    ) : (
                        <div className="card card-ghost" style={{
                            textAlign: 'center',
                            padding: '80px 20px'
                        }}>
                            <div style={{ opacity: 0.2, marginBottom: '16px' }}>
                                <Building2 size={48} style={{ margin: '0 auto' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                                No batches yet
                            </h3>
                            <p className="section-subtitle">
                                Batches created by team members will appear here.
                            </p>
                        </div>
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
