import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, CheckCircle2, AlertCircle, Download, RefreshCw, Sparkles, Upload, FileImage, X, Monitor, Smartphone, Square } from 'lucide-react';
import { generateAdVideo, pollTaskStatus } from '../services/kieService';

const ASPECT_RATIOS = [
    { id: '9:16', label: 'Vertical (9:16)', description: 'TikTok, Reels, Shorts', icon: Smartphone },
    { id: '16:9', label: 'Horizontal (16:9)', description: 'YouTube, Ads', icon: Monitor },
    { id: '1:1', label: 'Square (1:1)', description: 'Instagram Feed', icon: Square },
];

const PRODUCTION_MESSAGES = [
    "Synthesizing facial movements...",
    "Syncing audio waves to actor...",
    "Applying VEO quality filters...",
    "Generating lip-sync keyframes...",
    "Rendering 1080p production...",
    "Finalizing AI composition...",
    "Optimizing video bitrates...",
    "Wrapping up UGC performance..."
];

const AUSTRALIAN_LIFE_INSURANCE = {
    name: 'Australian Life Insurance',
    cost: '0.25 Credits',
    basePrompt: (script, context, gender) => {
        const actor = gender === 'male' ? 'Man' : 'Woman';
        const subject = gender === 'male' ? 'He' : 'She';
        const possessive = gender === 'male' ? 'his' : 'her';

        return `Make the ${actor} in the video speak with a clear Australian accent while delivering the following lines. ${subject} is mid 60s and is talking about ${possessive} experience with life insurance. The voice should be direct, not too expressive, just matter of fact talking about ${possessive} experience.\n\n"${script}"${context ? `\n\nAdditional Context: ${context}` : ''}`
    }
};

