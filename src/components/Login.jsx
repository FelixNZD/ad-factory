import React, { useState } from 'react';
import { Lock, Mail, Loader2, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';

const ADMIN_EMAILS = ['felix@axerevenue.com', 'jack@axerevenue.com'];
const ADMIN_PASSWORD = 'AxeRev99@@';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        setTimeout(() => {
            if (ADMIN_EMAILS.includes(email.toLowerCase()) && password === ADMIN_PASSWORD) {
                onLogin({ email: email.toLowerCase() });
            } else {
                setError('Invalid credentials. Access denied.');
                setIsLoading(false);
            }
        }, 800);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #111 0%, #000 100%)',
            padding: '20px'
        }}>
            <div className="card animate-slide-up" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '48px',
                backgroundColor: 'rgba(17, 17, 17, 0.6)',
                backdropFilter: 'blur(20px)',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.8)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '20px',
                        backgroundColor: 'rgba(255, 0, 0, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px auto',
                        border: '1px solid rgba(255, 0, 0, 0.1)',
                        boxShadow: '0 0 20px rgba(255, 0, 0, 0.1)'
                    }}>
                        <Sparkles className="text-gradient-red" size={36} />
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>Ad Factory</h1>
                    <p className="section-subtitle" style={{ fontSize: '14px', letterSpacing: '0.05em' }}>PROPRIETARY SECURE ACCESS</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label className="label-caps" style={{ marginLeft: '4px', marginBottom: '0' }}>Admin Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} size={18} />
                            <input
                                type="email"
                                placeholder="name@axerevenue.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{ paddingLeft: '48px', backgroundColor: 'rgba(255,255,255,0.02)' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label className="label-caps" style={{ marginLeft: '4px', marginBottom: '0' }}>Security Key</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} size={18} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingLeft: '48px', backgroundColor: 'rgba(255,255,255,0.02)' }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="animate-fade-in" style={{
                            backgroundColor: 'rgba(255, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 0, 0, 0.1)',
                            color: 'var(--error-color)',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isLoading}
                        style={{ padding: '18px', marginTop: '8px' }}
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>Authorize Session <ShieldCheck size={20} /></>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '10px', color: '#333', fontWeight: '800', letterSpacing: '0.1em' }}>
                        AXE REVENUE DATA SECURITY SYSTEM • V3.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
