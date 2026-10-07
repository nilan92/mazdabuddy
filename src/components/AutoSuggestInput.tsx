import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Clock, X, ChevronRight } from 'lucide-react';

export interface SuggestionItem {
    title: string;
    subtitle?: string;
    badge?: string;
    badgeColor?: string;
    count?: number;
    raw: any;
}

interface AutoSuggestInputProps {
    value: string;
    onChange: (val: string) => void;
    onSelect: (item: any) => void;
    suggestions: SuggestionItem[];
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    required?: boolean;
    autoFocus?: boolean;
    icon?: React.ReactNode;
    onDelete?: (rawItem: any) => void;
    headerLabel?: string;
}

export const AutoSuggestInput: React.FC<AutoSuggestInputProps> = ({
    value,
    onChange,
    onSelect,
    suggestions,
    placeholder = '',
    className = '',
    inputClassName = '',
    required = false,
    autoFocus = false,
    icon,
    onDelete,
    headerLabel = 'Suggestions from memory'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset highlight when suggestions change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [suggestions]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) {
            if (e.key === 'ArrowDown') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                e.preventDefault();
                handleSelectItem(suggestions[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
    };

    const handleSelectItem = (item: SuggestionItem) => {
        onSelect(item.raw);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    // Highlight matched query parts
    const renderHighlightedTitle = (title: string, query: string) => {
        const q = (query || '').trim();
        if (!q) return <span>{title}</span>;

        const lowerTitle = title.toLowerCase();
        const lowerQ = q.toLowerCase();
        const matchIndex = lowerTitle.indexOf(lowerQ);

        if (matchIndex === -1) return <span>{title}</span>;

        const before = title.slice(0, matchIndex);
        const match = title.slice(matchIndex, matchIndex + q.length);
        const after = title.slice(matchIndex + q.length);

        return (
            <span>
                {before}
                <span className="text-cyan-400 font-bold underline underline-offset-2">{match}</span>
                {after}
            </span>
        );
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative flex items-center">
                {icon && (
                    <div className="absolute left-3 pointer-events-none text-slate-400">
                        {icon}
                    </div>
                )}
                <input
                    ref={inputRef}
                    type="text"
                    required={required}
                    autoFocus={autoFocus}
                    value={value}
                    placeholder={placeholder}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    className={`w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all ${
                        icon ? 'pl-9' : ''
                    } ${inputClassName}`}
                />
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div 
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 overflow-hidden divide-y divide-slate-800/60 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <div className="px-3 py-1.5 bg-slate-950/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <Sparkles size={11} />
                            {headerLabel}
                        </span>
                        <span className="text-slate-500 text-[9px] lowercase font-normal">
                            Tab / Enter to select
                        </span>
                    </div>

                    <div className="py-1">
                        {suggestions.map((item, index) => {
                            const isHighlighted = index === highlightedIndex;
                            return (
                                <div
                                    key={`${item.title}-${index}`}
                                    onMouseDown={(e) => {
                                        // Prevent input blur before click registers
                                        e.preventDefault();
                                        handleSelectItem(item);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors ${
                                        isHighlighted 
                                            ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-400 pl-2.5' 
                                            : 'text-slate-200 hover:bg-slate-800/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Clock size={12} className={`shrink-0 ${isHighlighted ? 'text-cyan-400' : 'text-slate-500'}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium truncate text-white">
                                                {renderHighlightedTitle(item.title, value)}
                                            </div>
                                            {item.subtitle && (
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {item.subtitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {item.badge && (
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                                                item.badgeColor || 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50'
                                            }`}>
                                                {item.badge}
                                            </span>
                                        )}
                                        {item.count && item.count > 1 && (
                                            <span className="text-[9px] text-slate-500 font-mono hidden sm:inline" title={`Used ${item.count} times`}>
                                                ×{item.count}
                                            </span>
                                        )}
                                        {onDelete && (
                                            <button
                                                type="button"
                                                title="Forget this suggestion"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    onDelete(item.raw);
                                                }}
                                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                            >
                                                <X size={11} />
                                            </button>
                                        )}
                                        <ChevronRight size={12} className={`transition-transform ${isHighlighted ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