const Generator = ({ onComplete, setActiveTab }) => {
    const [gender, setGender] = useState('male');
    const [snippets, setSnippets] = useState(['']);
    const [context, setContext] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [status, setStatus] = useState('idle'); // idle, generating, completed, error
    const [currentStep, setCurrentStep] = useState('');
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [batchTasks, setBatchTasks] = useState([]); // [{id, script, status, progress, result, error}]
    const fileInputRef = useRef(null);

    const messageIntervalRef = useRef(null);
    const consecutiveFailuresRef = useRef(0);
    const isGeneratingBatchRef = useRef(false);

    const updateSnippet = (index, value) => {
        const newSnippets = [...snippets];
        newSnippets[index] = value;
        setSnippets(newSnippets);
    };

    const addSnippet = () => setSnippets([...snippets, '']);
    const removeSnippet = (index) => setSnippets(snippets.filter((_, i) => i !== index));
    const clearSnippets = () => setSnippets([]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    };

    const processFile = (file) => {
        if (file.size > 5 * 1024 * 1024) {
            alert('Image is too large. Please use an image under 5MB.');
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) processFile(file);
    };

    const removeImage = () => { setImageFile(null); setImagePreview(''); };

    const startDynamicUpdates = () => {
        let msgIndex = 0;
        messageIntervalRef.current = setInterval(() => {
            msgIndex = (msgIndex + 1) % PRODUCTION_MESSAGES.length;
            setCurrentStep(PRODUCTION_MESSAGES[msgIndex]);
            setProgress(prev => (prev < 95 ? prev + (0.5 + Math.random()) : prev));
        }, 4000);
    };

    const stopDynamicUpdates = () => {
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopDynamicUpdates();
    }, []);

    const handleGenerate = async () => {
        if (snippets.length === 0 || snippets.every(s => !s.trim()) || !imagePreview) return;

        setStatus('generating');
        setErrorMessage('');

        // Initialize tasks
        const initialTasks = snippets.map((s, i) => ({
            id: i,
            script: s,
            status: 'preparing',
            progress: 0,
            result: null,
            error: null,
            displayName: `${AUSTRALIAN_LIFE_INSURANCE.name} ${i + 1}`
        })).filter(t => t.script.trim().length > 0);

        setBatchTasks(initialTasks);

        // Run all tasks in parallel
        initialTasks.forEach(task => executeTask(task, context, gender, aspectRatio, imagePreview));
    };

    const executeTask = async (task, currentContext, currentGender, currentAspectRatio, currentImagePreview) => {
        const updateTask = (updates) => {
            setBatchTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
        };

        try {
            updateTask({ status: 'submitting', progress: 5, error: null });

            const finalPrompt = AUSTRALIAN_LIFE_INSURANCE.basePrompt(task.script, currentContext, currentGender);
            const response = await generateAdVideo(
                { prompt: finalPrompt, imageUrl: currentImagePreview, model: 'veo3_fast', aspectRatio: currentAspectRatio },
                (step, prog) => updateTask({ progress: prog })
            );

            if (!response.taskId) throw new Error('API failed to return a valid Task ID');

            updateTask({ status: 'processing', progress: 25 });

            let isTaskDone = false;
            while (!isTaskDone) {
                const pollResponse = await pollTaskStatus(response.taskId);

                if (pollResponse.status === 'completed' && pollResponse.videoUrl) {
                    const finalResult = {
                        videoUrl: pollResponse.videoUrl,
                        taskId: response.taskId,
                        timestamp: new Date().toISOString(),
                        script: task.script,
                        imageUrl: currentImagePreview,
                        presetName: task.displayName,
                        aspectRatio: currentAspectRatio,
                        gender: currentGender
                    };
                    updateTask({ status: 'completed', progress: 100, result: finalResult });
                    if (typeof onComplete === 'function') {
                        onComplete(finalResult);
                    }
                    isTaskDone = true;
                } else if (pollResponse.status === 'failed') {
                    throw new Error(pollResponse.error || 'Production failed.');
                }

                if (pollResponse.progress > 0) {
                    updateTask({ progress: 25 + (pollResponse.progress * 0.73) });
                }

                if (!isTaskDone) await new Promise(r => setTimeout(r, 5000));
            }
        } catch (err) {
            console.error(`Task ${task.id} error:`, err);
            updateTask({ status: 'error', error: err.message || 'Generation failed' });
        }
    };

    const handleRegenerateTask = (task) => {
        executeTask(task, context, gender, aspectRatio, imagePreview);
    };

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setProgress(0);
        setSnippets(['']);
        setContext('');
        setCurrentStep('');
        setBatchTasks([]);
        removeImage();
        consecutiveFailuresRef.current = 0;
        isGeneratingBatchRef.current = false;
    };

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
            window.open(url, '_blank');
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Sparkles className="text-gradient-red" size={24} />
                    <h1 style={{ fontSize: '32px', fontWeight: '800' }}>Create AI Ad</h1>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Veo 3.1 Pro Engine • Automated UGC Workflow</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: status === 'generating' || status === 'completed' ? '1fr' : '1.2fr 0.8fr', gap: '40px' }}>
                {status === 'generating' || status === 'completed' ? (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '800' }}>
                                    {batchTasks.length > 0 && batchTasks.every(t => t.status === 'completed' || t.status === 'error') ? 'Production Finished' : 'Producing Batch Clips...'}
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                    {batchTasks.length > 0 ? `${batchTasks.filter(t => t.status === 'completed').length} of ${batchTasks.length} clips ready` : 'Initializing...'}
                                </p>
                            </div>
                            <button onClick={handleReset} className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                                Start New Batch
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                            {batchTasks.map((task) => (
                                <div key={task.id} className="card animate-fade-in" style={{
                                    opacity: task.status === 'error' ? 0.7 : 1,
                                    border: task.status === 'completed' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>#{task.id + 1}</span>
                                                <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{task.displayName}</h4>
                                            </div>
                                            <p style={{
                                                fontSize: '12px',
                                                color: 'var(--text-muted)',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 1,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>{task.script}</p>
                                        </div>
                                        <div style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            backgroundColor:
                                                task.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' :
                                                    task.status === 'error' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                            color:
                                                task.status === 'completed' ? '#10b981' :
                                                    task.status === 'error' ? '#ff3333' : '#888'
                                        }}>
                                            {task.status.toUpperCase()}
                                        </div>
                                    </div>

                                    {task.status === 'completed' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{
                                                width: '100%',
                                                aspectRatio: aspectRatio.replace(':', '/'),
                                                backgroundColor: '#000',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: '1px solid #333'
                                            }}>
                                                <video
                                                    src={task.result?.videoUrl}
                                                    controls
                                                    poster={imagePreview}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleDownload(task.result?.videoUrl, `ad-${task.id + 1}.mp4`)}
                                                    className="btn-primary"
                                                    style={{ flex: 1, padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                >
                                                    <Download size={16} /> Download
                                                </button>
                                                <button
                                                    onClick={() => handleRegenerateTask(task)}
                                                    className="card"
                                                    disabled={status === 'generating'}
                                                    style={{ padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #333', backgroundColor: 'transparent' }}
                                                >
                                                    <RefreshCw size={16} /> Regenerate
                                                </button>
                                            </div>
                                        </div>
                                    ) : task.status === 'error' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 0, 0.05)', borderRadius: '8px', fontSize: '12px', color: '#ff3333', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <AlertCircle size={14} /> {task.error}
                                            </div>
                                            <button
                                                onClick={() => handleRegenerateTask(task)}
                                                className="btn-primary"
                                                style={{ width: '100%', padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                <RefreshCw size={16} /> Retry Clip
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${task.progress}%`,
                                                    height: '100%',
                                                    backgroundColor: 'var(--primary-color)',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', color: '#555' }}>Processing...</span>
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#555' }}>{Math.floor(task.progress)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>VOICE SCRIPTS ({snippets.length})</label>
                                    {snippets.length > 0 && <button onClick={clearSnippets} style={{ fontSize: '10px', color: 'var(--primary-color)', background: 'none', border: 'none', fontWeight: '700' }}>CLEAR ALL</button>}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {snippets.map((snippet, idx) => (
                                        <div key={idx} className="card" style={{ padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '11px',
                                                fontWeight: '800',
                                                color: '#444'
                                            }}>
                                                {idx + 1}
                                            </div>
                                            <textarea
                                                value={snippet}
                                                onChange={(e) => updateSnippet(idx, e.target.value)}
                                                disabled={status === 'generating'}
                                                style={{
                                                    flex: 1,
                                                    minHeight: '60px',
                                                    padding: '8px',
                                                    fontSize: '13px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    lineHeight: '1.5'
                                                }}
                                            />
                                            <button
                                                onClick={() => removeSnippet(idx)}
                                                disabled={status === 'generating'}
                                                style={{ padding: '4px', background: 'none', border: 'none', opacity: 0.3 }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {snippets.length > 0 && (
                                        <button
                                            onClick={addSnippet}
                                            disabled={status === 'generating'}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: '1px dashed #333',
                                                backgroundColor: 'transparent',
                                                color: '#666',
                                                fontSize: '13px',
                                                fontWeight: '600'
                                            }}
                                        >
                                            + Add Another Clip
                                        </button>
                                    )}

                                    {snippets.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#333', border: '1px dashed #222', borderRadius: '12px' }}>
                                            Add a script above to get started
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>ACTOR IMAGE (DRAG & DROP)</label>
                                {!imagePreview ? (
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            height: '160px',
                                            border: '2px dashed #333',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Upload size={32} color="#444" />
                                        <p style={{ fontWeight: '600', fontSize: '14px' }}>Drop image or click to upload</p>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                    </div>
                                ) : (
                                    <div className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden' }}>
                                            <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600' }}>Image Loaded</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ready for production</p>
                                        </div>
                                        <button onClick={removeImage} style={{ background: 'none', border: 'none', color: '#666' }}><X size={20} /></button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>CONTEXT (OPTIONAL)</label>
                                <input type="text" placeholder="e.g. Speaks with warmth..." value={context} onChange={(e) => setContext(e.target.value)} disabled={status === 'generating'} style={{ padding: '16px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div className="card" style={{ position: 'sticky', top: '40px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>CONFIG</h3>
                                <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.05)', borderLeft: '3px solid var(--primary-color)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '14px' }}>Australian Life Insurance</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Veo 3.1 Fast Engine</div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>GENDER</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setGender('male')}
                                            disabled={status === 'generating'}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: gender === 'male' ? '2px solid var(--primary-color)' : '1px solid #333',
                                                backgroundColor: gender === 'male' ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                color: gender === 'male' ? '#fff' : '#888',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span style={{ fontSize: '12px', fontWeight: '600' }}>Male</span>
                                        </button>
                                        <button
                                            onClick={() => setGender('female')}
                                            disabled={status === 'generating'}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: gender === 'female' ? '2px solid var(--primary-color)' : '1px solid #333',
                                                backgroundColor: gender === 'female' ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                color: gender === 'female' ? '#fff' : '#888',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span style={{ fontSize: '12px', fontWeight: '600' }}>Female</span>
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>FORMAT</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {ASPECT_RATIOS.map((ratio) => {
                                            const Icon = ratio.icon;
                                            const isSelected = aspectRatio === ratio.id;
                                            return (
                                                <button
                                                    key={ratio.id}
                                                    onClick={() => setAspectRatio(ratio.id)}
                                                    disabled={status === 'generating'}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '10px 12px',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '2px solid var(--primary-color)' : '1px solid #333',
                                                        backgroundColor: isSelected ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                        color: isSelected ? '#fff' : '#888',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <Icon size={16} />
                                                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{ratio.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    disabled={snippets.length === 0 || !imagePreview || status === 'generating'}
                                >
                                    {status === 'generating' ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>{Math.floor(progress)}%</span>
                                            </div>
                                            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{currentStep}</div>
                                        </div>
                                    ) : (
                                        <>Bulk Generate <Send size={18} /></>
                                    )}
                                </button>
                            </div>

                            {status === 'error' && (
                                <div className="card" style={{ borderColor: 'rgba(255,0,0,0.2)', backgroundColor: 'rgba(255,0,0,0.02)', color: 'var(--primary-color)', display: 'flex', gap: '10px' }}>
                                    <AlertCircle size={18} />
                                    <div style={{ fontSize: '12px' }}>
                                        <div style={{ fontWeight: '700' }}>Error</div>
                                        <div>{errorMessage}</div>
                                        <div style={{ marginTop: '4px', opacity: 0.8, fontSize: '10px' }}>Try refreshing the page or checking the console for logs.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Generator;
