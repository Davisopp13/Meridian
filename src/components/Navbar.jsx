import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const C = {
    bg: 'rgba(26, 26, 46, 0.8)', // Semi-transparent for glassmorphism
    border: 'rgba(255, 255, 255, 0.12)',
    textPri: 'rgba(255, 255, 255, 0.95)',
    textSec: 'rgba(255, 255, 255, 0.75)',
    mBtn: '#003087',
    mMark: '#E8540A',
};

export default function Navbar({ user, profile, onLaunchPip, setShowBookmarkletModal }) {
    const [isLaunchHovered, setIsLaunchHovered] = useState(false);

    const containerStyle = {
        height: 72,
        background: C.bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        boxSizing: 'border-box',
    };

    const logoSectionStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    };

    const logoStyle = {
        width: 36,
        height: 36,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    };

    const brandStyle = {
        color: '#fff',
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: '-0.02em',
    };

    const userStyle = {
        color: C.textSec,
        fontSize: 14,
        fontWeight: 500,
        marginLeft: 4,
    };

    const actionsSectionStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    };

    const secondaryBtnStyle = {
        height: 40,
        padding: '0 18px',
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: 'rgba(255, 255, 255, 0.05)',
        color: C.textPri,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    };

    const launchBtnStyle = {
        height: 42,
        padding: '0 24px',
        borderRadius: 12,
        border: 'none',
        background: isLaunchHovered
            ? `linear-gradient(135deg, ${C.mBtn}, #1e40af)`
            : `linear-gradient(135deg, #002566, ${C.mBtn})`,
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: isLaunchHovered
            ? '0 6px 20px rgba(0, 48, 135, 0.4)'
            : '0 4px 12px rgba(0, 48, 135, 0.2)',
        transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transform: isLaunchHovered ? 'translateY(-1px)' : 'none',
    };

    return (
        <nav style={containerStyle}>
            <div style={logoSectionStyle}>
                <img src="/meridian-mark-192.png" alt="Meridian" style={logoStyle} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <span style={brandStyle}>Meridian</span>
                    {profile?.full_name && (
                        <span style={userStyle}>{profile.full_name.toLowerCase()}</span>
                    )}
                </div>
            </div>

            <div style={actionsSectionStyle}>
                <button
                    onClick={() => supabase.auth.signOut()}
                    style={secondaryBtnStyle}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = C.border;
                    }}
                >
                    Sign Out
                </button>

                <button
                    onClick={() => setShowBookmarkletModal(true)}
                    style={secondaryBtnStyle}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = C.border;
                    }}
                >
                    <span>⚡</span>
                    <span>Bookmarklet</span>
                </button>

                <button
                    style={launchBtnStyle}
                    onClick={onLaunchPip}
                    onMouseEnter={() => setIsLaunchHovered(true)}
                    onMouseLeave={() => setIsLaunchHovered(false)}
                >
                    <span style={{ fontSize: 18 }}>🚀</span>
                    <span>Launch Widget</span>
                </button>
            </div>
        </nav>
    );
}
