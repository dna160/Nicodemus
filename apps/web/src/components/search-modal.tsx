'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Users, BookOpen, GraduationCap,
  Layers, User, ArrowRight, Command,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'all' | 'user' | 'class' | 'curriculum' | 'subject';

interface SearchResult {
  id: string;
  category: 'user' | 'class' | 'curriculum' | 'subject';
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  navigateTo?: string;
  navigateQuery?: string;
}

interface GroupedResults {
  users:      SearchResult[];
  classes:    SearchResult[];
  curriculum: SearchResult[];
  subjects:   SearchResult[];
}

interface SearchModalProps {
  open:        boolean;
  onClose:     () => void;
  userId:      string | null;
  userRole:    'teacher' | 'student' | 'admin';
  onNavigate?: (tab: string, query?: string) => void;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  user:       { label: 'Users',      prefix: 'user:',       icon: <User size={13} />,          color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  class:      { label: 'Classes',    prefix: 'class:',      icon: <Layers size={13} />,         color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  curriculum: { label: 'Curriculum', prefix: 'curriculum:', icon: <GraduationCap size={13} />,  color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30' },
  subject:    { label: 'Subject',    prefix: 'subject:',    icon: <BookOpen size={13} />,       color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/30' },
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  users:      <User size={13} />,
  classes:    <Layers size={13} />,
  curriculum: <GraduationCap size={13} />,
  subjects:   <BookOpen size={13} />,
};

const SECTION_LABELS: Record<string, string> = {
  users:      'Users',
  classes:    'Classes',
  curriculum: 'Curriculum',
  subjects:   'Subjects',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect "prefix: query" and extract both parts. */
function parseInput(raw: string): { category: Category; query: string } {
  const lower = raw.toLowerCase();
  if (lower.startsWith('user:'))       return { category: 'user',       query: raw.slice(5).trim() };
  if (lower.startsWith('class:'))      return { category: 'class',      query: raw.slice(6).trim() };
  if (lower.startsWith('curriculum:')) return { category: 'curriculum', query: raw.slice(11).trim() };
  if (lower.startsWith('subject:'))    return { category: 'subject',    query: raw.slice(8).trim() };
  return { category: 'all', query: raw.trim() };
}

function totalResults(g: GroupedResults) {
  return g.users.length + g.classes.length + g.curriculum.length + g.subjects.length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchModal({ open, onClose, userId, userRole, onNavigate }: SearchModalProps) {
  const [inputValue, setInputValue]     = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [results, setResults]           = useState<GroupedResults>({ users: [], classes: [], curriculum: [], subjects: [] });
  const [loading, setLoading]           = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flat list for keyboard nav ─────────────────────────────────────────────
  const flatResults: SearchResult[] = [
    ...results.users,
    ...results.classes,
    ...results.curriculum,
    ...results.subjects,
  ];

  // ── Available categories per role ──────────────────────────────────────────
  const availableCategories: Category[] = [
    'all',
    'user',
    'class',
    ...(userRole === 'teacher' ? ['curriculum' as Category] : []),
    ...(userRole === 'student' ? ['subject'    as Category] : []),
  ];

  // ── Open / close ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputValue('');
      setResults({ users: [], classes: [], curriculum: [], subjects: [] });
      setSelectedIndex(-1);
      setActiveCategory('all');
    }
  }, [open]);

  // ── Global Cmd+K / Ctrl+K shortcut ────────────────────────────────────────
  // (handled in the parent — this component just responds to `open`)

  // ── Esc to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Fetch with debounce ────────────────────────────────────────────────────
  const fetchResults = useCallback(
    async (rawInput: string, cat: Category) => {
      const { query } = parseInput(rawInput);
      const effectiveQ = query || rawInput.trim();

      if (!effectiveQ || effectiveQ.length < 1 || !userId || userId === 'demo') {
        setResults({ users: [], classes: [], curriculum: [], subjects: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q:        effectiveQ,
          role:     userRole,
          userId:   userId,
          category: cat,
        });
        const res  = await fetch(`/api/search?${params}`);
        const data = await res.json();
        if (data.success) setResults(data.results);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setSelectedIndex(-1);
      }
    },
    [userId, userRole]
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSelectedIndex(-1);

    // Auto-detect category from prefix
    const { category } = parseInput(value);
    if (category !== 'all') setActiveCategory(category);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchResults(value, category !== 'all' ? category : activeCategory);
    }, 280);
  };

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchResults(inputValue, cat);
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!flatResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleResultClick(flatResults[selectedIndex]);
    }
  };

  // ── Click result ───────────────────────────────────────────────────────────
  const handleResultClick = (result: SearchResult) => {
    if (result.navigateTo && onNavigate) {
      onNavigate(result.navigateTo, result.navigateQuery);
    }
    onClose();
  };

  // ── Category chip quick-fill ───────────────────────────────────────────────
  const handleChipClick = (cat: Category) => {
    if (cat === 'all') {
      setInputValue('');
      handleCategoryChange('all');
      inputRef.current?.focus();
      return;
    }
    const cfg    = CATEGORY_CONFIG[cat];
    const prefix = cfg.prefix + ' ';
    setInputValue(prefix);
    setActiveCategory(cat);
    fetchResults(prefix, cat);
    inputRef.current?.focus();
  };

  if (!open) return null;

  const hasResults    = totalResults(results) > 0;
  const { query }     = parseInput(inputValue);
  const effectiveQ    = query || inputValue.trim();
  const showEmpty     = !loading && effectiveQ.length > 0 && !hasResults;
  const isDemoMode    = !userId || userId === 'demo';

  // Compute flat index offset per section for keyboard-nav highlight
  let offset = 0;
  const sectionOffset: Record<string, number> = {};
  for (const key of ['users', 'classes', 'curriculum', 'subjects']) {
    sectionOffset[key] = offset;
    offset += (results[key as keyof GroupedResults]?.length ?? 0);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />

      {/* Modal card */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">

        {/* ── Input row ── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <Search size={17} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              userRole === 'teacher'
                ? 'user:  class:  curriculum:  or type anything...'
                : userRole === 'student'
                ? 'user:  class:  subject:  or type anything...'
                : 'user:  class:  or type anything...'
            }
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); setResults({ users: [], classes: [], curriculum: [], subjects: [] }); inputRef.current?.focus(); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md font-mono">
            Esc
          </kbd>
        </div>

        {/* ── Category chips ── */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 overflow-x-auto scrollbar-none">
          {availableCategories.map((cat) => {
            const isActive = activeCategory === cat;
            const cfg = cat !== 'all' ? CATEGORY_CONFIG[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => handleChipClick(cat)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {cfg ? <span className={isActive ? '' : cfg.color}>{cfg.icon}</span> : null}
                {cat === 'all' ? 'All' : cfg!.label}
                {cat !== 'all' && (
                  <span className={`font-mono text-[9px] opacity-60 ml-0.5`}>
                    {cfg!.prefix}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Results / states ── */}
        <div className="max-h-[420px] overflow-y-auto overscroll-contain">

          {/* Demo mode */}
          {isDemoMode && (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <Search size={22} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Demo mode</p>
              <p className="text-xs text-gray-400 mt-1">Search is available with a live account.</p>
            </div>
          )}

          {/* Loading skeleton */}
          {!isDemoMode && loading && (
            <div className="px-4 py-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/5" />
                    <div className="h-2.5 bg-gray-50 dark:bg-gray-800/60 rounded w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {!isDemoMode && showEmpty && (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <Search size={22} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                No results for <span className="font-semibold">"{effectiveQ}"</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Try a different search or category.</p>
            </div>
          )}

          {/* Empty input hint */}
          {!isDemoMode && !loading && !effectiveQ && (
            <div className="px-4 py-5">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Quick tips</p>
              <div className="space-y-2">
                {availableCategories.filter((c) => c !== 'all').map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => handleChipClick(cat)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{cfg.label}</p>
                        <p className="text-[11px] text-gray-400">
                          Type <span className="font-mono text-gray-600 dark:text-gray-300">{cfg.prefix}</span> then your query
                        </p>
                      </div>
                      <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results grouped by section */}
          {!isDemoMode && !loading && hasResults && (
            <div className="pb-2">
              {(
                [
                  ['users',      results.users],
                  ['classes',    results.classes],
                  ['curriculum', results.curriculum],
                  ['subjects',   results.subjects],
                ] as [string, SearchResult[]][]
              )
                .filter(([, items]) => items.length > 0)
                .map(([section, items]) => {
                  const catKey   = section === 'users' ? 'user' : section === 'classes' ? 'class' : section === 'curriculum' ? 'curriculum' : 'subject';
                  const cfg      = CATEGORY_CONFIG[catKey as keyof typeof CATEGORY_CONFIG];
                  const secLabel = SECTION_LABELS[section];
                  const secIcon  = SECTION_ICONS[section];
                  const startIdx = sectionOffset[section];

                  return (
                    <div key={section}>
                      {/* Section header */}
                      <div className={`flex items-center gap-1.5 px-4 py-2 mt-1`}>
                        <span className={`${cfg.color}`}>{secIcon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {secLabel}
                        </span>
                      </div>

                      {/* Items */}
                      {items.map((result, idx) => {
                        const globalIdx = startIdx + idx;
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            }`}
                          >
                            {/* Icon */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                {result.title}
                              </p>
                              {result.subtitle && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-px">
                                  {result.subtitle}
                                </p>
                              )}
                            </div>

                            {/* Right side */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {result.meta && (
                                <span className="text-[10px] text-gray-400">{result.meta}</span>
                              )}
                              {result.badge && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                                  {result.badge}
                                </span>
                              )}
                              {result.navigateTo && isSelected && (
                                <ArrowRight size={12} className="text-indigo-400" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">↵</kbd> select</span>
            <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Esc</kbd> close</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600">
            <Command size={9} />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
