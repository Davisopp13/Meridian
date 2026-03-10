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

// Helper to extract initials
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

    const actionsSectionStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    };

    const userChipStyle = {
        height: 40,
        padding: '0 14px 0 6px',
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        background: 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginRight: 8,
    };

    const initialAvatarStyle = {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${C.mBtn}, #1e40af)`,
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    };

    const usernameStyle = {
        color: C.textPri,
        fontSize: 13,
        fontWeight: 500,
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
        marginLeft: 8,
    };

    const hoverOn = (e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    };

    const hoverOff = (e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = C.border;
    };

    return (
        <nav style={containerStyle}>
            <div style={logoSectionStyle}>
                <img src="/meridian-mark-192.png" alt="Meridian" style={logoStyle} />
                <span style={brandStyle}>Meridian</span>
            </div>

            <div style={actionsSectionStyle}>
                {profile?.full_name && (
                    <div style={userChipStyle}>
                        <div style={initialAvatarStyle}>
                            {getInitials(profile.full_name)}
                        </div>
                        <span style={usernameStyle}>{profile.full_name.toLowerCase()}</span>
                    </div>
                )}

                <button
                    onClick={() => supabase.auth.signOut()}
                    style={secondaryBtnStyle}
                    onMouseOver={hoverOn}
                    onMouseOut={hoverOff}
                >
                    Sign Out
                </button>

                <button
                    onClick={() => setShowBookmarkletModal(true)}
                    style={secondaryBtnStyle}
                    onMouseOver={hoverOn}
                    onMouseOut={hoverOff}
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
