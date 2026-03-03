import React from 'react';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../lib/time';
import { getMoodColor } from '../../lib/moodColor';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { StardustEmoji } from '../../components/StardustEmoji';
import type { StardustCardData } from '../../types/stardust';

interface MessageItemProps {
    msg: any;
    activityMood: Record<string, string>;
    customMoodLabel: Record<string, string | undefined>;
    customMoodApplied: Record<string, boolean>;
    moodNote: Record<string, string>;
    getStardustByMessageId: (id: string) => any;
    onEditClick: (msg: any) => void;
    onInsertClick: (msg: any) => void;
    onDelete: (id: string) => void;
    onMoodPickerOpen: (msgId: string) => void;
    onStardustSelect: (data: StardustCardData, position: { x: number; y: number }) => void;
    onEndActivity: (id: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
    msg,
    activityMood,
    customMoodLabel,
    customMoodApplied,
    getStardustByMessageId,
    onEditClick,
    onInsertClick,
    onDelete,
    onMoodPickerOpen,
    onStardustSelect,
    onEndActivity,
}) => {
    const getMoodLabelForMsg = () => {
        return (customMoodApplied[msg.id] && customMoodLabel[msg.id] && customMoodLabel[msg.id] !== '自定义')
            ? customMoodLabel[msg.id]!
            : activityMood[msg.id];
    };

    const stardust = getStardustByMessageId(msg.id);
    const renderStardust = () => stardust ? (
        <div className="mt-1">
            <StardustEmoji
                emoji={stardust.emojiChar}
                size="sm"
                className={msg.isMood ? "scale-90" : undefined}
                onClick={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    onStardustSelect(
                        {
                            emojiChar: stardust.emojiChar,
                            message: stardust.message,
                            alienName: stardust.alienName || 'T.S',
                            createdAt: stardust.createdAt,
                        },
                        { x: rect.left + rect.width / 2, y: rect.top },
                    );
                }}
            />
        </div>
    ) : null;

    if (msg.isMood) {
        return (
            <div data-message-id={msg.id} className="group relative flex items-center justify-between bg-sky-200/70 p-2 rounded-lg transition-colors">
                <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <div className="flex flex-col">
                        <span className="font-mood text-sm text-gray-900" style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>{msg.content}</span>
                        {renderStardust()}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-gray-500">{format(msg.timestamp, 'HH:mm')}</div>
                </div>
                <div className="absolute right-2 top-2 hidden group-hover:flex space-x-1 bg-white/80 backdrop-blur-sm rounded p-1 shadow-sm border border-gray-100">
                    <button onClick={() => onDelete(msg.id)} className="p-1 text-gray-500 hover:text-red-600" title="删除"><Trash2 size={14} /></button>
                </div>
            </div>
        );
    }

    // Activity Record
    const label = getMoodLabelForMsg();
    return (
        <div data-message-id={msg.id} className="group relative flex items-start justify-between bg-white p-2 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
            <div className="flex items-start space-x-2 flex-1 min-w-0">
                <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={
                        label === '焦虑'
                            ? { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)' } as React.CSSProperties
                            : { backgroundColor: getMoodColor(label) || '#10B981' } as React.CSSProperties
                    }
                />
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-4 min-w-0">
                        <span
                            className="text-sm text-gray-900 truncate"
                            style={{ fontFamily: '"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","STSong",serif' }}
                        >
                            {msg.content}
                        </span>
                        <button
                            type="button"
                            onClick={() => onMoodPickerOpen(msg.id)}
                            className={cn(
                                'inline-flex items-center justify-center px-2.5 py-[3px] text-[10px] rounded-full whitespace-nowrap shadow-sm transition-colors',
                                customMoodLabel[msg.id] || activityMood[msg.id]
                                    ? 'text-slate-700'
                                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                            )}
                            style={
                                (() => {
                                    if (label === '焦虑') {
                                        return { background: 'repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,#9CA3AF 1px,#9CA3AF 2px,#6B7280 2px,#6B7280 3px)', border: 'none' } as React.CSSProperties;
                                    }
                                    const bg = label ? getMoodColor(label) : undefined;
                                    return bg ? { backgroundColor: bg, border: 'none' } as React.CSSProperties : {} as React.CSSProperties;
                                })()
                            }
                            title="调整心情标签"
                        >
                            <span style={{ fontFamily: 'Songti SC, SimSun, STSong, serif' }}>
                                {label || '待识别'}
                            </span>
                        </button>
                    </div>
                    {renderStardust()}
                </div>
            </div>
            <div className="text-right w-28 shrink-0 flex flex-col items-end -mt-0.5 relative">
                <div className="flex items-center gap-1">
                    {msg.duration === undefined && (
                        <button
                            onClick={() => onEndActivity(msg.id)}
                            className="text-[9px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 hover:bg-gray-50"
                        >
                            结束
                        </button>
                    )}
                    <div className="text-[10px] text-gray-500 whitespace-nowrap relative group/time cursor-pointer flex flex-col items-end">
                        <div>
                            {format(msg.timestamp, 'HH:mm')} - {msg.duration !== undefined
                                ? `${format(msg.timestamp + msg.duration * 60 * 1000, 'HH:mm')}`
                                : '进行中'}
                        </div>
                        {msg.duration !== undefined && (
                            <div className="mt-1">
                                <div
                                    className="inline-flex items-center justify-center rounded-full border border-sky-300 text-sky-700 bg-white/80 text-[9px] font-semibold shadow-sm px-2 py-0.5 text-center"
                                    style={{ minWidth: '9em' }}
                                >
                                    {formatDuration(msg.duration)}
                                </div>
                            </div>
                        )}
                        <div className="absolute -top-4 right-0 hidden group-hover/time:flex space-x-0.5 bg-white/90 backdrop-blur-sm rounded-full p-0.5 shadow-sm border border-gray-200">
                            <button onClick={() => onEditClick(msg)} className="p-0.5 text-gray-500 hover:text-blue-600" title="编辑"><Edit2 size={12} /></button>
                            <button onClick={() => onInsertClick(msg)} className="p-0.5 text-gray-500 hover:text-green-600" title="在此后插入"><Plus size={12} /></button>
                            <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-600" title="删除"><Trash2 size={12} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
