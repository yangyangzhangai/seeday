import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { triggerLightHaptic } from '../../lib/haptics';

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
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const current = i18n.language?.split('-')[0] ?? 'en';
    const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];
    const selectedModeStyle: React.CSSProperties = {
        background:
            'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
        border: '0.5px solid transparent',
        boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
        color: '#426D56',
    };
    const triggerStyle: React.CSSProperties = {
        background:
            'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
        border: '0.5px solid transparent',
        boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
        color: '#426D56',
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

    const selectLanguage = (code: string) => {
        triggerLightHaptic();
        i18n.changeLanguage(code);
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
                className={isList ? 'flex items-center gap-1 text-xs text-slate-700 transition-all' : 'flex items-center space-x-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-all'}
                style={isList ? undefined : triggerStyle}
            >
                <span className={isList ? 'text-xs text-slate-600' : 'text-xs font-semibold'}>{currentLang.label}</span>
                {isList ? (
                    <ChevronRight size={14} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                ) : (
                    <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-white/75 bg-[#F7F9F8] py-1 shadow-[0_10px_24px_rgba(148,163,184,0.16)] animate-in fade-in slide-in-from-top-2">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => selectLanguage(lang.code)}
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
