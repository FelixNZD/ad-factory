import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, CheckCircle2, AlertCircle, Download, RefreshCw, Sparkles, Upload, FileImage, X, Monitor, Smartphone, Square, FileArchive, AlertTriangle, FolderOpen, Plus } from 'lucide-react';
import { generateAdVideo, pollTaskStatus, getDownloadUrl } from '../services/kieService';
import { createBatch, saveGeneration } from '../services/supabase';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

const Generator = ({ onComplete, onBatchComplete, setActiveTab, prefill, onClearPrefill, user }) => {
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
    const [batchName, setBatchName] = useState('');
    const [currentBatchId, setCurrentBatchId] = useState(null);
    const [newClipScript, setNewClipScript] = useState('');
    const [isAddingClip, setIsAddingClip] = useState(false);
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

        // Create a batch first
        const generatedBatchName = batchName.trim() || `Batch - ${new Date().toLocaleDateString()}`;
        console.log('📦 Creating batch:', generatedBatchName);

        const batch = await createBatch({
            name: generatedBatchName,
            imageUrl: imagePreview,
            aspectRatio: aspectRatio,
            gender: gender,
            workspaceId: 'axe-revenue'
        }, user?.email);

        console.log('📦 Batch creation result:', batch);

        if (!batch || !batch.id) {
            console.error('❌ Failed to create batch! Clips will not be organized.');
            alert('Warning: Failed to create batch in database. Clips may appear as Legacy. Check console for errors.');
        }

        const batchId = batch?.id || null;
        console.log('📦 Using batch ID:', batchId);
        setCurrentBatchId(batchId);

        // Initialize tasks
        const initialTasks = snippets.map((s, i) => ({
            id: i,
            script: s,
            status: 'preparing',
            progress: 0,
            result: null,
            error: null,
            displayName: `Clip ${i + 1}`
        })).filter(t => t.script.trim().length > 0);

        setBatchTasks(initialTasks);

        // Run all tasks in parallel
        initialTasks.forEach(task => executeTask(task, context, gender, aspectRatio, imagePreview, batchId));

        // Notify batch created
        if (onBatchComplete && batch) {
            onBatchComplete(batch);
        }
    };

    const executeTask = async (task, currentContext, currentGender, currentAspectRatio, currentImagePreview, batchId = null) => {
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
                    // Validate video URL before marking as complete
                    console.log('✅ Video URL received:', pollResponse.videoUrl);

                    // Test if URL is accessible
                    try {
                        const testResponse = await fetch(pollResponse.videoUrl, { method: 'HEAD' });
                        if (!testResponse.ok) {
                            console.error('⚠️ Video URL returned status:', testResponse.status);
                            throw new Error(`Video URL inaccessible (HTTP ${testResponse.status})`);
                        }
                        console.log('✅ Video URL is accessible');
                    } catch (urlError) {
                        console.error('❌ Video URL test failed:', urlError);
                        throw new Error(`Video URL failed to load: ${urlError.message}`);
                    }

                    const finalResult = {
                        videoUrl: pollResponse.videoUrl,
                        taskId: response.taskId,
                        timestamp: new Date().toISOString(),
                        script: task.script,
                        imageUrl: response.imageUrl || currentImagePreview,
                        presetName: task.displayName,
                        aspectRatio: currentAspectRatio,
                        gender: currentGender
                    };
                    updateTask({ status: 'completed', progress: 100, result: finalResult });

                    // Save to Supabase with batch ID
                    if (user?.email) {
                        await saveGeneration(finalResult, user.email, batchId);
                    }

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
        executeTask(task, context, gender, aspectRatio, imagePreview, currentBatchId);
    };

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setProgress(0);
        setSnippets(['']);
        setContext('');
        setCurrentStep('');
        setBatchTasks([]);
        setBatchName('');
        setCurrentBatchId(null);
        setNewClipScript('');
        setIsAddingClip(false);
        removeImage();
        consecutiveFailuresRef.current = 0;
        isGeneratingBatchRef.current = false;
    };

    const handleDownloadAll = async () => {
        const completedTasks = batchTasks.filter(t => t.status === 'completed' && t.result?.videoUrl);
        if (completedTasks.length === 0) return;

        const zip = new JSZip();
        const folder = zip.folder("ad-clips");

        setStatus('zipping'); // Temporary status for UI feedback

        try {
            const downloadPromises = completedTasks.map(async (task, idx) => {
                const response = await fetch(task.result.videoUrl);
                const blob = await response.blob();
                folder.file(`Clip ${task.id + 1}.mp4`, blob);
            });

            await Promise.all(downloadPromises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "ai-ad-clips.zip");
        } catch (error) {
            console.error('Error creating zip:', error);
            alert('Failed to create zip file. Individual downloads are still available.');
        } finally {
            setStatus('completed');
        }
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            // Get the official temporary download URL from Kie API
            // This bypasses CORS and CDN issues
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
            // Fallback
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

            <div className={['generating', 'completed', 'zipping'].includes(status) ? '' : 'grid-2-cols'}>
                {['generating', 'completed', 'zipping'].includes(status) ? (
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
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {batchTasks.some(t => t.status === 'completed') && (
                                    <button
                                        onClick={handleDownloadAll}
                                        className="btn-primary"
                                        style={{
                                            padding: '8px 16px',
                                            fontSize: '13px',
                                            backgroundColor: 'var(--surface-color)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        disabled={status === 'zipping'}
                                    >
                                        {status === 'zipping' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <FileArchive size={14} />
                                        )}
                                        Download All (.ZIP)
                                    </button>
                                )}
                                <button onClick={handleReset} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                                    Start New Batch
                                </button>
                            </div>
                        </div>

                        {/* Add More Clips Section */}
                        <div className="card" style={{
                            padding: '20px',
                            border: isAddingClip ? '1px solid var(--primary-color)' : '1px dashed var(--border-color)',
                            backgroundColor: isAddingClip ? 'rgba(255, 0, 0, 0.02)' : 'transparent'
                        }}>
                            {!isAddingClip ? (
                                <button
                                    onClick={() => setIsAddingClip(true)}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Plus size={18} /> Add More Clips to This Batch
                                </button>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Add New Script</h4>
                                        <button
                                            onClick={() => {
                                                setIsAddingClip(false);
                                                setNewClipScript('');
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <textarea
                                        value={newClipScript}
                                        onChange={(e) => setNewClipScript(e.target.value)}
                                        placeholder="Enter voice script for a new clip..."
                                        style={{
                                            width: '100%',
                                            minHeight: '100px',
                                            padding: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            resize: 'vertical'
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!newClipScript.trim()) return;
                                            const newId = batchTasks.length;
                                            const newTask = {
                                                id: newId,
                                                script: newClipScript,
                                                status: 'preparing',
                                                progress: 0,
                                                result: null,
                                                error: null,
                                                displayName: `Clip ${newId + 1}`
                                            };
                                            setBatchTasks(prev => [...prev, newTask]);
                                            executeTask(newTask, context, gender, aspectRatio, imagePreview, currentBatchId);
                                            setNewClipScript('');
                                            setIsAddingClip(false);
                                        }}
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '14px' }}
                                        disabled={!newClipScript.trim()}
                                    >
                                        <Send size={16} /> Generate Clip
                                    </button>
                                </div>
                            )}
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
                                                border: '1px solid var(--border-color)',
                                                position: 'relative'
                                            }}>
                                                <video
                                                    src={task.result?.videoUrl}
                                                    controls
                                                    poster={imagePreview}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={(e) => {
                                                        console.error('❌ VIDEO LOAD ERROR for task', task.id, ':', e.target.error);
                                                        console.error('Video URL:', task.result?.videoUrl);
                                                        console.error('Error code:', e.target.error?.code);
                                                        console.error('Error message:', e.target.error?.message);
                                                        updateTask({
                                                            status: 'error',
                                                            error: `Video failed to load (Error ${e.target.error?.code || 'UNKNOWN'}). The video URL may be invalid or blocked by CORS.`
                                                        });
                                                    }}
                                                    onLoadedMetadata={(e) => {
                                                        console.log('✅ Video loaded successfully for task', task.id);
                                                        console.log('Duration:', e.target.duration, 'seconds');
                                                        console.log('Video dimensions:', e.target.videoWidth, 'x', e.target.videoHeight);
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleDownload(task.result?.videoUrl, `Clip ${task.id + 1}.mp4`)} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
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
                                            <button onClick={() => removeSnippet(idx)} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={16} /></button>
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
                                        <button onClick={removeImage} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
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

                                <div style={{ marginBottom: '24px' }}>
                                    <label className="label-caps">BATCH NAME</label>
                                    <input
                                        type="text"
                                        placeholder={`Batch - ${new Date().toLocaleDateString()}`}
                                        value={batchName}
                                        onChange={(e) => setBatchName(e.target.value)}
                                    />
                                </div>

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
