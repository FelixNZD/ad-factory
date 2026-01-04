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

        // Simulate small delay for premium feel
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
            background: 'radial-gradient(circle at center, #1a1a1a 0%, #000 100%)',
            padding: '20px'
        }}>
            <div className="animate-slide-up" style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                        border: '1px solid rgba(255, 0, 0, 0.2)'
                    }}>
                        <Sparkles className="text-gradient-red" size={32} />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Ad Factory</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Admin Access Only</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', marginLeft: '4px' }}>EMAIL ADDRESS</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} size={18} />
                            <input
                                type="email"
                                placeholder="name@axerevenue.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 48px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    fontSize: '15px'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', marginLeft: '4px' }}>PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} size={18} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 48px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    fontSize: '15px'
                                }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="animate-fade-in" style={{
                            backgroundColor: 'rgba(255, 0, 0, 0.05)',
                            border: '1px solid rgba(255, 0, 0, 0.2)',
                            color: 'var(--primary-color)',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isLoading}
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '16px',
                            marginTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>Authorize Access <ShieldCheck size={20} /></>
                        )}
                    </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '32px' }}>
                    Secure Environment • Axe Revenue Proprietary
                </p>
            </div>
        </div>
    );
};

export default Login;
