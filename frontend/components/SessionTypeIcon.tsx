import React from 'react';
import {BookOpen} from 'lucide-react';

type SessionType =
    'research'
    | null;

interface SessionTypeIconProps {
    sessionType: SessionType;
    size?: number;
    className?: string;
}

export const SessionTypeIcon: React.FC<SessionTypeIconProps> = ({sessionType, size = 20, className = ''}) => {
    if (sessionType === 'research') {
        return <BookOpen size={size} className={className}/>;
    }


    return null;
};

export default SessionTypeIcon;