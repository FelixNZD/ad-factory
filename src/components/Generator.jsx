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

const Generator = ({ onComplete }) => {
    const [script, setScript] = useState('');
    const [context, setContext] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [status, setStatus] = useState('idle'); // idle, generating, completed, error
    const [currentStep, setCurrentStep] = useState('');
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef(null);

    const messageIntervalRef = useRef(null);
    const consecutiveFailuresRef = useRef(0);

    const AUSTRALIAN_LIFE_INSURANCE = {
        name: 'Australian Life Insurance',
        cost: '0.25 Credits',
        basePrompt: (script, context) => `Make the Man in the video speak with a clear Australian accent while delivering the following lines. He is mid 60s and is talking about his experience with life insurance. The voice should be direct, not too expressive, just matter of fact talking about his experience.\n\n"${script}"${context ? `\n\nAdditional Context: ${context}` : ''}`
    };

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
        if (!script || !imagePreview) return;

        setStatus('generating');
        setProgress(5);
        setCurrentStep('Initializing AI workflow...');
        setErrorMessage('');
        consecutiveFailuresRef.current = 0;

        try {
            const finalPrompt = AUSTRALIAN_LIFE_INSURANCE.basePrompt(script, context);

            const response = await generateAdVideo(
                { prompt: finalPrompt, imageUrl: imagePreview, model: 'veo3_fast', aspectRatio },
                (step, prog) => {
                    setCurrentStep(step);
                    setProgress(prog);
                }
            );

            if (!response.taskId) throw new Error('API failed to return a valid Task ID');

            setCurrentStep(PRODUCTION_MESSAGES[0]);
            setProgress(25);
            startDynamicUpdates();

            const poll = async () => {
                const interval = setInterval(async () => {
                    try {
                        const pollResponse = await pollTaskStatus(response.taskId);
                        consecutiveFailuresRef.current = 0; // Reset failures on any successful polling response

                        if (pollResponse.status === 'completed' && pollResponse.videoUrl) {
                            stopDynamicUpdates();
                            clearInterval(interval);
                            const finalResult = {
                                videoUrl: pollResponse.videoUrl,
                                taskId: response.taskId,
                                timestamp: new Date().toISOString(),
                                script,
                                imageUrl: imagePreview,
                                presetName: AUSTRALIAN_LIFE_INSURANCE.name,
                                aspectRatio
                            };
                            setResult(finalResult);
                            setStatus('completed');
                            onComplete(finalResult);
                            setProgress(100);
                        } else if (pollResponse.status === 'failed') {
                            stopDynamicUpdates();
                            clearInterval(interval);
                            setStatus('error');
                            setErrorMessage(pollResponse.error || 'Production failed on the server.');
                        }
                        if (pollResponse.progress > 0) {
                            const mappedProgress = 25 + (pollResponse.progress * 0.73);
                            setProgress(prev => Math.max(prev, mappedProgress));
                        }
                    } catch (pollErr) {
                        console.error('Polling error:', pollErr);
                        consecutiveFailuresRef.current += 1;

                        // If polling fails 5 times in a row, suggest a manual refresh or check network
                        if (consecutiveFailuresRef.current >= 5) {
                            stopDynamicUpdates();
                            clearInterval(interval);
                            setStatus('error');
                            setErrorMessage('Connection lost during production. Please check your network or try again.');
                        }
                    }
                }, 5000);
            };

            poll();

        } catch (err) {
            stopDynamicUpdates();
            console.error(err);
            setStatus('error');
            setErrorMessage(err.message || 'Connection failed.');
        }
    };

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setProgress(0);
        setScript('');
        setContext('');
        setCurrentStep('');
        removeImage();
        consecutiveFailuresRef.current = 0;
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

            <div style={{ display: 'grid', gridTemplateColumns: status === 'completed' ? '1fr' : '1.2fr 0.8fr', gap: '40px' }}>
                {status === 'completed' ? (
                    <div className="card animate-slide-up" style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                <CheckCircle2 size={40} color="#10b981" />
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', marginTop: '20px' }}>Production Ready!</h2>
                            <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Your AI ad is ready for download.</p>
                        </div>

                        <div style={{
                            aspectRatio: aspectRatio.replace(':', '/'),
                            maxWidth: aspectRatio === '9:16' ? '300px' : '600px',
                            backgroundColor: '#000',
                            borderRadius: '12px',
                            marginBottom: '32px',
                            overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            border: '1px solid #333',
                            margin: '0 auto 32px auto'
                        }}>
                            <video src={result?.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <a href={result?.videoUrl} target="_blank" rel="noopener noreferrer" download className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28px' }}>
                                <Download size={20} /> Download MP4
                            </a>
                            <button onClick={handleReset} className="card" style={{ padding: '14px 28px', backgroundColor: 'transparent' }}>
                                Start New
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>VOICE SCRIPT</label>
                                <textarea
                                    placeholder="Paste your life insurance script here..."
                                    style={{ height: '200px', resize: 'none', lineHeight: '1.6', fontSize: '16px', padding: '20px' }}
                                    value={script}
                                    onChange={(e) => setScript(e.target.value)}
                                    disabled={status === 'generating'}
                                />
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
                                    disabled={!script || !imagePreview || status === 'generating'}
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
                                        <>Generate Ad <Send size={18} /></>
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
