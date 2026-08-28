import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import {
    AlertTriangle,
    Bell,
    BookOpen,
    Brain,
    Check,
    Copy,
    Database,
    HelpCircle,
    History,
    LogOut,
    Menu,
    MessageCircle,
    Moon,
    Plus,
    Server,
    Sun,
    Trash2,
    Upload,
    UserCircle,
    X,
    BrainCogIcon
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useUI} from '../../contexts/UIContext';
import {useGlobal} from '../../contexts/GlobalContext';
import {useProFeature} from '../../hooks/useProFeature';
import {authAPI, memoryAPI, notificationsAPI} from '../../services/backendService';
import * as storageService from '../../services/storageService';
import * as appLogic from '../../services/appLogicService';
import {SavedSession} from '../../types';
import {HistoryView} from '../HistoryView';
import ProBadge from '../ProBadge';
import ProLockBadge from '../ProLockBadge';
import HelpChatBot from '../HelpChatBot';
import NotificationBadge from '../NotificationBadge';
import NotificationPanel from '../NotificationPanel';

type OpenDropdown = 'plus' | 'menu' | 'user' | null;

const AppLayout: React.FC = () => {
    const {user, handleLogout, setUser} = useAuth();
    const {
        lightMode, setLightMode,
        errorMessage, clearError,
        setIsMobileMenuOpen,
        isContextModalOpen, setIsContextModalOpen,
        isHistoryModalOpen, setIsHistoryModalOpen,
    } = useUI();
    const {
        savedSessions, setSavedSessions,
        profileContext, setProfileContext,
        memories, setMemories,
        refreshSavedSessions,
        refreshMemories,
        loadMoreSessions,
        hasMoreSessions,
        updateSessionTitle,
        toggleFavoriteSession,
    } = useGlobal();
    const {isPro} = useProFeature();
    const navigate = useNavigate();
    const location = useLocation();

    const [helpChatOpen, setHelpChatOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
    const [firstName, setFirstName] = useState(user?.first_name ?? '');
    const [lastName, setLastName] = useState(user?.last_name ?? '');
    const [showMemoryImportModal, setShowMemoryImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [exportPromptCopied, setExportPromptCopied] = useState(false);
    const MEMORY_EXPORT_PROMPT = `You are helping me import context from one AI assistant to another. Your job is to go through our past conversations and memories and sum up what you know about me.

In the output, please avoid using any first-person pronouns (I, my, me, mine) and any second-person pronouns (you, your, yours). Instead, refer to the individual you have learned about as "the user" or use neutral phrasing.

Preserve the user's words verbatim where possible, especially for instructions and preferences.

Categories (output in this order):
1. Demographics Information: Preferred names, profession, education, and general residence.
2. Interests & Preferences: Sustained, active engagements (not just owning an object or a one-time purchase).
3. Relationships: Confirmed, sustained relationships.
4. Dated Events, Projects & Plans: A log of significant, recent activities.
5. Instructions: Rules I've explicitly asked you to follow going forward, "always do X", "never do Y", and corrections to your behavior. Only include rules from stored memories, not from conversations.
6. Career: Current and past roles, companies, and general skill areas.
7. Projects: Projects I meaningfully built or committed to. Ideally ONE entry per project. Include what it does, current status, and any key decisions. Use the project name or a short descriptor as the first words of the entry.
8. Preferences: Opinions, tastes, and working-style preferences that apply broadly.

Format:
Divide the content into the labeled section using the categories above. Try to include verbatim quotes from my prompts that justify each entry. Structure each entry using this format:
* The user's name is <name>.
    * Evidence: User said "call me <name>". Date: [YYYY-MM-DD].

Output:
- Wrap the entire export in a single code block for easy copying.

Finally, complete the sentence "My AI name is: <name>", where name is ChatGPT, Claude, Grok, etc.`;
    const [isImporting, setIsImporting] = useState(false);
    const [avatarError, setAvatarError] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    const headerRef = useRef<HTMLElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (isContextModalOpen) {
            setFirstName(user?.first_name ?? '');
            setLastName(user?.last_name ?? '');
            setAvatarError(false);
        }
    }, [isContextModalOpen]);

    useEffect(() => {
        const loadNotificationCount = async () => {
            try {
                const response = await notificationsAPI.list({limit: 1});
                setNotificationUnreadCount(response.meta.unreadCount);
            } catch (error) {
                console.error('Failed to load notification count:', error);
            }
        };
        loadNotificationCount();
        const interval = setInterval(loadNotificationCount, 60000);
        return () => clearInterval(interval);
    }, []);

    const currentSessionId = useMemo(() => {
        const researchPathMatch = location.pathname.match(/^\/research\/(?!new\b)([^/]+)/);
        const resumeParam = new URLSearchParams(location.search).get('resume');
        return researchPathMatch?.[1] ?? resumeParam ?? null;
    }, [location.pathname, location.search]);

    const handleToggleLightMode = () => {
        const newMode = !lightMode;
        setLightMode(newMode);
        authAPI.updateLightMode(newMode).catch((err) => {
            console.error('Failed to save light mode preference:', err);
        });
    };

    const getThemeClasses = () =>
        lightMode ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';

    const handleHistoryOpen = () => {
        setIsHistoryModalOpen(true);
        refreshSavedSessions();
    };

    const handleLoadSession = async (session: SavedSession) => {
        setIsHistoryModalOpen(false);
        const full = await storageService.getSession(session.id);
        if (!full) {
            navigate('/');
            return;
        }
        navigate(appLogic.getSessionNavigationUrl(full));
    };

    const toggleDropdown = (name: OpenDropdown) => {
        setOpenDropdown(prev => prev === name ? null : name);
    };

    const closeAll = () => {
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
    };

    const btnBase = `p-1.5 sm:p-2 rounded-xl border transition-all`;
    const btnTheme = lightMode
        ? `bg-slate-100 border-slate-200 text-slate-600 hover:bg-white`
        : `bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700`;

    const dropdownBase = `absolute top-full mt-2 z-50 rounded-2xl border shadow-xl backdrop-blur-sm min-w-[200px] whitespace-nowrap`;
    const dropdownTheme = lightMode
        ? `bg-white/95 border-slate-200`
        : `bg-slate-950/95 border-slate-800`;

    const itemBase = `flex items-center gap-3 w-full px-4 py-3 text-sm font-bold rounded-xl transition-all`;
    const itemHover = lightMode ? `hover:bg-slate-100` : `hover:bg-slate-800/60`;

    return (
        <div
            className={`min-h-dvh font-sans selection:bg-blue-600/30 flex flex-col h-dvh overflow-hidden transition-colors duration-500 ${getThemeClasses()}`}>
            {/* Global error toast */}
            {errorMessage && (
                <div role="alert" aria-live="assertive"
                     className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-red-950 border border-red-500/40 text-red-300 px-6 py-4 rounded-2xl shadow-2xl max-w-lg w-[90vw] animate-slide-up no-print">
                    <AlertTriangle size={20} className="shrink-0 text-red-400"/>
                    <p className="text-sm font-semibold flex-grow">{errorMessage}</p>
                    <button data-analytics="dismiss_error" aria-label="Dismiss error" onClick={clearError}
                            className="shrink-0 text-red-500 hover:text-red-300"><X size={18}/></button>
                </div>
            )}

            <header ref={headerRef}
                    className={`border-b shrink-0 p-3 sm:p-4 flex items-center justify-between no-print z-50 transition-colors duration-500 relative ${lightMode ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-slate-950/80 border-slate-800'} backdrop-blur-xl`}>
                {/* Logo */}
                <div
                    className="flex items-center gap-2 sm:gap-4 cursor-pointer group"
                    onClick={() => {
                        closeAll();
                        refreshSavedSessions();
                        navigate('/');
                    }}
                >
                    <div
                        className="bg-blue-600 p-2 sm:p-2.5 rounded-2xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                        <BrainCogIcon size={24}/>
                    </div>
                    <span
                        className={`hidden min-[390px]:inline font-bold text-lg sm:text-2xl tracking-tighter uppercase ${lightMode ? 'text-slate-900' : 'text-white'}`}>
            AI<span className="text-blue-500">Works</span>
          </span>
                    <span className="min-[390px]:hidden font-bold text-lg tracking-tighter uppercase">
            <span className={lightMode ? 'text-slate-900' : 'text-white'}>P</span><span
                        className="text-blue-500">B</span>
          </span>
                </div>

                {/* Right side: Plus | [Chatbot on mobile] | Menu | User */}
                <div className="flex items-center gap-1 sm:gap-2">

                    {/* ── Plus dropdown ── */}
                    <div className="relative">
                        <button
                            data-testid="nav-plus-dropdown"
                            onClick={() => toggleDropdown('plus')}
                            className={`flex items-center ${btnBase} ${btnTheme} text-blue-500`}
                            aria-label="New session"
                        >
                            <Plus size={20}/>
                        </button>
                        {openDropdown === 'plus' && (
                            <div
                                className={`${dropdownBase} ${dropdownTheme} left-1/2 -translate-x-1/2 sm:right-0 sm:left-auto sm:translate-x-0`}>
                                <div className="p-2 flex flex-col gap-1">
                                    {isPro ? (
                                        <button
                                            data-analytics="create_research"
                                            data-testid="nav-new-research"
                                            onClick={() => {
                                                closeAll();
                                                appLogic.resetCurrentSession();
                                                navigate('/research/new');
                                            }}
                                            className={`${itemBase} ${itemHover} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                                        >
                                            <BookOpen size={18} className="text-violet-400 shrink-0"/>
                                            <span>Research Session</span>
                                        </button>
                                    ) : (
                                        <div
                                            className={`${itemBase} opacity-50 cursor-not-allowed ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                                            <BookOpen size={18} className="text-violet-400 shrink-0"/>
                                            <span>Research Session</span>
                                            <ProLockBadge size={16} className="ml-auto"/>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Notification bell ── */}
                    <div className="relative">
                        <button
                            data-analytics="toggle_notifications"
                            data-testid="nav-notifications"
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`relative p-1.5 sm:p-2 rounded-xl border transition-all ${btnBase} ${btnTheme}`}
                            aria-label="Notifications"
                        >
                            <Bell size={20}/>
                            {notificationUnreadCount > 0 && (
                                <NotificationBadge count={notificationUnreadCount}
                                                   className="absolute -top-0.5 -right-0.5"/>
                            )}
                        </button>
                        {showNotifications && (
                            <NotificationPanel
                                lightMode={lightMode}
                                onClose={() => setShowNotifications(false)}
                                onUnreadCountChange={setNotificationUnreadCount}
                            />
                        )}
                    </div>

                    {/* ── Chatbot button (mobile only) ── */}
                    <button
                        data-analytics="toggle_help_chat"
                        onClick={() => {
                            setHelpChatOpen(p => !p);
                            closeAll();
                        }}
                        aria-label={helpChatOpen ? 'Close help chat' : 'Open help chat'}
                        className={`sm:hidden ${btnBase} ${btnTheme} text-indigo-500`}
                    >
                        {helpChatOpen ? <X size={20}/> : <MessageCircle size={20}/>}
                    </button>

                    {/* ── Menu / Hamburger dropdown ── */}
                    <div className="relative">
                        <button
                            data-testid="nav-menu-dropdown"
                            onClick={() => toggleDropdown('menu')}
                            className={`${btnBase} ${btnTheme} flex items-center`}
                            aria-label="Menu"
                        >
                            <Menu size={20}/>
                        </button>
                        {openDropdown === 'menu' && (
                            <div className={`${dropdownBase} ${dropdownTheme} right-0`}>
                                <div className="p-2 flex flex-col gap-1">
                                    <button
                                        data-analytics="open_history"
                                        onClick={() => {
                                            closeAll();
                                            handleHistoryOpen();
                                        }}
                                        data-testid="nav-history"
                                        className={`${itemBase} ${itemHover} text-amber-500`}
                                    >
                                        <History size={18} className="shrink-0"/>
                                        <span>History</span>
                                    </button>
                                    <button
                                        data-analytics="open_knowledge_bases"
                                        onClick={() => {
                                            closeAll();
                                            navigate('/knowledge-bases');
                                        }}
                                        className={`${itemBase} ${itemHover} text-cyan-400`}
                                    >
                                        <Database size={18} className="shrink-0"/>
                                        <span>Knowledge Bases</span>
                                    </button>
                                    <button
                                        data-analytics="open_mcp_servers"
                                        onClick={() => {
                                            closeAll();
                                            navigate('/mcp-servers');
                                        }}
                                        className={`${itemBase} ${itemHover} text-purple-400`}
                                    >
                                        <Server size={18} className="shrink-0"/>
                                        <span>MCP Servers</span>
                                    </button>
                                    <button
                                        data-analytics="open_user_manual"
                                        onClick={() => {
                                            closeAll();
                                            navigate('/manual');
                                        }}
                                        className={`${itemBase} ${itemHover} text-violet-400`}
                                    >
                                        <HelpCircle size={18} className="shrink-0"/>
                                        <span>User Manual</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── User / Avatar dropdown ── */}
                    <div className="relative">
                        <button
                            data-testid="nav-user-dropdown"
                            onClick={() => toggleDropdown('user')}
                            className={`${btnBase} ${btnTheme} flex items-center`}
                            aria-label="User menu"
                        >
                            {user?.avatar && !avatarError
                                ? (
                                    <img
                                        src={user.avatar}
                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
                                        alt=""
                                        onError={() => setAvatarError(true)}
                                        referrerPolicy="no-referrer"
                                    />
                                )
                                : <UserCircle size={20} className="text-emerald-500"/>
                            }
                        </button>
                        {openDropdown === 'user' && (
                            <div className={`${dropdownBase} ${dropdownTheme} right-0`}>
                                {/* User info header */}
                                <div
                                    className={`px-4 py-3 border-b flex items-center gap-3 ${lightMode ? 'border-slate-200' : 'border-slate-800'}`}>
                                    {user?.avatar && !avatarError
                                        ? (
                                            <img
                                                src={user.avatar}
                                                className="w-8 h-8 rounded-full object-cover shrink-0"
                                                alt=""
                                                referrerPolicy="no-referrer"
                                            />
                                        )
                                        : <UserCircle size={32} className="text-slate-500 shrink-0"/>
                                    }
                                    <div className="min-w-0">
                                        <p className={`text-sm font-bold truncate ${lightMode ? 'text-slate-900' : 'text-white'}`}>
                                            @{user?.username}
                                        </p>
                                        {user?.isPro && <ProBadge className="mt-0.5"/>}
                                    </div>
                                </div>
                                <div className="p-2 flex flex-col gap-1">
                                    <button
                                        data-analytics="open_my_profile"
                                        onClick={() => {
                                            closeAll();
                                            refreshMemories();
                                            setIsContextModalOpen(true);
                                        }}
                                        data-testid="nav-profile"
                                        className={`${itemBase} ${itemHover} text-emerald-500`}
                                    >
                                        <UserCircle size={18} className="shrink-0"/>
                                        <span>My Profile</span>
                                    </button>
                                    <button
                                        data-testid="btn-toggle-theme"
                                        data-analytics="toggle_theme"
                                        onClick={() => {
                                            handleToggleLightMode();
                                        }}
                                        className={`${itemBase} ${itemHover} ${lightMode ? 'text-slate-600' : 'text-slate-400'}`}
                                    >
                                        {lightMode
                                            ? <Moon size={18} className="shrink-0"/>
                                            : <Sun size={18} className="shrink-0"/>
                                        }
                                        <span>{lightMode ? 'Dark Mode' : 'Light Mode'}</span>
                                    </button>
                                    <button
                                        data-analytics="logout"
                                        onClick={() => {
                                            closeAll();
                                            handleLogout();
                                        }}
                                        data-testid="nav-logout"
                                        className={`${itemBase} ${itemHover} text-red-400`}
                                    >
                                        <LogOut size={18} className="shrink-0"/>
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </header>

            {/* Executive Profile Modal */}
            {isContextModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print">
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg sm:max-w-2xl lg:max-w-5xl w-full max-h-[95vh] xl:max-h-[98vh] overflow-y-auto animate-slide-up shadow-2xl relative flex flex-col">
                        <button data-analytics="close_profile_modal" onClick={() => setIsContextModalOpen(false)}
                                className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white">
                            <X size={24}/></button>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 uppercase flex items-center gap-3">
                            <UserCircle size={24} className="text-emerald-400"/>
                            <span className="sm:hidden">My Profile</span>
                            <span className="hidden sm:inline">Executive Profile</span>
                        </h2>
                        {/* Avatar + Username inline */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className="flex-shrink-0">
                                {user?.avatar && !avatarError
                                    ? <img src={user.avatar} data-testid="profile-avatar"
                                           className="w-16 h-16 rounded-full object-cover" alt=""
                                           onError={() => setAvatarError(true)} referrerPolicy="no-referrer"/>
                                    : <UserCircle size={64} data-testid="profile-avatar" className="text-slate-500"/>
                                }
                            </div>
                            <div className="flex-1 pt-1">
                                <label
                                    className="block text-xs font-bold text-slate-400 uppercase mb-1">Username</label>
                                <div data-testid="profile-email"
                                     className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-slate-300 font-semibold">
                                    @{user?.username}
                                </div>
                            </div>
                        </div>
                        {/* First / Last name */}
                        <div className="flex gap-3 mb-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">First
                                    Name</label>
                                <input
                                    type="text"
                                    data-testid="input-first-name"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    dir="auto"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-semibold"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Last
                                    Name</label>
                                <input
                                    type="text"
                                    data-testid="input-last-name"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    dir="auto"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-semibold"
                                />
                            </div>
                        </div>
                        {/* Profile context */}
                        <textarea
                            data-testid="input-profile-context"
                            value={profileContext}
                            onChange={e => setProfileContext(e.target.value)}
                            placeholder="Describe your professional background, current role."
                            dir="auto"
                            className={`w-full bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white resize-none outline-none focus:border-blue-500 transition-all font-semibold ${memories.length === 0 ? 'h-64 sm:h-80 lg:h-96' : 'h-40 sm:h-52 lg:h-64'}`}
                        />
                        {/* Memories section */}
                        {isPro ? (
                            memories.length > 0 && (
                                <div className="mt-4 sm:mt-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Brain size={16} className="text-purple-400"/>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Remembered Context</span>
                                        <span className="text-xs text-slate-600">({memories.length})</span>
                                        <ProBadge className="ml-1"/>
                                    </div>
                                    <div className="flex flex-col gap-2 max-h-40 lg:max-h-64 overflow-y-auto pr-1">
                                        {memories.map(entry => (
                                            <div key={entry.id}
                                                 className="flex items-start gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 group">
                                                <p className="flex-1 text-xs text-slate-300 leading-relaxed">{entry.content}</p>
                                                <button
                                                    data-analytics="delete_memory"
                                                    onClick={async () => {
                                                        try {
                                                            await memoryAPI.delete(entry.id);
                                                            await refreshMemories();
                                                        } catch (e: any) {
                                                            console.error('Failed to delete memory', e);
                                                        }
                                                    }}
                                                    className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors mt-0.5"
                                                    title="Remove memory"
                                                >
                                                    <Trash2 size={13}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )) : (
                            <div
                                className="mt-4 sm:mt-6 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3">
                                <Brain size={16} className="text-purple-400 shrink-0 mt-0.5"/>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Remembered Context</span>
                                        <ProBadge/>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Pro users get AI-extracted memory entries from their sessions, giving the LLM a
                                        richer, personalised picture of their background over time.
                                    </p>
                                </div>
                            </div>
                        )}
                        {isPro && (
                            <div className="mt-3 sm:mt-4">
                                <button
                                    data-testid="btn-load-memories"
                                    data-analytics="load_memories_from_provider"
                                    onClick={() => setShowMemoryImportModal(true)}
                                    className="w-full border border-dashed border-slate-700 text-slate-400 py-2 sm:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:border-purple-500 hover:text-purple-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload size={14}/>
                                    Load Memories from Other Provider
                                </button>
                            </div>
                        )}
                        <button
                            data-testid="btn-save-profile"
                            data-analytics="save_profile"
                            onClick={async () => {
                                try {
                                    const updated = await authAPI.updateProfile(profileContext, firstName, lastName);
                                    setUser({
                                        ...user!,
                                        first_name: updated.first_name,
                                        last_name: updated.last_name,
                                        profileContext
                                    });
                                    setIsContextModalOpen(false);
                                } catch (e: any) {
                                    console.error('Failed to save profile', e);
                                }
                            }}
                            className="w-full mt-4 sm:mt-6 bg-blue-600 text-white py-3 sm:py-4 rounded-xl font-bold uppercase shadow-xl"
                        >
                            Save Profile
                        </button>
                    </div>
                </div>
            )}

            {/* Memory Import Modal */}
            {showMemoryImportModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print">
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg sm:max-w-2xl w-full max-h-[95vh] overflow-y-auto animate-slide-up shadow-2xl relative flex flex-col">
                        <button
                            data-testid="btn-close-memory-import"
                            data-analytics="close_memory_import_modal"
                            onClick={() => {
                                setShowMemoryImportModal(false);
                                setImportText('');
                            }}
                            className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white"
                        >
                            <X size={24}/>
                        </button>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 uppercase flex items-center gap-3">
                            <Upload size={24} className="text-purple-400"/>
                            Load Memories from Other Provider
                        </h2>
                        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                            Paste the exported memory text from your other AI assistant below. This will replace all
                            existing memory entries with the imported content, processed and deduplicated.
                        </p>
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Prompt to use
                                    in the other AI assistant</p>
                                <button
                                    data-testid="btn-copy-export-prompt"
                                    data-analytics="copy_memory_export_prompt"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(MEMORY_EXPORT_PROMPT);
                                        setExportPromptCopied(true);
                                        setTimeout(() => setExportPromptCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                                    style={{color: exportPromptCopied ? '#4ade80' : '#c084fc'}}
                                >
                                    {exportPromptCopied ? <Check size={14}/> : <Copy size={14}/>}
                                    {exportPromptCopied ? 'Copied!' : 'Copy prompt'}
                                </button>
                            </div>
                            <pre
                                className="max-h-[100px] w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {MEMORY_EXPORT_PROMPT}
              </pre>
                        </div>
                        <textarea
                            data-testid="input-memory-import-text"
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                            placeholder="Paste the exported memory text here..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 text-white resize-none outline-none focus:border-purple-500 transition-all font-semibold h-48 sm:h-64"
                            dir="auto"
                        />
                        <button
                            data-testid="btn-process-memory-import"
                            data-analytics="process_memory_import"
                            disabled={!importText.trim() || isImporting}
                            onClick={async () => {
                                if (!importText.trim()) return;
                                setIsImporting(true);
                                try {
                                    await memoryAPI.import(importText.trim());
                                    await refreshMemories();
                                    setShowMemoryImportModal(false);
                                    setImportText('');
                                } catch (e: any) {
                                    console.error('Failed to import memories', e);
                                    alert('Failed to import memories. Please try again.');
                                } finally {
                                    setIsImporting(false);
                                }
                            }}
                            className="w-full mt-4 sm:mt-6 bg-purple-600 text-white py-3 sm:py-4 rounded-xl font-bold uppercase shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isImporting ? (
                                <>
                                    <div
                                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload size={16}/>
                                    Process & Import
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* History side panel */}
            <HistoryView
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                savedSessions={savedSessions}
                currentSessionId={currentSessionId}
                onLoadSession={handleLoadSession}
                onDeleteSession={(id) => {
                    setSavedSessions(prev => prev.filter(x => x.id !== id));
                    if (id === currentSessionId) {
                        setIsHistoryModalOpen(false);
                        navigate('/');
                    }
                    storageService.deleteSession(id)
                        .then(() => refreshSavedSessions())
                        .catch(() => refreshSavedSessions());
                }}
                hasMoreSessions={hasMoreSessions}
                onLoadMore={loadMoreSessions}
                onUpdateSessionTitle={updateSessionTitle}
                onToggleFavorite={toggleFavoriteSession}
            />

            {/* Page content */}
            <main
                className="flex-grow flex flex-col items-center justify-start px-6 pt-6 relative overflow-y-auto no-scrollbar"
                style={{paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))'}}>
                <Outlet context={{user, handleLoadSession}}/>
            </main>

            {/* Help chatbot — always mounted to preserve chat state across SPA navigation */}
            <HelpChatBot isOpen={helpChatOpen} onToggle={() => setHelpChatOpen(p => !p)}/>
        </div>
    );
};

export default AppLayout;
