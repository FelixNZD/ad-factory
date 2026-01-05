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

const Generator = ({ onComplete, setActiveTab, prefill, onClearPrefill }) => {
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

    useEffect(() => {
        if (prefill) {
            if (prefill.snippets) setSnippets(prefill.snippets);
            if (prefill.gender) setGender(prefill.gender);
            if (prefill.aspectRatio) setAspectRatio(prefill.aspectRatio);
            if (prefill.imagePreview) setImagePreview(prefill.imagePreview);

            // Clean up prefill so it doesn't overwrite manual changes later
            onClearPrefill();
        }
    }, [prefill, onClearPrefill]);

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
            // Reset task state for regeneration
            updateTask({ status: 'submitting', progress: 5, error: null, result: null });

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
        <div className="animate-fade-in container-narrow">
            <header className="section-header">
                <div className="section-title">
                    <Sparkles className="text-gradient-red" size={28} />
                    <h1>Create AI Ad</h1>
                </div>
                <p className="section-subtitle">Veo 3.1 Pro Engine • Automated UGC Workflow</p>
            </header>

            <div className={status === 'generating' || status === 'completed' ? '' : 'grid-2-cols'}>
                {status === 'generating' || status === 'completed' ? (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>
                                    {batchTasks.every(t => t.status === 'completed' || t.status === 'error') ? 'Production Finished' : 'Producing Clips...'}
                                </h2>
                                <p className="section-subtitle">
                                    {batchTasks.filter(t => t.status === 'completed').length} of {batchTasks.length} clips ready
                                </p>
                            </div>
                            <button onClick={handleReset} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                                Start New Batch
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                            {batchTasks.map((task) => (
                                <div key={task.id} className="card animate-fade-in" style={{
                                    borderColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="label-caps" style={{ marginBottom: 0 }}>#{task.id + 1}</span>
                                                <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{task.displayName}</h4>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : task.status === 'error' ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                            color: task.status === 'completed' ? 'var(--success-color)' : task.status === 'error' ? 'var(--error-color)' : 'var(--text-muted)'
                                        }}>
                                            {task.status.toUpperCase()}
                                        </div>
                                    </div>

                                    {task.status === 'completed' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{
                                                aspectRatio: aspectRatio.replace(':', '/'),
                                                backgroundColor: '#000',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                <video src={task.result?.videoUrl} controls poster={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleDownload(task.result?.videoUrl, `ad-${task.id + 1}.mp4`)} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                                                    <Download size={16} /> Download
                                                </button>
                                                <button
                                                    onClick={() => handleRegenerateTask(task)}
                                                    className="btn-primary"
                                                    style={{ padding: '10px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                                                    title="Regenerate this clip"
                                                >
                                                    <RefreshCw size={16} color="var(--text-color)" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : task.status === 'error' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 0, 0, 0.05)', borderRadius: '10px', fontSize: '12px', color: 'var(--error-color)', display: 'flex', gap: '8px' }}>
                                                <AlertCircle size={14} /> {task.error}
                                            </div>
                                            <button onClick={() => handleRegenerateTask(task)} className="btn-primary" style={{ width: '100%' }}>
                                                <RefreshCw size={16} color="white" /> Retry Clip
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '20px 0' }}>
                                            <div className="progress-bar-container" style={{ marginBottom: '10px' }}>
                                                <div className="progress-bar-fill" style={{ width: `${task.progress}%` }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                                <span>AI RENDER IN PROGRESS...</span>
                                                <span>{Math.floor(task.progress)}%</span>
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
                                    <label className="label-caps">VOICE SCRIPTS ({snippets.length})</label>
                                    {snippets.length > 0 && <button onClick={clearSnippets} style={{ fontSize: '10px', color: 'var(--primary-color)', background: 'none', border: 'none', fontWeight: '800' }}>CLEAR ALL</button>}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {snippets.map((snippet, idx) => (
                                        <div key={idx} className="card" style={{ padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>
                                                {idx + 1}
                                            </div>
                                            <textarea
                                                value={snippet}
                                                onChange={(e) => updateSnippet(idx, e.target.value)}
                                                placeholder="Enter voice script..."
                                                style={{ border: 'none', padding: '4px', minHeight: '80px', background: 'transparent' }}
                                            />
                                            <button onClick={() => removeSnippet(idx)} style={{ padding: '4px', background: 'none', border: 'none', opacity: 0.3 }}><X size={16} /></button>
                                        </div>
                                    ))}

                                    <button onClick={addSnippet} className="card-ghost" style={{ padding: '16px', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', width: '100%' }}>
                                        + Add Another Clip
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label className="label-caps">ACTOR IMAGE</label>
                                {!imagePreview ? (
                                    <div onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className="upload-zone">
                                        <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                                        <p style={{ fontWeight: '600', fontSize: '14px' }}>Drop actor image or click</p>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                    </div>
                                ) : (
                                    <div className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <img src={imagePreview} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600' }}>{imageFile?.name || 'Image Loaded'}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ready for production</p>
                                        </div>
                                        <button onClick={removeImage} style={{ background: 'none', border: 'none', color: '#666' }}><X size={20} /></button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label className="label-caps">CONTEXT (OPTIONAL)</label>
                                <input type="text" placeholder="e.g. Speaks with warmth and authority..." value={context} onChange={(e) => setContext(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div className="card" style={{ position: 'sticky', top: '40px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>PRODUCTION CONFIG</h3>

                                <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.05)', borderLeft: '3px solid var(--primary-color)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '14px' }}>{AUSTRALIAN_LIFE_INSURANCE.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>VEO 3.1 PRO ENGINE ACTIVE</div>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label className="label-caps">GENDER</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {['male', 'female'].map(g => (
                                            <button
                                                key={g}
                                                onClick={() => setGender(g)}
                                                className="card"
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    borderColor: gender === g ? 'var(--primary-color)' : 'var(--border-color)',
                                                    backgroundColor: gender === g ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                    color: gender === g ? 'var(--primary-color)' : 'var(--text-muted)',
                                                    textTransform: 'capitalize',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '32px' }}>
                                    <label className="label-caps">FORMAT</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {ASPECT_RATIOS.map((ratio) => {
                                            const Icon = ratio.icon;
                                            const isSelected = aspectRatio === ratio.id;
                                            return (
                                                <button
                                                    key={ratio.id}
                                                    onClick={() => setAspectRatio(ratio.id)}
                                                    className="card"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px',
                                                        borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-color)',
                                                        backgroundColor: isSelected ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                        color: isSelected ? 'var(--primary-color)' : 'var(--text-muted)',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <Icon size={18} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{ratio.label}</div>
                                                        <div style={{ fontSize: '10px', opacity: 0.6 }}>{ratio.description}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '18px' }}
                                    disabled={snippets.length === 0 || !imagePreview || status === 'generating'}
                                >
                                    {status === 'generating' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>INITIALIZING PRO ENGINE...</span>
                                        </div>
                                    ) : (
                                        <>START BATCH PRODUCTION <Send size={18} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Generator;
