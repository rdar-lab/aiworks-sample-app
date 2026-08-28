import React, {useEffect} from 'react';
import {Loader2} from 'lucide-react';
import {BrowserRouter, Navigate, Route, Routes, useLocation} from 'react-router-dom';
import {GoogleOAuthProvider} from '@react-oauth/google';
import {AuthProvider, useAuth} from './contexts/AuthContext';
import {UIProvider, useUI} from './contexts/UIContext';
import {ServerSettingsProvider, useServerSettings} from './contexts/ServerSettingsContext';
import {GlobalProvider} from './contexts/GlobalContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EulaPage from './pages/EulaPage';
import PrivacyPage from './pages/PrivacyPage';
import UserManualPage from './pages/UserManualPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import MCPServersPage from './pages/MCPServersPage';
import NewResearchPage from './pages/NewResearchPage';
import ResearchReportPage from './pages/ResearchReportPage';
import MCPOAuthCallbackPage from './pages/MCPOAuthCallbackPage';

// Wraps the app tree in GoogleOAuthProvider using the client ID fetched from the
// server (via ServerSettingsContext).  Must be rendered inside ServerSettingsProvider.
const GoogleOAuthWrapper: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const {googleClientId, settingsLoaded} = useServerSettings();

    if (!settingsLoaded) return (
        <div className="fixed inset-0 bg-[#020617] flex items-center justify-center">
            <Loader2 size={48} className="text-blue-500 animate-spin"/>
        </div>
    );
    if (!googleClientId) return <>{children}</>;
    return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
};

// Syncs the user's saved lightMode preference into UIContext as soon as it is
// available — regardless of which page is currently active.  Placing this
// inside both AuthProvider and UIProvider gives it access to both contexts
// without creating a circular dependency.
const ThemeSync: React.FC = () => {
    const {user} = useAuth();
    const {setLightMode} = useUI();

    useEffect(() => {
        if (user?.lightMode !== undefined) {
            setLightMode(user.lightMode);
        }
    }, [user?.lightMode, setLightMode]);

    return null;
};


// Forces NewResearchPage to fully remount on every navigation to /research/new.
const KeyedNewResearchPage: React.FC = () => {
    const {key} = useLocation();
    return <NewResearchPage key={key}/>;
};

const App: React.FC = () => {
    return (
        <ServerSettingsProvider>
            <GoogleOAuthWrapper>
                <BrowserRouter basename="/app/">
                    <AuthProvider>
                        <UIProvider>
                            <ThemeSync/>
                            <GlobalProvider>
                                <Routes>
                                    {/* Public: login / register */}
                                    <Route path="/login" element={<LoginPage/>}/>

                                    {/* Public: legal documents */}
                                    <Route path="/eula" element={<EulaPage/>}/>
                                    <Route path="/privacy" element={<PrivacyPage/>}/>
                                    <Route path="/manual" element={<UserManualPage/>}/>

                                    {/* Public: MCP OAuth callback (opened in a popup by MCPServersPage) */}
                                    <Route path="/mcp-oauth-callback" element={<MCPOAuthCallbackPage/>}/>

                                    {/* Protected: all app views share the AppLayout template */}
                                    <Route element={<ProtectedRoute/>}>
                                        <Route element={<AppLayout/>}>
                                            <Route path="/" element={<DashboardPage/>}/>
                                            <Route path="/research/new" element={<KeyedNewResearchPage/>}/>
                                            <Route path="/research/:id" element={<ResearchReportPage/>}/>
                                            <Route path="/knowledge-bases" element={<KnowledgeBasePage/>}/>
                                            <Route path="/mcp-servers" element={<MCPServersPage/>}/>
                                        </Route>
                                    </Route>

                                    {/* Catch-all — redirect to home */}
                                    <Route path="*" element={<Navigate to="/" replace/>}/>
                                </Routes>
                            </GlobalProvider>
                        </UIProvider>
                    </AuthProvider>
                </BrowserRouter>
            </GoogleOAuthWrapper>
        </ServerSettingsProvider>
    );
};

export default App;
