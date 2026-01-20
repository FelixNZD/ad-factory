import React, { useState, useRef } from 'react';
import { Upload, Wand2, Loader2, Sparkles, AlertCircle, Download, Image as ImageIcon, X, FolderArchive, Settings, Palette, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { uploadImage, analyzeAdImage, generateReferenceImage, pollImageTaskStatus } from '../services/kieService';
import JSZip from 'jszip';

const ASPECT_RATIOS = [
    { id: '1:1', label: 'Square (1:1)', description: 'Instagram Feed' },
    { id: '9:16', label: 'Vertical (9:16)', description: 'Stories, Reels' },
    { id: '16:9', label: 'Horizontal (16:9)', description: 'YouTube, Ads' },
    { id: '4:5', label: 'Portrait (4:5)', description: 'Facebook Feed' },
    { id: '3:4', label: 'Classic (3:4)', description: 'Pinterest' },
];

const IMAGE_MODELS = [
    { id: 'nano-banana-pro', label: 'Nano Banana Pro', description: 'Fast & High Quality' },
    { id: 'flux-pro', label: 'Flux Pro', description: 'Photo-realistic & Sharp' },
    { id: 'stable-diffusion-xl', label: 'SDXL', description: 'Open & Versatile' },
];

const AdRemixer = () => {
    // Step state: 'upload', 'configure', 'generating', 'results'
    const [step, setStep] = useState('upload');

    // Uploaded images
    const [uploadedImages, setUploadedImages] = useState([]); // [{file, preview, name}]

    // Configuration
    const [variationsPerImage, setVariationsPerImage] = useState(3);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [selectedModels, setSelectedModels] = useState(['nano-banana-pro']);
    const [offerContext, setOfferContext] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Generation state
    const [generatedImages, setGeneratedImages] = useState([]); // [{sourceImage, variations: [url, url, ...], name}]
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, currentImage: '' });
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);
    const zipInputRef = useRef(null);

    // Calculate total generations
    const totalGenerations = uploadedImages.length * variationsPerImage;

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        processFiles(files);
    };

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const zip = await JSZip.loadAsync(file);
            const imageFiles = [];

            for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if (!zipEntry.dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
                    const blob = await zipEntry.async('blob');
                    const imageFile = new File([blob], filename, { type: `image/${filename.split('.').pop()}` });
                    imageFiles.push(imageFile);
                }
            }

            if (imageFiles.length === 0) {
                alert('No image files found in the ZIP archive.');
                return;
            }

            processFiles(imageFiles);
        } catch (err) {
            console.error('ZIP extraction error:', err);
            alert('Failed to extract ZIP file. Please ensure it\'s a valid archive.');
        }
    };

    const processFiles = (files) => {
        const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);

        if (validFiles.length === 0) {
            alert('No valid image files found. Images must be under 10MB.');
            return;
        }

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImages(prev => {
                    // Avoid duplicates
                    if (prev.some(img => img.name === file.name)) return prev;
                    return [...prev, { file, preview: reader.result, name: file.name }];
                });
            };
            reader.readAsDataURL(file);
        });
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);

        // Check if it's a ZIP
        const zipFile = files.find(f => f.name.endsWith('.zip'));
        if (zipFile) {
            handleZipUpload({ target: { files: [zipFile] } });
        } else {
            processFiles(files.filter(f => f.type.startsWith('image/')));
        }
    };

    const removeImage = (index) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (uploadedImages.length === 0) return;

        setStep('generating');
        setGeneratedImages([]);
        setError('');

        const total = uploadedImages.length * variationsPerImage;
        let completed = 0;

        try {
            // 1. Upload all images in parallel first
            const uploadPromises = uploadedImages.map(async (img) => {
                if (img.preview.startsWith('data:')) {
                    const url = await uploadImage(img.preview);
                    return { ...img, url };
                }
                return { ...img, url: img.preview };
            });

            setGenerationProgress({ current: 0, total, currentImage: 'Uploading source images...' });
            const imagesWithUrls = await Promise.all(uploadPromises);

            // 2. Define a function to handle a single variation generation (Start + Poll)
            const generateAndPollVariation = async (sourceUrl, sourceName, model, vIdx) => {
                const prompt = `Create a unique visual variation of this reference ad image. Maintain the core visual concept but reimagine with fresh composition, lighting, or perspective. ${offerContext.trim() ? `Context: ${offerContext.trim()}.` : ''} ${customPrompt.trim() ? `Direction: ${customPrompt.trim()}` : ''}`;

                try {
                    const response = await generateReferenceImage({
                        prompt,
                        referenceImages: [sourceUrl],
                        aspectRatio,
                        model
                    });

                    if (!response.taskId) throw new Error('No taskId returned');

                    // Polling
                    let attempts = 0;
                    while (attempts < 60) {
                        const status = await pollImageTaskStatus(response.taskId);
                        if (status.status === 'success' && status.imageUrls?.length > 0) {
                            completed++;
                            setGenerationProgress(prev => ({ ...prev, current: completed, currentImage: `Completed ${vIdx + 1} for ${sourceName}` }));
                            return { url: status.imageUrls[0], model };
                        } else if (status.status === 'fail') {
                            throw new Error(status.error || 'Task failed');
                        }
                        await new Promise(r => setTimeout(r, 3000));
                        attempts++;
                    }
                    throw new Error('Polling timeout');
                } catch (err) {
                    console.error(`Error generating variation for ${sourceName}:`, err);
                    completed++; // Still increment to keep progress moving
                    setGenerationProgress(prev => ({ ...prev, current: completed }));
                    return null;
                }
            };

            // 3. Create all generation tasks
            const allTasks = [];
            imagesWithUrls.forEach(img => {
                const imgVariations = [];
                for (let v = 0; v < variationsPerImage; v++) {
                    const model = selectedModels[v % selectedModels.length];
                    imgVariations.push(generateAndPollVariation(img.url, img.name, model, v));
                }
                allTasks.push({
                    sourceName: img.name,
                    sourceImage: img.url,
                    promises: imgVariations
                });
            });

            // 4. Run everything in parallel
            setGenerationProgress({ current: 0, total, currentImage: 'Starting batch generation...' });

            const results = await Promise.all(allTasks.map(async (task) => {
                const variations = await Promise.all(task.promises);
                return {
                    sourceName: task.sourceName,
                    sourceImage: task.sourceImage,
                    variations: variations.filter(v => v !== null)
                };
            }));

            setGeneratedImages(results);
            setStep('results');
        } catch (err) {
            console.error('Batch generation error:', err);
            setError('Generation failed: ' + err.message);
            setStep('configure');
        }
    };

    const resetProcess = () => {
        setStep('upload');
        setUploadedImages([]);
        setGeneratedImages([]);
        setError('');
        setOfferContext('');
        setCustomPrompt('');
    };

    const downloadAllAsZip = async () => {
        const zip = new JSZip();

        for (const result of generatedImages) {
            const folderName = result.sourceName.replace(/\.[^/.]+$/, '');
            const folder = zip.folder(folderName);

            for (let i = 0; i < result.variations.length; i++) {
                try {
                    const response = await fetch(result.variations[i].url);
                    const blob = await response.blob();
                    folder.file(`variation_${i + 1}_${result.variations[i].model}.png`, blob);
                } catch (e) {
                    console.error('Download error:', e);
                }
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ad-variations-${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-fade-in container-narrow">
            <header className="section-header">
                <div className="section-title">
                    <Wand2 className="text-secondary" style={{ color: 'var(--primary-color)' }} size={28} />
                    <h1 style={{ color: 'var(--text-color)' }}>Ad Remixer</h1>
                </div>
                <p className="section-subtitle" style={{ color: 'var(--text-muted)' }}>Bulk analyze visual ads & generate infinite variations. Pure visuals, no text.</p>
            </header>

            {error && (
                <div className="card" style={{
                    padding: '16px',
                    marginBottom: '24px',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 0, 0, 0.3)',
                    color: 'var(--error-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* STEP 1: Upload */}
            {step === 'upload' && (
                <div className="animate-slide-up">
                    <div className="card" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border-color)',
                                borderRadius: '16px',
                                padding: '60px 20px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                multiple
                                onChange={handleFileChange}
                            />
                            <input
                                type="file"
                                ref={zipInputRef}
                                style={{ display: 'none' }}
                                accept=".zip"
                                onChange={handleZipUpload}
                            />
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: 'var(--surface-hover)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <Upload size={32} color="var(--primary-color)" />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Upload Ad Screenshots</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 16px' }}>
                                Drag & drop multiple images or click to upload. Each image = one concept from Facebook Ads Library.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    className="btn-primary"
                                    style={{ padding: '10px 20px', fontSize: '13px' }}
                                >
                                    <ImageIcon size={16} /> Select Images
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); zipInputRef.current?.click(); }}
                                    className="btn-primary"
                                    style={{ padding: '10px 20px', fontSize: '13px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                                >
                                    <FolderArchive size={16} /> Upload ZIP
                                </button>
                            </div>
                        </div>

                        {uploadedImages.length > 0 && (
                            <div style={{ marginTop: '32px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '700' }}>
                                        {uploadedImages.length} Image{uploadedImages.length !== 1 ? 's' : ''} Ready
                                    </h4>
                                    <button onClick={() => setUploadedImages([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>
                                        Clear All
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                    {uploadedImages.map((img, idx) => (
                                        <div key={idx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                            <img src={img.preview} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={() => removeImage(idx)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '4px',
                                                    right: '4px',
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                                    border: 'none',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {uploadedImages.length > 0 && (
                        <button onClick={() => setStep('configure')} className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px' }}>
                            Configure Generation <Sparkles size={18} />
                        </button>
                    )}
                </div>
            )}

            {/* STEP 2: Configure */}
            {step === 'configure' && (
                <div className="animate-slide-up">
                    <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Generation Settings</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {uploadedImages.length} source images
                            </span>
                        </div>

                        {/* Variations Per Image */}
                        <div style={{ marginBottom: '24px' }}>
                            <label className="label-caps">VARIATIONS PER IMAGE (1-15)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    value={variationsPerImage}
                                    onChange={(e) => setVariationsPerImage(parseInt(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span style={{
                                    minWidth: '60px',
                                    textAlign: 'center',
                                    padding: '8px 12px',
                                    backgroundColor: 'var(--surface-hover)',
                                    color: 'var(--text-color)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    fontWeight: '800',
                                    fontSize: '18px'
                                }}>
                                    {variationsPerImage}
                                </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Total: {uploadedImages.length} × {variationsPerImage} = <strong style={{ color: 'var(--accent-text)' }}>{totalGenerations} ads</strong>
                            </p>
                        </div>

                        {/* Aspect Ratio */}
                        <div style={{ marginBottom: '24px' }}>
                            <label className="label-caps">ASPECT RATIO</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {ASPECT_RATIOS.map(ratio => (
                                    <button
                                        key={ratio.id}
                                        onClick={() => setAspectRatio(ratio.id)}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            border: aspectRatio === ratio.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            backgroundColor: aspectRatio === ratio.id ? 'rgba(255, 0, 0, 0.1)' : 'var(--surface-color)',
                                            color: aspectRatio === ratio.id ? 'var(--text-color)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            flex: '1 1 150px',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}
                                    >
                                        <div style={{
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            color: aspectRatio === ratio.id ? 'var(--text-color)' : 'var(--text-color)'
                                        }}>
                                            {ratio.label}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            color: aspectRatio === ratio.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'
                                        }}>
                                            {ratio.description}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="label-caps">IMAGE MODELS (Select one or more for round-robin)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {IMAGE_MODELS.map(model => {
                                    const isSelected = selectedModels.includes(model.id);
                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                if (isSelected) {
                                                    if (selectedModels.length > 1) {
                                                        setSelectedModels(prev => prev.filter(id => id !== model.id));
                                                    }
                                                } else {
                                                    setSelectedModels(prev => [...prev, model.id]);
                                                }
                                            }}
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '8px',
                                                border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                backgroundColor: isSelected ? 'rgba(255, 0, 0, 0.15)' : 'var(--surface-color)',
                                                color: 'var(--text-color)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                flex: '1 1 200px',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                boxShadow: isSelected ? '0 0 10px rgba(255, 0, 0, 0.1)' : 'none'
                                            }}
                                        >
                                            <div style={{
                                                fontWeight: '800',
                                                fontSize: '13px',
                                                color: isSelected ? 'var(--accent-text)' : 'var(--text-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                {model.label}
                                                {isSelected && <span style={{ fontSize: '10px', backgroundColor: 'var(--accent-text)', color: 'white', padding: '1px 6px', borderRadius: '4px' }}>Selected</span>}
                                            </div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: isSelected ? 'var(--text-color)' : 'var(--text-muted)',
                                                opacity: 0.8
                                            }}>
                                                {model.description}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Offer Context */}
                        <div style={{ marginBottom: '24px' }}>
                            <label className="label-caps">OFFER / PRODUCT CONTEXT (Optional)</label>
                            <textarea
                                value={offerContext}
                                onChange={(e) => setOfferContext(e.target.value)}
                                placeholder="e.g., Weight loss supplement for women over 40, premium CBD oil for anxiety relief, etc."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    resize: 'vertical',
                                    fontSize: '14px'
                                }}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                This context helps generate more relevant visual variations for your specific offer.
                            </p>
                        </div>

                        {/* Advanced: Custom Prompt */}
                        <div>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    padding: '8px 0'
                                }}
                            >
                                <Settings size={14} />
                                Advanced Settings
                                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {showAdvanced && (
                                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px' }}>
                                    <label className="label-caps">CUSTOM PROMPT ADDITION</label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Add specific style directions, e.g., 'Use warm sunset lighting', 'Show product in outdoor setting', 'Focus on close-up details'..."
                                        style={{
                                            width: '100%',
                                            minHeight: '100px',
                                            padding: '14px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            resize: 'vertical',
                                            fontSize: '14px'
                                        }}
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        This text is appended to the generation prompt for each variation.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setStep('upload')} className="btn-primary" style={{ padding: '16px 24px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                            ← Back
                        </button>
                        <button onClick={handleGenerate} className="btn-primary" style={{ flex: 1, padding: '16px', fontSize: '16px' }}>
                            Generate {totalGenerations} Variations <Wand2 size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: Generating */}
            {step === 'generating' && (
                <div className="card animate-fade-in" style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 32px' }}>
                        <svg className="animate-spin" viewBox="0 0 50 50" style={{ width: '100%', height: '100%' }}>
                            <circle cx="25" cy="25" r="20" fill="none" stroke="var(--border-color)" strokeWidth="3" />
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                fill="none"
                                stroke="var(--primary-color)"
                                strokeWidth="3"
                                strokeDasharray="126"
                                strokeDashoffset={126 - (126 * (generationProgress.current / generationProgress.total))}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '18px', fontWeight: '800' }}>
                                {generationProgress.total > 0 ? Math.round((generationProgress.current / generationProgress.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Generating Variations...</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                        {generationProgress.current} of {generationProgress.total} complete
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Currently: {generationProgress.currentImage || 'Starting...'}
                    </p>
                </div>
            )}

            {/* STEP 4: Results */}
            {step === 'results' && (
                <div className="animate-slide-up">
                    <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Generation Complete!</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                {generatedImages.reduce((sum, r) => sum + r.variations.length, 0)} variations generated from {generatedImages.length} source images
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={downloadAllAsZip} className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                                <Download size={16} /> Download All (.ZIP)
                            </button>
                            <button onClick={resetProcess} className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                                Start Over
                            </button>
                        </div>
                    </div>

                    {generatedImages.map((result, resultIdx) => (
                        <div key={resultIdx} className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                <img
                                    src={result.sourceImage}
                                    alt="Source"
                                    style={{
                                        width: '60px',
                                        height: '60px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        border: '2px solid var(--border-color)'
                                    }}
                                />
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Source: {result.sourceName}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{result.variations.length} variations generated</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                {result.variations.map((v, vIdx) => (
                                    <div key={vIdx} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <div style={{ aspectRatio: aspectRatio.replace(':', '/'), overflow: 'hidden', position: 'relative' }}>
                                            <img src={v.url} alt={`Variation ${vIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                fontSize: '10px',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                backdropFilter: 'blur(4px)'
                                            }}>
                                                {v.model}
                                            </div>
                                        </div>
                                        <div style={{ padding: '12px' }}>
                                            <a
                                                href={v.url}
                                                download={`${result.sourceName.replace(/\.[^/.]+$/, '')}_v${vIdx + 1}.png`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-primary"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    width: '100%',
                                                    padding: '8px',
                                                    fontSize: '12px',
                                                    textDecoration: 'none'
                                                }}>
                                                <Download size={14} /> Download
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdRemixer;
