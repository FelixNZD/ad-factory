import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, CheckCircle2, AlertCircle, Download, RefreshCw, Sparkles, Upload, FileImage, X, Monitor, Smartphone, Square, FileArchive, AlertTriangle, FolderOpen, Plus, Wifi, WifiOff, Pencil, Check, Wand2 } from 'lucide-react';
import { generateAdVideo, pollTaskStatus, getDownloadUrl, generateReferenceImage, pollImageTaskStatus, uploadImage } from '../services/kieService';
import { createBatch, saveGeneration, supabase } from '../services/supabase';
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

const getPresetConfig = (accent) => {
    let accentName = 'American';
    if (accent === 'australian') accentName = 'Australian';
    if (accent === 'new zealand') accentName = 'New Zealand';

    return {
        name: `${accentName} Life Insurance`,
        cost: '0.25 Credits',
        basePrompt: (script, context, gender) => {
            const actor = gender === 'male' ? 'Man' : 'Woman';
            const subject = gender === 'male' ? 'He' : 'She';
            const possessive = gender === 'male' ? 'his' : 'her';

            return `Make the ${actor} in the video speak with a clear ${accentName} accent while delivering the following lines. ${subject} is mid 60s and is talking about ${possessive} experience with life insurance. The voice should be direct, not too expressive, just matter of fact talking about ${possessive} experience.\n\n"${script}"${context ? `\n\nAdditional Context: ${context}` : ''}`
        }
    };
};

