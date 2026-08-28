
// Add missing User interface
export interface MemoryEntry {
  id: number;
  content: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar?: string;
  provider: string;
  tier: string;
  isPro?: boolean;
  profileContext?: string;
  lightMode?: boolean;
}

export type ViewState = 'landing' | 'input' | 'loading';


export interface StepTask {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export type ResumeState = 'complete' | 'has_worker_task' | 'created';

export interface MCPServer {
  id: number;
  name: string;
  url: string;
  headers: Record<string, string>;
  auth_type: 'none' | 'basic' | 'bearer' | 'oauth';
  has_credentials: boolean;
  predefined_server_id: number | null;
  server_type: 'http' | 'openapi';
  openapi_spec_url: string;
  openapi_spec: string;
  oauth_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PredefinedMCPServer {
  id: number;
  name: string;
  url: string;
  auth_type: 'none' | 'basic' | 'bearer' | 'oauth';
  headers: Record<string, string>;
  server_type: 'http' | 'openapi';
  openapi_spec_url: string;
  openapi_spec: string;
  created_at: string;
  updated_at: string;
}

export interface MCPServerSummary {
  id: number;
  name: string;
  url: string;
}

export interface KnowledgeBaseFile {
  id: number;
  name: string;
  created_at: string;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  filesCount: number;
  files: KnowledgeBaseFile[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseSummary {
  id: number;
  name: string;
}

export interface AttachedFileItem {
  id: number;
  name: string;
  content: string;
  fileType: 'input' | 'output';
}

export interface SavedSession {
  id: string;
  dilemma: string;
  sessionTitle?: string;
  includeUserContext?: boolean;
  agentResult?: string;
  attachedFiles?: AttachedFileItem[];
  timestamp: number;
  resumeState: ResumeState;
  isPublic?: boolean;
  isOwner?: boolean;
  sessionType?: 'research' | null;
  knowledgeBases?: KnowledgeBaseSummary[];
  mcpServers?: MCPServerSummary[];
  isFavorite?: boolean;
  labels?: string[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  ctaAction: string;
  ctaParams: Record<string, unknown>;
  status: 'sent' | 'read' | 'dismissed' | 'expired';
  readAt: string | null;
  dismissedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];
  meta: {
    unreadCount: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SessionSnapshot {
  id: string;
  label: string;
  createdAt: string;
}

export interface TunnelServerSummary {
  id: string;
  name: string;
  tunnelId?: string;
}