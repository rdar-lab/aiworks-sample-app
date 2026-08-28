import {useAuth} from '../contexts/AuthContext';

export type ProFeature =
    | 'rerun'
    | 'schedule'
    | 'pdf_report'
    | 'file_upload_unlimited'
    | 'knowledge_base'
    | 'mcp_server';

export function useProFeature(_feature?: ProFeature) {
    const {user} = useAuth();
    const isPro = user?.isPro === true;

    return {isPro, isLocked: !isPro};
}
