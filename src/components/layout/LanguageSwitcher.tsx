import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import {
    APP_SELECTED_GLOW_BG,
    APP_SELECTED_GLOW_BORDER,
    APP_SELECTED_GLOW_SHADOW,
    APP_SELECTED_GLOW_TEXT,
} from '../../lib/modalTheme';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
] as const;

export const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const current = i18n.language?.split('-')[0] ?? 'en';
    const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];
    const selectedGlowStyle: React.CSSProperties = {
        background: APP_SELECTED_GLOW_BG,
        border: APP_SELECTED_GLOW_BORDER,
        boxShadow: APP_SELECTED_GLOW_SHADOW,
        color: APP_SELECTED_GLOW_TEXT,
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
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
            >
                <span className="text-xs font-semibold">{currentLang.flag} {currentLang.label}</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => selectLanguage(lang.code)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 transition-colors border ${lang.code === current
                                    ? 'font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            style={lang.code === current ? selectedGlowStyle : { borderColor: 'transparent' }}
                        >
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