const Generator = ({ onComplete, onBatchComplete, setActiveTab, prefill, onClearPrefill, user }) => {
    const [gender, setGender] = useState('male');
    const [accent, setAccent] = useState('australian');
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
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editedScript, setEditedScript] = useState('');
    // AI Image Generation state
    const [actorImageMode, setActorImageMode] = useState('upload'); // 'upload' or 'generate'
    const [imagePrompt, setImagePrompt] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imageGenProgress, setImageGenProgress] = useState('');
    const [generatedImagePreview, setGeneratedImagePreview] = useState('');
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

    const removeImage = () => {
        setImageFile(null);
        setImagePreview('');
        setGeneratedImagePreview('');
    };

    // AI Actor Image Generation
    const handleGenerateActorImage = async () => {
        if (!imagePrompt.trim()) return;

        setIsGeneratingImage(true);
        setImageGenProgress('Submitting to Nano Banana Pro...');
        setGeneratedImagePreview('');

        try {
            const response = await generateReferenceImage(
                {
                    prompt: imagePrompt,
                    aspectRatio: aspectRatio, // Use selected aspect ratio from Production Config
                    resolution: '1K',
                    outputFormat: 'png'
                },
                (step) => setImageGenProgress(step)
            );

            if (!response.taskId) {
                throw new Error('Failed to start image generation');
            }

            setImageGenProgress('Generating actor image...');

            // Poll for completion
            let isComplete = false;
            while (!isComplete) {
                const pollResult = await pollImageTaskStatus(response.taskId);

                if (pollResult.status === 'success' && pollResult.imageUrls?.length > 0) {
                    const generatedUrl = pollResult.imageUrls[0];
                    setGeneratedImagePreview(generatedUrl);
                    setImageGenProgress('Image generated!');
                    isComplete = true;
                } else if (pollResult.status === 'fail') {
                    throw new Error(pollResult.error || 'Image generation failed');
                } else {
                    // Still waiting
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        } catch (error) {
            console.error('Actor image generation error:', error);
            setImageGenProgress(`Error: ${error.message}`);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleUseGeneratedImage = () => {
        if (generatedImagePreview) {
            setImagePreview(generatedImagePreview);
            setImageFile(null); // No file, just URL
            setGeneratedImagePreview('');
            setImagePrompt('');
        }
    };

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

        // Initialize tasks IMMEDIATELY so clip cards appear right away
        const initialTasks = snippets.map((s, i) => ({
            id: i,
            script: s,
            status: 'preparing',
            progress: 0,
            result: null,
            error: null,
            displayName: `Clip ${i + 1}`
        })).filter(t => t.script.trim().length > 0);

        setStatus('generating');
        setErrorMessage('');
        setBatchTasks(initialTasks);

        // Update all tasks to show "uploading" status
        const updateAllTasks = (updates) => {
            setBatchTasks(prev => prev.map(t => ({ ...t, ...updates })));
        };

        // Upload image FIRST (show uploading status)
        let uploadedImageUrl = imagePreview;
        if (imagePreview && imagePreview.startsWith('data:')) {
            updateAllTasks({ status: 'uploading', progress: 5 });
            try {
                console.log('📤 Uploading actor image once for all clips...');
                uploadedImageUrl = await uploadImage(imagePreview);
                console.log('✅ Actor image uploaded:', uploadedImageUrl);
            } catch (uploadError) {
                console.error('❌ Image upload failed:', uploadError);
                updateAllTasks({ status: 'error', error: uploadError.message });
                return;
            }
        }

        // Create batch in database (can happen in parallel with generation)
        const generatedBatchName = batchName.trim() || `Batch - ${new Date().toLocaleDateString()}`;
        console.log('📦 Creating batch:', generatedBatchName);

        const batch = await createBatch({
            name: generatedBatchName,
            imageUrl: uploadedImageUrl, // Use uploaded URL, not base64
            aspectRatio: aspectRatio,
            gender: gender,
            accent: accent,
            workspaceId: 'axe-revenue'
        }, user?.email);

        console.log('📦 Batch creation result:', batch);

        if (!batch || !batch.id) {
            console.error('❌ Failed to create batch! Clips will not be organized.');
        }

        const batchId = batch?.id || null;
        console.log('📦 Using batch ID:', batchId);
        setCurrentBatchId(batchId);

        // Run all tasks in parallel (using the pre-uploaded image URL)
        initialTasks.forEach(task => executeTask(task, context, gender, aspectRatio, uploadedImageUrl, batchId));

        // Notify batch created
        if (onBatchComplete && batch) {
            onBatchComplete(batch);
        }
    };

    const executeTask = async (task, currentContext, currentGender, currentAspectRatio, currentImagePreview, batchId = null) => {
        const updateTask = (updates) => {
            setBatchTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
        };

        // Maximum polling time: 10 minutes (Kie videos typically complete in 2-5 minutes)
        const MAX_POLLING_TIME_MS = 10 * 60 * 1000;
        const pollingStartTime = Date.now();

        try {
            // Reset task state for regeneration
            updateTask({ status: 'submitting', progress: 5, error: null, result: null });

            const finalPrompt = getPresetConfig(accent).basePrompt(task.script, currentContext, currentGender);
            const response = await generateAdVideo(
                { prompt: finalPrompt, imageUrl: currentImagePreview, model: 'veo3_fast', aspectRatio: currentAspectRatio },
                (step, prog) => updateTask({ progress: prog })
            );

            if (!response.taskId) throw new Error('API failed to return a valid Task ID');

            updateTask({ status: 'processing', progress: 25 });

            let isTaskDone = false;
            while (!isTaskDone) {
                // Check for polling timeout
                if (Date.now() - pollingStartTime > MAX_POLLING_TIME_MS) {
                    throw new Error('Generation timed out after 10 minutes. The server may be overloaded. Please try again.');
                }

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
                    // Enhanced error message for rejections
                    const errorMsg = pollResponse.error || 'Video was rejected by the AI engine';
                    throw new Error(errorMsg);
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

    const handleEditScript = (task) => {
        setEditingTaskId(task.id);
        setEditedScript(task.script);
    };

    const handleSaveScript = (taskId) => {
        const updatedTask = batchTasks.find(t => t.id === taskId);
        if (updatedTask) {
            const taskWithNewScript = { ...updatedTask, script: editedScript };
            setBatchTasks(prev => prev.map(t =>
                t.id === taskId ? taskWithNewScript : t
            ));
            setEditingTaskId(null);
            setEditedScript('');
            // Trigger regeneration with the new script
            executeTask(taskWithNewScript, context, gender, aspectRatio, imagePreview, currentBatchId);
        }
    };

    const handleCancelEdit = () => {
        setEditingTaskId(null);
        setEditedScript('');
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

            {/* Database Connection Warning */}
            {!supabase && (
                <div className="card" style={{
                    padding: '12px 16px',
                    marginBottom: '24px',
                    backgroundColor: 'rgba(255, 165, 0, 0.1)',
                    border: '1px solid rgba(255, 165, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <WifiOff size={18} color="orange" />
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: 'orange' }}>
                            Offline Mode
                        </span>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Database not connected. Clips won't be organized into batches.
                        </p>
                    </div>
                </div>
            )}

            <div className={['generating', 'completed', 'zipping'].includes(status) ? '' : 'grid-2-cols'}>
                {['generating', 'completed', 'zipping'].includes(status) ? (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>
                                    {batchTasks.length > 0 && batchTasks.every(t => t.status === 'completed' || t.status === 'error') ? 'Production Finished' : 'Producing Clips...'}
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
                                            {editingTaskId === task.id ? (
                                                /* Edit Mode */
                                                <>
                                                    <div style={{
                                                        aspectRatio: aspectRatio.replace(':', '/'),
                                                        backgroundColor: 'var(--video-bg)',
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
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <label className="label-caps">EDIT SCRIPT</label>
                                                        <textarea
                                                            value={editedScript}
                                                            onChange={(e) => setEditedScript(e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                minHeight: '100px',
                                                                padding: '12px',
                                                                borderRadius: '8px',
                                                                border: '1px solid var(--primary-color)',
                                                                backgroundColor: 'var(--surface-color)',
                                                                resize: 'vertical',
                                                                fontSize: '13px'
                                                            }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            <button
                                                                onClick={() => handleSaveScript(task.id)}
                                                                className="btn-primary"
                                                                style={{ flex: 1, padding: '10px' }}
                                                            >
                                                                <Check size={16} /> Save & Regenerate
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="btn-primary"
                                                                style={{ padding: '10px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                                                            >
                                                                <X size={16} color="var(--text-color)" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                /* Normal View Mode */
                                                <>
                                                    <div style={{
                                                        aspectRatio: aspectRatio.replace(':', '/'),
                                                        backgroundColor: 'var(--video-bg)',
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
                                                            }}
                                                            onLoadedMetadata={(e) => {
                                                                console.log('✅ Video loaded successfully for task', task.id);
                                                                console.log('Duration:', e.target.duration, 'seconds');
                                                                console.log('Video dimensions:', e.target.videoWidth, 'x', e.target.videoHeight);
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Script Preview */}
                                                    <p style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                        margin: 0
                                                    }}>
                                                        {task.script}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button onClick={() => handleDownload(task.result?.videoUrl, `Clip ${task.id + 1}.mp4`)} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                                                            <Download size={16} /> Download
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditScript(task)}
                                                            className="btn-primary"
                                                            style={{ padding: '10px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                                                            title="Edit script"
                                                        >
                                                            <Pencil size={16} color="var(--text-color)" />
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
                                                </>
                                            )}
                                        </div>
                                    ) : task.status === 'error' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {editingTaskId === task.id ? (
                                                /* Edit Mode for Error */
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <label className="label-caps">EDIT SCRIPT & RETRY</label>
                                                    <textarea
                                                        value={editedScript}
                                                        onChange={(e) => setEditedScript(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '120px',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--primary-color)',
                                                            backgroundColor: 'var(--surface-color)',
                                                            resize: 'vertical',
                                                            fontSize: '13px'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            onClick={() => handleSaveScript(task.id)}
                                                            className="btn-primary"
                                                            style={{ flex: 1, padding: '12px' }}
                                                        >
                                                            <Check size={16} /> Save & Regenerate
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="btn-primary"
                                                            style={{ padding: '12px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                                                        >
                                                            <X size={16} color="var(--text-color)" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Error View Mode */
                                                <>
                                                    <div style={{
                                                        padding: '16px',
                                                        backgroundColor: 'rgba(255, 0, 0, 0.05)',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(255, 0, 0, 0.15)'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '10px',
                                                            marginBottom: '12px'
                                                        }}>
                                                            <AlertCircle size={18} color="var(--error-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                            <div>
                                                                <div style={{
                                                                    fontSize: '13px',
                                                                    fontWeight: '700',
                                                                    color: 'var(--error-color)',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    Generation Failed
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                                                    {task.error}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            fontSize: '11px',
                                                            color: 'var(--text-muted)',
                                                            padding: '10px 12px',
                                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                            borderRadius: '8px',
                                                            lineHeight: '1.6'
                                                        }}>
                                                            <strong style={{ color: 'var(--text-color)' }}>💡 Tips:</strong> Try simplifying your script, avoid controversial topics, or use a different actor image.
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            onClick={() => handleRegenerateTask(task)}
                                                            className="btn-primary"
                                                            style={{
                                                                flex: 1,
                                                                padding: '14px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '8px'
                                                            }}
                                                        >
                                                            <RefreshCw size={16} color="white" /> Regenerate Clip
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditScript(task)}
                                                            className="btn-primary"
                                                            style={{ padding: '14px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', width: '54px' }}
                                                            title="Edit script"
                                                        >
                                                            <Pencil size={18} color="var(--text-color)" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div className="ai-loader-container" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                                                <div className="ai-loader-scan" />
                                                <div className="ai-loader-ring" />
                                                <div className="ai-loader-core" />
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '20px',
                                                    left: '0',
                                                    right: '0',
                                                    textAlign: 'center',
                                                    zIndex: 3
                                                }}>
                                                    <div className="shimmer-text" style={{
                                                        fontSize: '12px',
                                                        fontWeight: '800',
                                                        letterSpacing: '1px',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        Rendering Neural Bytes
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="progress-bar-container" style={{ marginBottom: '10px' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${task.progress}%` }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Loader2 size={12} className="animate-spin" />
                                                        {task.status === 'preparing' && 'PREPARING CLIP...'}
                                                        {task.status === 'uploading' && 'UPLOADING ACTOR IMAGE...'}
                                                        {task.status === 'submitting' && 'SUBMITTING TO AI ENGINE...'}
                                                        {(task.status === 'processing' || !['preparing', 'uploading', 'submitting'].includes(task.status)) && 'AI RENDER IN PROGRESS...'}
                                                    </span>
                                                    <span>{Math.floor(task.progress)}%</span>
                                                </div>
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

                                {/* Tab Switcher */}
                                {!imagePreview && (
                                    <div style={{ display: 'flex', gap: '0', marginBottom: '8px' }}>
                                        <button
                                            onClick={() => setActorImageMode('upload')}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                background: actorImageMode === 'upload' ? 'var(--surface-hover)' : 'transparent',
                                                border: '1px solid var(--border-color)',
                                                borderRight: 'none',
                                                borderRadius: '8px 0 0 8px',
                                                color: actorImageMode === 'upload' ? 'var(--text-color)' : 'var(--text-muted)',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Upload size={14} /> Upload
                                        </button>
                                        <button
                                            onClick={() => setActorImageMode('generate')}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                background: actorImageMode === 'generate' ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '0 8px 8px 0',
                                                color: actorImageMode === 'generate' ? 'var(--primary-color)' : 'var(--text-muted)',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Wand2 size={14} /> Generate with AI
                                        </button>
                                    </div>
                                )}

                                {/* Content based on mode */}
                                {!imagePreview ? (
                                    actorImageMode === 'upload' ? (
                                        /* Upload Mode */
                                        <div onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className="upload-zone">
                                            <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                                            <p style={{ fontWeight: '600', fontSize: '14px' }}>Drop actor image or click</p>
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                        </div>
                                    ) : (
                                        /* Generate Mode */
                                        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                                <label className="label-caps" style={{ marginBottom: '8px', display: 'block' }}>DESCRIBE YOUR ACTOR</label>
                                                <textarea
                                                    value={imagePrompt}
                                                    onChange={(e) => setImagePrompt(e.target.value)}
                                                    placeholder="e.g. 65 year old man, casual polo shirt, friendly smile, neutral gray background, professional headshot style..."
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '80px',
                                                        padding: '12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color)',
                                                        backgroundColor: 'var(--surface-color)',
                                                        resize: 'vertical',
                                                        fontSize: '13px'
                                                    }}
                                                    disabled={isGeneratingImage}
                                                />
                                            </div>

                                            {/* Generated Image Preview */}
                                            {generatedImagePreview && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <img
                                                        src={generatedImagePreview}
                                                        alt="Generated actor"
                                                        style={{
                                                            width: '100%',
                                                            maxHeight: '200px',
                                                            objectFit: 'contain',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={handleUseGeneratedImage}
                                                            className="btn-primary"
                                                            style={{ flex: 1, padding: '10px' }}
                                                        >
                                                            <CheckCircle2 size={16} /> Use This Image
                                                        </button>
                                                        <button
                                                            onClick={handleGenerateActorImage}
                                                            style={{
                                                                padding: '10px',
                                                                background: 'var(--surface-color)',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '8px',
                                                                color: 'var(--text-color)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                cursor: 'pointer'
                                                            }}
                                                            disabled={isGeneratingImage}
                                                        >
                                                            <RefreshCw size={16} /> Regenerate
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress/Status */}
                                            {isGeneratingImage && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(255, 0, 0, 0.05)',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                                                    {imageGenProgress || 'Generating...'}
                                                </div>
                                            )}

                                            {/* Generate Button */}
                                            {!generatedImagePreview && (
                                                <button
                                                    onClick={handleGenerateActorImage}
                                                    className="btn-primary"
                                                    style={{ width: '100%', padding: '12px' }}
                                                    disabled={!imagePrompt.trim() || isGeneratingImage}
                                                >
                                                    {isGeneratingImage ? (
                                                        <>
                                                            <Loader2 size={16} className="animate-spin" /> Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wand2 size={16} /> Generate Actor Image
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                Powered by Nano Banana Pro • Uses API credits
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    /* Image Loaded State */
                                    <div className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <img src={imagePreview} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600' }}>{imageFile?.name || 'AI Generated Actor'}</p>
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
                                    <div style={{ fontWeight: '700', fontSize: '14px' }}>{getPresetConfig(accent).name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>VEO 3.1 PRO ENGINE ACTIVE</div>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label className="label-caps">ACCENT</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {['australian', 'american', 'new zealand'].map(a => (
                                            <button
                                                key={a}
                                                onClick={() => setAccent(a)}
                                                className="card"
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    borderColor: accent === a ? 'var(--primary-color)' : 'var(--border-color)',
                                                    backgroundColor: accent === a ? 'rgba(255,0,0,0.05)' : 'transparent',
                                                    color: accent === a ? 'var(--primary-color)' : 'var(--text-muted)',
                                                    textTransform: 'capitalize',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                {a === 'australian' ? '🇦🇺' : a === 'american' ? '🇺🇸' : '🇳🇿'} {a}
                                            </button>
                                        ))}
                                    </div>
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
