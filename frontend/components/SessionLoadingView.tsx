import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { StepTask } from '../types';

interface SessionLoadingViewProps {
  /** Icon shown in the pulsing badge (e.g. <Building2 /> or <BookOpen />). */
  icon: React.ReactNode;
  /** Current progress step label. */
  loadingStep: string;
  stepTasks: StepTask[];
  /**
   * Current agent thinking/thought (streamed from the executor).
   * Shown as a muted subtitle below the step list.
   */
  thinking?: string;
  /**
   * Last tool call made by the agent (tool name + input summary).
   * Shown as a muted line below thinking.
   */
  lastToolCall?: { tool: string; input: string } | null;
  /**
   * When provided, shown as a hint paragraph below the task list.
   * Typically set while the background worker is actively running so the
   * user knows they can close the page and receive an email notification.
   */
  runningMessage?: string;
  lightMode: boolean;
  sessionType?: string;
}

const SessionLoadingView: React.FC<SessionLoadingViewProps> = ({
  icon,
  loadingStep,
  stepTasks,
  thinking,
  lastToolCall,
  runningMessage,
  lightMode,
}) => (
  <div className="my-auto text-center space-y-8 sm:space-y-12 animate-pulse py-10 sm:py-20 px-4">
    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blue-600/10 rounded-[2rem] sm:rounded-[3rem] flex items-center justify-center mx-auto border border-blue-500/30 shadow-2xl">
      {icon}
    </div>
    <h3 className={`text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight max-w-3xl mx-auto leading-tight transition-colors ${lightMode ? 'text-slate-900' : 'text-white'}`}>
      {loadingStep}
    </h3>
    {stepTasks.length > 0 && (
      <ul className="text-left max-w-xl mx-auto space-y-2 animate-none">
        {stepTasks.map((task, i) => (
          <li key={i} className="flex items-start gap-3">
            {task.status === 'completed' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
            ) : task.status === 'in_progress' ? (
              <Loader2 size={18} className="mt-0.5 shrink-0 text-blue-400 animate-spin" />
            ) : (
              <Circle size={18} className={`mt-0.5 shrink-0 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`} />
            )}
            <span className={`text-sm leading-snug ${
              task.status === 'completed'
                ? lightMode ? 'line-through text-slate-400' : 'line-through text-slate-500'
                : task.status === 'in_progress'
                ? lightMode ? 'font-semibold text-slate-800' : 'font-semibold text-slate-200'
                : lightMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {task.content}
            </span>
          </li>
        ))}
      </ul>
    )}
    {(thinking || lastToolCall) && (
      <div className="max-w-lg mx-auto space-y-2">
        {thinking && (
          <div className={`rounded-lg px-3 py-2 ${lightMode ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800/50 border border-slate-700/50'}`}>
            <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${lightMode ? 'text-blue-600' : 'text-blue-400'}`}>
              Agent Thinking
            </div>
            <p className={`text-xs leading-relaxed line-clamp-3 ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>
              {thinking.length > 200 ? thinking.slice(0, 200) + '…' : thinking}
            </p>
          </div>
        )}
        {lastToolCall && lastToolCall.tool && (
          <div className={`rounded-lg px-3 py-2 ${lightMode ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800/50 border border-slate-700/50'}`}>
            <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${lightMode ? 'text-emerald-600' : 'text-emerald-400'}`}>
              Last Action
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${lightMode ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/50 text-blue-300'}`}>
                {lastToolCall.tool}
              </span>
              {lastToolCall.input && (
                <span className={`text-[10px] leading-relaxed truncate max-w-[180px] ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {lastToolCall.input.length > 100 ? lastToolCall.input.slice(0, 100) + '…' : lastToolCall.input}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )}
    {runningMessage && (
      <p className={`text-sm max-w-xl mx-auto leading-relaxed ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {runningMessage}
      </p>
    )}
  </div>
);

export default SessionLoadingView;
