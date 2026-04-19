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

export default function Navbar({ user, profile, onLaunchPip, onLaunchCt, onLaunchMpl, setShowBookmarkletModal, onSettings, onFeedback, onAdmin, onInsights, onHome, activeView }) {
    const [isCtHovered, setIsCtHovered] = useState(false);
    const [isMplHovered, setIsMplHovered] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

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
        cursor: 'pointer',
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

    const userChipWrapperStyle = {
        position: 'relative',
    };

    const userChipStyle = {
        height: 40,
        padding: '0 14px 0 6px',
        borderRadius: 20,
        border: `1px solid ${showUserMenu ? 'rgba(255, 255, 255, 0.25)' : C.border}`,
        background: showUserMenu ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    };

    const dropdownStyle = {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        minWidth: 180,
        background: 'rgba(30, 30, 52, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '6px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        zIndex: 200,
    };

    const dropdownItemStyle = {
        width: '100%',
        padding: '10px 14px',
        border: 'none',
        background: 'transparent',
        color: C.textPri,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        borderRadius: 8,
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'background 0.15s ease',
        boxSizing: 'border-box',
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

    const launchCtBtnStyle = {
        height: 42,
        padding: '0 20px',
        borderRadius: 12,
        border: 'none',
        background: isCtHovered
            ? 'linear-gradient(135deg, #c94600, #E8540A)'
            : 'linear-gradient(135deg, #b33d00, #c94600)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: isCtHovered
            ? '0 6px 20px rgba(232, 84, 10, 0.4)'
            : '0 4px 12px rgba(232, 84, 10, 0.2)',
        transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        transform: isCtHovered ? 'translateY(-1px)' : 'none',
    };

    const launchMplBtnStyle = {
        height: 42,
        padding: '0 20px',
        borderRadius: 12,
        border: 'none',
        background: isMplHovered
            ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
            : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: isMplHovered
            ? '0 6px 20px rgba(59, 130, 246, 0.4)'
            : '0 4px 12px rgba(59, 130, 246, 0.2)',
        transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        transform: isMplHovered ? 'translateY(-1px)' : 'none',
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
            <div style={logoSectionStyle} onClick={() => onHome?.()}>
                <img src="/meridian-mark-192.png" alt="Meridian" style={logoStyle} />
                <span style={brandStyle}>Meridian</span>
            </div>

            <div style={actionsSectionStyle}>
                <button
                    onClick={onFeedback}
                    style={{
                        ...secondaryBtnStyle,
                        background: activeView === 'feedback' ? 'rgba(232, 84, 10, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: activeView === 'feedback' ? 'rgba(232, 84, 10, 0.5)' : C.border,
                        color: activeView === 'feedback' ? '#E8540A' : C.textPri,
                    }}
                    onMouseOver={(e) => {
                        if (activeView !== 'feedback') {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }
                    }}
                    onMouseOut={(e) => {
                        if (activeView !== 'feedback') {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = C.border;
                        }
                    }}
                >
                    <span>💬</span>
                    <span>Feedback</span>
                </button>

                {profile?.role === 'admin' && (
                    <button
                        onClick={onAdmin}
                        style={{
                            ...secondaryBtnStyle,
                            background: activeView === 'admin' ? 'rgba(232, 84, 10, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            borderColor: activeView === 'admin' ? 'rgba(232, 84, 10, 0.5)' : C.border,
                            color: activeView === 'admin' ? '#E8540A' : C.textPri,
                        }}
                        onMouseOver={(e) => {
                            if (activeView !== 'admin') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (activeView !== 'admin') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = C.border;
                            }
                        }}
                    >
                        <span>🛡️</span>
                        <span>Admin</span>
                    </button>
                )}

                {(profile?.role === 'supervisor' || profile?.role === 'director' || profile?.role === 'admin') && (
                    <button
                        onClick={onInsights}
                        style={{
                            ...secondaryBtnStyle,
                            background: activeView === 'insights' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            borderColor: activeView === 'insights' ? 'rgba(96, 165, 250, 0.5)' : C.border,
                            color: activeView === 'insights' ? '#60a5fa' : C.textPri,
                        }}
                        onMouseOver={(e) => {
                            if (activeView !== 'insights') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (activeView !== 'insights') {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = C.border;
                            }
                        }}
                    >
                        <span>📊</span>
                        <span>Insights</span>
                    </button>
                )}

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
                    style={launchMplBtnStyle}
                    onClick={onLaunchMpl}
                    onMouseEnter={() => setIsMplHovered(true)}
                    onMouseLeave={() => setIsMplHovered(false)}
                >
                    <span style={{ fontSize: 16 }}>▶</span>
                    <span>Processes Widget</span>
                </button>

                {profile?.full_name && (
                    <div style={userChipWrapperStyle}>
                        <div
                            style={userChipStyle}
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            onMouseOver={(e) => {
                                if (!showUserMenu) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!showUserMenu) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = C.border;
                                }
                            }}
                        >
                            <div style={initialAvatarStyle}>
                                {getInitials(profile.full_name)}
                            </div>
                            <span style={usernameStyle}>{profile.full_name.toLowerCase()}</span>
                            <span style={{
                                fontSize: 10,
                                color: C.textSec,
                                marginLeft: 2,
                                transition: 'transform 0.2s ease',
                                transform: showUserMenu ? 'rotate(180deg)' : 'none',
                            }}>▼</span>
                        </div>

                        {showUserMenu && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                                    onClick={() => setShowUserMenu(false)}
                                />
                                <div style={dropdownStyle}>
                                    <button
                                        style={dropdownItemStyle}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            onSettings && onSettings();
                                        }}
                                    >
                                        <span style={{ fontSize: 15 }}>&#9881;</span>
                                        Settings
                                    </button>
                                    <div style={{
                                        height: 1,
                                        background: C.border,
                                        margin: '4px 8px',
                                    }} />
                                    <button
                                        style={{ ...dropdownItemStyle, color: '#ef4444' }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            supabase.auth.signOut();
                                        }}
                                    >
                                        <span style={{ fontSize: 15 }}>&#10140;</span>
                                        Sign Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
