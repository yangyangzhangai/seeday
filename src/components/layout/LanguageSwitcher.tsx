import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { triggerLightHaptic } from '../../lib/haptics';
import { useAuthStore } from '../../store/useAuthStore';
import {
    APP_GREEN_GLASS_BG,
    APP_GREEN_GLASS_BORDER,
    APP_GREEN_GLASS_SHADOW,
    APP_GREEN_GLASS_TEXT,
} from '../../lib/modalTheme';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'it', label: 'Italiano' },
] as const;

interface Props {
    variant?: 'pill' | 'list';
}

export const LanguageSwitcher: React.FC<Props> = ({ variant = 'pill' }) => {
    const { i18n } = useTranslation();
    const updateLanguagePreference = useAuthStore(state => state.updateLanguagePreference);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const current = i18n.language?.split('-')[0] ?? 'en';
    const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];
    const selectedModeStyle: React.CSSProperties = {
        background: APP_GREEN_GLASS_BG,
        border: APP_GREEN_GLASS_BORDER,
        boxShadow: APP_GREEN_GLASS_SHADOW,
        color: APP_GREEN_GLASS_TEXT,
    };
    const triggerStyle: React.CSSProperties = {
        background: APP_GREEN_GLASS_BG,
        border: APP_GREEN_GLASS_BORDER,
        boxShadow: APP_GREEN_GLASS_SHADOW,
        color: APP_GREEN_GLASS_TEXT,
    };

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selectLanguage = async (code: string) => {
        triggerLightHaptic();
        await updateLanguagePreference(code);
        setIsOpen(false);
    };

    const isList = variant === 'list';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    triggerLightHaptic();
                    setIsOpen(!isOpen);
                }}
                className={isList ? 'flex items-center gap-1.5 text-xs text-slate-700 transition-all' : 'flex items-center space-x-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all'}
                style={isList ? undefined : triggerStyle}
            >
                <span className={isList ? 'text-xs text-slate-600' : 'text-xs font-semibold'}>{currentLang.label}</span>
                {isList ? (
                    <ChevronRight size={18} strokeWidth={2.5} className={`text-[#5F7A63] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                ) : (
                    <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-white/75 bg-[#F7F9F8] py-1 shadow-[0_10px_24px_rgba(148,163,184,0.16)] animate-in fade-in slide-in-from-top-2">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => { void selectLanguage(lang.code); }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 transition-colors border ${lang.code === current
                                    ? 'font-medium'
                                    : 'text-[#355643] hover:bg-white/60'
                                }`}
                            style={lang.code === current ? selectedModeStyle : { borderColor: 'transparent' }}
                        >
                            <span>{lang.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
