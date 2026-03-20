'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ParsedCurriculum } from '@/lib/curriculum-parser';
import { HomeworkReviewModal } from './homework-review-modal';
import {
  BookOpen, Video, Lightbulb, ClipboardList, Image as ImageIcon,
  ChevronDown, ChevronRight, ExternalLink, Sparkles, Loader2,
  GraduationCap, FlaskConical, Clock, Users,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CurriculumDetailProps {
  curriculumId: string;
  onBack: () => void;
  onGenerateVariant?: (style: string) => void;
  onDuplicate?: () => void;
  generatingVariant?: boolean;
  teacherId?: string;
}

interface CurriculumData {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  gradingSystem?: string;
  createdAt: string;
  parsed?: ParsedCurriculum;
  rawContent?: any;
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  due_at?: string;
  points_possible?: number;
  published_at?: string;
  content?: { questions: Array<{ id: string; prompt: string; type: string; points: number }> };
  rubric?: { criteria: Array<{ name: string; points: number; description: string }>; total_points: number };
}

// Teaching materials types (mirrors API)
interface AcademicReference {
  title: string; authors: string; source: string; year: string;
  url?: string; relevance?: string; description?: string;
  type: 'journal' | 'book' | 'standards' | 'website' | 'textbook' | 'guide';
  audience?: 'teacher' | 'student' | 'both';
}
interface VideoSource {
  title: string; channel: string; url: string; duration: string;
  ageRange: string; description: string;
  platform: 'YouTube' | 'Khan Academy' | 'PBS Learning Media' | 'National Geographic' | 'TED-Ed' | 'Other';
}
interface TeachingTip { tip: string; rationale: string; timing: 'before' | 'during' | 'after'; }
interface ActivityGuide {
  activityName: string; objective: string; materials: string[];
  steps: string[]; differentation: string; estimatedTime: string;
}
interface VisualAid { type: string; name: string; description: string; howToCreate: string; }
interface TeachingMaterials {
  dayLabel: string; dayTitle: string; generatedAt: string;
  academicReferences: AcademicReference[]; videoSources: VideoSource[];
  teachingTips: TeachingTip[]; activityGuides: ActivityGuide[]; visualAids: VisualAid[];
}

// ─── Colour helpers ──────────────────────────────────────────────────────────────

const TIMING_COLORS: Record<string, string> = {
  before: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  during: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  after:  'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
};
const PLATFORM_COLORS: Record<string, string> = {
  'YouTube':            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'Khan Academy':       'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'PBS Learning Media': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'National Geographic':'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  'TED-Ed':             'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  'Other':              'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
};
const REF_TYPE_COLORS: Record<string, string> = {
  journal:   'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  book:      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  textbook:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  standards: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  guide:     'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  website:   'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
};

// ─── Sub-components ──────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count, expanded, onToggle }: {
  icon: React.ReactNode; title: string; count?: number | string;
  expanded: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          {icon} {title}
        </h2>
        {count !== undefined && (
          <span className="text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <span className="text-neutral-400">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
    </button>
  );
}

/** Curriculum-level reference materials panel */
function CurriculumReferencesPanel({ references, loading, onGenerate }: {
  references: AcademicReference[] | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="px-6 py-4 space-y-4">
      {!references && !loading && (
        <div className="flex flex-col items-center py-6 gap-3">
          <BookOpen size={32} className="text-neutral-300" />
          <p className="text-sm text-neutral-500 text-center max-w-xs">
            Generate curated reference materials — textbooks, standards documents, and teacher guides — for this curriculum.
          </p>
          <button
            onClick={onGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Sparkles size={14} /> Generate Reference Materials
          </button>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-3 py-6 justify-center text-neutral-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Claude is finding the best references…</span>
        </div>
      )}
      {references && references.length > 0 && (
        <div className="space-y-3">
          {references.map((ref, i) => (
            <div key={i} className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${REF_TYPE_COLORS[ref.type] || REF_TYPE_COLORS.website}`}>
                      {ref.type}
                    </span>
                    {ref.audience && ref.audience !== 'both' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {ref.audience}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">{ref.year}</span>
                  </div>
                  <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">{ref.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{ref.authors} · {ref.source}</p>
                  {(ref.description || ref.relevance) && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                      {ref.description || ref.relevance}
                    </p>
                  )}
                </div>
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-indigo-600 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={onGenerate}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2"
          >
            ↺ Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

/** Teaching materials panel — shown per day */
function DayTeachingMaterials({ materials, loading, onGenerate, dayLabel }: {
  materials: TeachingMaterials | null;
  loading: boolean;
  onGenerate: () => void;
  dayLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<'refs' | 'videos' | 'tips' | 'activities' | 'visuals'>('refs');
  const tabs = [
    { id: 'refs' as const,       label: 'References',  icon: <BookOpen size={12} />,      count: materials?.academicReferences.length },
    { id: 'videos' as const,     label: 'Videos',      icon: <Video size={12} />,          count: materials?.videoSources.length },
    { id: 'tips' as const,       label: 'Tips',        icon: <Lightbulb size={12} />,      count: materials?.teachingTips.length },
    { id: 'activities' as const, label: 'Guides',      icon: <ClipboardList size={12} />,  count: materials?.activityGuides.length },
    { id: 'visuals' as const,    label: 'Visual Aids', icon: <ImageIcon size={12} />,      count: materials?.visualAids.length },
  ];

  if (!materials && !loading) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Sparkles size={12} /> Generate Teaching Materials
        </button>
        <span className="text-[11px] text-neutral-400">AI-powered references, videos & activity guides</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-violet-600 text-xs">
        <Loader2 size={13} className="animate-spin" />
        <span>Claude is generating materials for {dayLabel}…</span>
      </div>
    );
  }

  if (!materials) return null;

  return (
    <div className="mt-4 border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden bg-violet-50/40 dark:bg-violet-900/10">
      {/* Tab bar */}
      <div className="flex border-b border-violet-200 dark:border-violet-800 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-violet-600 text-violet-700 dark:text-violet-300 bg-white dark:bg-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 bg-violet-100 dark:bg-violet-800 text-violet-600 dark:text-violet-300 rounded-full text-[9px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={onGenerate}
          className="ml-auto px-3 py-2.5 text-[10px] text-neutral-400 hover:text-violet-600 transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          <Sparkles size={10} /> Regenerate
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">

        {/* Academic References */}
        {activeTab === 'refs' && (
          <div className="space-y-3">
            {materials.academicReferences.length === 0 && <p className="text-xs text-neutral-400 italic">No references generated.</p>}
            {materials.academicReferences.map((ref, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <GraduationCap size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${REF_TYPE_COLORS[ref.type] || REF_TYPE_COLORS.website}`}>{ref.type}</span>
                    <span className="text-[10px] text-neutral-400">{ref.year}</span>
                  </div>
                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{ref.title}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{ref.authors} · {ref.source}</p>
                  {ref.relevance && <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{ref.relevance}</p>}
                </div>
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-neutral-400 hover:text-indigo-600 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Video Sources */}
        {activeTab === 'videos' && (
          <div className="space-y-3">
            {materials.videoSources.length === 0 && <p className="text-xs text-neutral-400 italic">No videos generated.</p>}
            {materials.videoSources.map((v, i) => (
              <div key={i} className="flex gap-3 p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <Video size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PLATFORM_COLORS[v.platform] || PLATFORM_COLORS.Other}`}>{v.platform}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-neutral-400"><Clock size={9} />{v.duration}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-neutral-400"><Users size={9} />{v.ageRange}</span>
                  </div>
                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{v.title}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{v.channel}</p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{v.description}</p>
                </div>
                <a href={v.url} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 text-neutral-400 hover:text-red-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Teaching Tips */}
        {activeTab === 'tips' && (
          <div className="space-y-3">
            {materials.teachingTips.length === 0 && <p className="text-xs text-neutral-400 italic">No teaching tips generated.</p>}
            {materials.teachingTips.map((tip, i) => (
              <div key={i} className={`p-3 rounded-lg border ${TIMING_COLORS[tip.timing]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{tip.timing} lesson</span>
                  </div>
                </div>
                <p className="text-xs font-semibold">{tip.tip}</p>
                <p className="text-[11px] mt-1 opacity-80 leading-relaxed">{tip.rationale}</p>
              </div>
            ))}
          </div>
        )}

        {/* Activity Guides */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            {materials.activityGuides.length === 0 && <p className="text-xs text-neutral-400 italic">No activity guides generated.</p>}
            {materials.activityGuides.map((guide, i) => (
              <div key={i} className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <FlaskConical size={12} className="text-purple-500" /> {guide.activityName}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1">
                      <Clock size={9} /> {guide.estimatedTime}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-2 italic">Goal: {guide.objective}</p>
                {guide.materials.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Materials needed:</p>
                    <div className="flex flex-wrap gap-1">
                      {guide.materials.map((m, j) => (
                        <span key={j} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px]">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {guide.steps.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Steps:</p>
                    <ol className="space-y-1">
                      {guide.steps.map((step, j) => (
                        <li key={j} className="flex gap-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[9px] font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {guide.differentation && (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">Differentiation: </span>{guide.differentation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Visual Aids */}
        {activeTab === 'visuals' && (
          <div className="space-y-3">
            {materials.visualAids.length === 0 && <p className="text-xs text-neutral-400 italic">No visual aids generated.</p>}
            {materials.visualAids.map((aid, i) => (
              <div key={i} className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ImageIcon size={12} className="text-teal-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">{aid.type}</span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">— {aid.name}</span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-2 leading-relaxed">{aid.description}</p>
                <div className="p-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded">
                  <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 mb-0.5">How to create:</p>
                  <p className="text-[10px] text-teal-600 dark:text-teal-400 leading-relaxed">{aid.howToCreate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function CurriculumDetail({
  curriculumId,
  onBack,
  onGenerateVariant,
  onDuplicate,
  generatingVariant = false,
  teacherId = '00000000-0000-0000-0000-000000000001',
}: CurriculumDetailProps) {
  const [curriculum, setCurriculum]           = useState<CurriculumData | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['objectives', 'units']));
  const [variantStyle, setVariantStyle]       = useState('');
  const [showVariantMenu, setShowVariantMenu] = useState(false);
  const [assignments, setAssignments]         = useState<Assignment[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);
  const [publishingIds, setPublishingIds]     = useState<Set<string>>(new Set());
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [showHomeworkPrompt, setShowHomeworkPrompt] = useState(false);
  const [homeworkPrompt, setHomeworkPrompt]   = useState('');
  const [generatingHomework, setGeneratingHomework] = useState(false);
  const [reviewingAssignmentId, setReviewingAssignmentId] = useState<string | null>(null);

  // Reference materials (curriculum-level)
  const [curriculumRefs, setCurriculumRefs]       = useState<any[] | null>(null);
  const [loadingRefs, setLoadingRefs]             = useState(false);

  // Per-day teaching materials: Map<dayIndex, TeachingMaterials>
  const [dayMaterials, setDayMaterials]         = useState<Map<number, TeachingMaterials>>(new Map());
  const [dayMaterialsLoading, setDayMaterialsLoading] = useState<Set<number>>(new Set());
  // Track which day panels are expanded
  const [expandedDayMaterials, setExpandedDayMaterials] = useState<Set<number>>(new Set());

  // ── Data fetching ────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchCurriculum = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/curriculum/${curriculumId}`);
        const data = await res.json();
        if (data.success) {
          setCurriculum(data.curriculum);
          fetchHomework(curriculumId);
        }
      } catch (error) {
        console.error('Failed to fetch curriculum:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCurriculum();
  }, [curriculumId]);

  const fetchHomework = async (lessonId: string) => {
    setLoadingHomework(true);
    try {
      const res  = await fetch(`/api/homework?lessonId=${lessonId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assignments)) setAssignments(data.assignments);
    } catch (error) {
      console.error('Failed to fetch homework:', error);
    } finally {
      setLoadingHomework(false);
    }
  };

  // ── Generate curriculum-level references ─────────────────────────────────────

  const handleGenerateCurriculumRefs = useCallback(async () => {
    if (!curriculum) return;
    setLoadingRefs(true);
    try {
      const res  = await fetch('/api/curriculum/references', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          curriculumTitle:    curriculum.title,
          subject:            curriculum.subject,
          gradeLevel:         curriculum.gradeLevel,
          learningObjectives: curriculum.parsed?.learningObjectives || [],
          keyConcepts:        curriculum.parsed?.keyConcepts        || [],
        }),
      });
      const data = await res.json();
      if (data.success) setCurriculumRefs(data.references);
    } catch (error) {
      console.error('Failed to generate references:', error);
    } finally {
      setLoadingRefs(false);
    }
  }, [curriculum]);

  // ── Generate per-day teaching materials ──────────────────────────────────────

  const handleGenerateDayMaterials = useCallback(async (dayIndex: number) => {
    if (!curriculum?.parsed?.units) return;
    const unit = curriculum.parsed.units[dayIndex];
    if (!unit) return;

    setDayMaterialsLoading((prev) => new Set([...prev, dayIndex]));
    setExpandedDayMaterials((prev) => new Set([...prev, dayIndex]));
    try {
      const res  = await fetch('/api/curriculum/teaching-materials', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          curriculumTitle: curriculum.title,
          subject:         curriculum.subject,
          gradeLevel:      curriculum.gradeLevel,
          dayLabel:        unit.dayLabel || `Day ${dayIndex + 1}`,
          dayTitle:        unit.title,
          keyTopics:       unit.keyTopics || [],
          activities:      unit.activities || [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDayMaterials((prev) => {
          const next = new Map(prev);
          next.set(dayIndex, data.materials);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to generate day materials:', error);
    } finally {
      setDayMaterialsLoading((prev) => {
        const next = new Set(prev);
        next.delete(dayIndex);
        return next;
      });
    }
  }, [curriculum]);

  // ── Homework actions ─────────────────────────────────────────────────────────

  const handlePublishHomework = async () => {
    if (selectedAssignments.size === 0) { alert('Please select at least one assignment to publish'); return; }
    setPublishingIds(selectedAssignments);
    try {
      const res  = await fetch('/api/homework/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lessonId: curriculumId, assignmentIds: Array.from(selectedAssignments), teacherId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchHomework(curriculumId);
        setSelectedAssignments(new Set());
        alert(`Published ${selectedAssignments.size} assignment(s) to students`);
      } else {
        alert('Failed to publish homework: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to publish homework:', error);
      alert('Error publishing homework');
    } finally {
      setPublishingIds(new Set());
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(assignmentId)) newSelected.delete(assignmentId); else newSelected.add(assignmentId);
    setSelectedAssignments(newSelected);
  };

  const handleGenerateCustomHomework = async () => {
    if (!homeworkPrompt.trim()) { alert('Please enter a homework topic'); return; }
    if (!curriculum)            { alert('Curriculum not loaded'); return; }
    setGeneratingHomework(true);
    try {
      const res  = await fetch('/api/homework/custom-generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          lessonId:          curriculumId,
          teacherId,
          subject:           curriculum.subject,
          gradeLevel:        curriculum.gradeLevel,
          gradingSystem:     curriculum.gradingSystem,
          topic:             homeworkPrompt,
          curriculumContent: curriculum.rawContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchHomework(curriculumId);
        setHomeworkPrompt('');
        setShowHomeworkPrompt(false);
        alert('Custom homework generated successfully!');
      } else {
        alert('Failed to generate homework: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to generate homework:', error);
      alert('Error generating homework');
    } finally {
      setGeneratingHomework(false);
    }
  };

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section); else next.add(section);
    setExpandedSections(next);
  };

  const handleGenerateVariant = (style: string) => {
    onGenerateVariant?.(style);
    setShowVariantMenu(false);
  };

  const handleReviewHomework  = (assignmentId: string) => setReviewingAssignmentId(assignmentId);

  const handleUpdateHomework = async (data: { dueAt: string; title: string; description: string }) => {
    if (!reviewingAssignmentId) return;
    const res  = await fetch('/api/homework/draft-update', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ assignmentId: reviewingAssignmentId, dueAt: data.dueAt, title: data.title, description: data.description }),
    });
    const response = await res.json();
    if (response.success) {
      setAssignments(assignments.map((a) =>
        a.id === reviewingAssignmentId ? { ...a, due_at: data.dueAt, title: data.title, description: data.description } : a
      ));
    } else {
      throw new Error(response.error || 'Failed to update');
    }
  };

  const handlePublishFromModal = async () => {
    if (!reviewingAssignmentId) return;
    setPublishingIds(new Set([...publishingIds, reviewingAssignmentId]));
    try {
      const res  = await fetch('/api/homework/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lessonId: curriculumId, teacherId, assignmentIds: [reviewingAssignmentId] }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(assignments.map((a) => a.id === reviewingAssignmentId ? { ...a, status: 'active' as const } : a));
        setReviewingAssignmentId(null);
        setSelectedAssignments(new Set());
      } else {
        alert('Failed to publish: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to publish homework:', error);
      alert('Error publishing homework');
    } finally {
      setPublishingIds(new Set([...publishingIds].filter((id) => id !== reviewingAssignmentId)));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-center py-12"><p className="text-neutral-600 dark:text-neutral-400">Loading curriculum…</p></div>;
  }
  if (!curriculum) {
    return <div className="text-center py-12"><p className="text-neutral-600 dark:text-neutral-400">Curriculum not found</p></div>;
  }

  const parsed = curriculum.parsed;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
        ← Back to Curriculums
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{curriculum.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">{curriculum.subject}</span>
              <span className="px-2 py-1 text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">Grade {curriculum.gradeLevel}</span>
              {curriculum.gradingSystem && (
                <span className="px-2 py-1 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded">{curriculum.gradingSystem}</span>
              )}
              <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto self-center">
                Created {new Date(curriculum.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              disabled={generatingVariant}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {generatingVariant ? 'Generating Variant…' : '✨ Generate Variant'}
            </button>
            {showVariantMenu && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-max">
                {[
                  { value: 'lecture',    label: 'Lecture-based' },
                  { value: 'project',    label: 'Project-based' },
                  { value: 'discussion', label: 'Discussion-based' },
                  { value: 'hands-on',   label: 'Hands-on/Lab' },
                  { value: 'hybrid',     label: 'Hybrid' },
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() => handleGenerateVariant(style.value)}
                    disabled={generatingVariant}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg disabled:opacity-50"
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onDuplicate}
            className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            📋 Duplicate
          </button>
        </div>
      </div>

      {/* ── Collapsible sections ── */}
      <div className="space-y-3">

        {/* Learning Objectives */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon="📚" title="Learning Objectives"
            count={parsed?.learningObjectives?.length}
            expanded={expandedSections.has('objectives')}
            onToggle={() => toggleSection('objectives')}
          />
          {expandedSections.has('objectives') && (
            <div className="px-6 py-4 space-y-2">
              {parsed?.learningObjectives && parsed.learningObjectives.length > 0 ? (
                parsed.learningObjectives.map((obj, i) => (
                  <div key={i} className="flex gap-3 text-neutral-700 dark:text-neutral-300">
                    <span className="text-blue-600 dark:text-blue-400 flex-shrink-0 font-bold">•</span>
                    <p>{obj}</p>
                  </div>
                ))
              ) : <p className="text-neutral-500 italic">No learning objectives specified</p>}
            </div>
          )}
        </div>

        {/* ── Reference Materials (curriculum-level) ── */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon={<BookOpen size={18} />} title="Reference Materials"
            count={curriculumRefs ? curriculumRefs.length : undefined}
            expanded={expandedSections.has('references')}
            onToggle={() => toggleSection('references')}
          />
          {expandedSections.has('references') && (
            <CurriculumReferencesPanel
              references={curriculumRefs}
              loading={loadingRefs}
              onGenerate={handleGenerateCurriculumRefs}
            />
          )}
        </div>

        {/* ── Daily Breakdown with per-day teaching materials ── */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon="📅" title={`Daily Breakdown`}
            count={`${parsed?.units?.length || 0} days`}
            expanded={expandedSections.has('units')}
            onToggle={() => toggleSection('units')}
          />
          {expandedSections.has('units') && (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {parsed?.units && parsed.units.length > 0 ? (
                parsed.units.map((unit, i) => {
                  const hasMaterials     = dayMaterials.has(i);
                  const isMatsLoading    = dayMaterialsLoading.has(i);
                  const isMatsExpanded   = expandedDayMaterials.has(i);

                  return (
                    <div key={i} className="px-6 py-4">
                      {/* Day header */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                          {unit.dayLabel}: {unit.title}
                        </h3>
                        {hasMaterials && !isMatsLoading && (
                          <button
                            onClick={() => setExpandedDayMaterials((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                            className="flex-shrink-0 text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                          >
                            {isMatsExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                            {isMatsExpanded ? 'Hide' : 'Show'} materials
                          </button>
                        )}
                      </div>

                      {/* Key topics */}
                      {unit.keyTopics && unit.keyTopics.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium mb-1">Key Topics:</p>
                          <div className="flex flex-wrap gap-1">
                            {unit.keyTopics.map((topic, j) => (
                              <span key={j} className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Activities */}
                      {unit.activities && unit.activities.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium mb-1">Activities:</p>
                          <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                            {unit.activities.slice(0, 3).map((activity, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-purple-600 dark:text-purple-400">→</span>
                                <span>{activity}</span>
                              </li>
                            ))}
                            {unit.activities.length > 3 && (
                              <li className="text-neutral-500 italic">+{unit.activities.length - 3} more activities</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Teaching materials (per day) */}
                      {(!hasMaterials || isMatsExpanded) && (
                        <DayTeachingMaterials
                          materials={hasMaterials ? dayMaterials.get(i)! : null}
                          loading={isMatsLoading}
                          onGenerate={() => handleGenerateDayMaterials(i)}
                          dayLabel={unit.dayLabel || `Day ${i + 1}`}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-4">
                  <p className="text-neutral-500 italic">No daily breakdown available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Concepts */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon="💡" title="Key Concepts"
            count={parsed?.keyConcepts?.length}
            expanded={expandedSections.has('concepts')}
            onToggle={() => toggleSection('concepts')}
          />
          {expandedSections.has('concepts') && (
            <div className="px-6 py-4">
              {parsed?.keyConcepts && parsed.keyConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parsed.keyConcepts.map((concept, i) => (
                    <span key={i} className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                      {concept}
                    </span>
                  ))}
                </div>
              ) : <p className="text-neutral-500 italic">No key concepts specified</p>}
            </div>
          )}
        </div>

        {/* Assessment Methods */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon="✅" title="Assessment Methods"
            count={parsed?.assessmentMethods?.length}
            expanded={expandedSections.has('assessment')}
            onToggle={() => toggleSection('assessment')}
          />
          {expandedSections.has('assessment') && (
            <div className="px-6 py-4 space-y-2">
              {parsed?.assessmentMethods && parsed.assessmentMethods.length > 0 ? (
                parsed.assessmentMethods.map((method, i) => (
                  <div key={i} className="flex gap-3 text-neutral-700 dark:text-neutral-300">
                    <span className="text-green-600 dark:text-green-400 flex-shrink-0 font-bold">✓</span>
                    <p>{method}</p>
                  </div>
                ))
              ) : <p className="text-neutral-500 italic">No assessment methods specified</p>}
            </div>
          )}
        </div>

        {/* Homework Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <SectionHeader
            icon="📝" title="Homework Assignments"
            count={assignments.length > 0 ? assignments.length : undefined}
            expanded={expandedSections.has('homework')}
            onToggle={() => toggleSection('homework')}
          />
          {expandedSections.has('homework') && (
            <div className="px-6 py-4 space-y-4">
              {/* Custom Homework Generator */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                {!showHomeworkPrompt ? (
                  <button
                    onClick={() => setShowHomeworkPrompt(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    ✨ Generate Custom Homework
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Homework Topic (contextual to {curriculum?.subject})
                    </label>
                    <textarea
                      value={homeworkPrompt}
                      onChange={(e) => setHomeworkPrompt(e.target.value)}
                      placeholder="e.g., 'Create homework on quadratic equations focusing on real-world applications like projectile motion'"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateCustomHomework}
                        disabled={generatingHomework || !homeworkPrompt.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                      >
                        {generatingHomework ? '⏳ Generating…' : '✨ Generate'}
                      </button>
                      <button
                        onClick={() => { setShowHomeworkPrompt(false); setHomeworkPrompt(''); }}
                        disabled={generatingHomework}
                        className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {loadingHomework ? (
                <p className="text-neutral-500">Loading homework assignments…</p>
              ) : assignments.length === 0 ? (
                <p className="text-neutral-500 italic">No homework assignments generated yet</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                        onClick={() => assignment.status === 'draft' && handleReviewHomework(assignment.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAssignments.has(assignment.id)}
                            onChange={() => toggleAssignmentSelection(assignment.id)}
                            disabled={assignment.status === 'active' || publishingIds.has(assignment.id)}
                            className="mt-1 cursor-pointer disabled:opacity-50"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{assignment.title}</h3>
                                {assignment.description && (
                                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{assignment.description}</p>
                                )}
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                                assignment.status === 'draft'   ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                                assignment.status === 'active'  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                                'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                              }`}>
                                {assignment.status === 'draft' ? '📋 Draft' : assignment.status === 'active' ? '✓ Published' : 'Archived'}
                              </span>
                            </div>
                            {assignment.due_at && (
                              <p className="text-xs text-neutral-500 mt-2">
                                Due: {new Date(assignment.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {assignments.some((a) => a.status === 'draft') && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <button
                        onClick={handlePublishHomework}
                        disabled={selectedAssignments.size === 0 || publishingIds.size > 0}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                      >
                        {publishingIds.size > 0 ? '⏳ Publishing…' : `📤 Publish ${selectedAssignments.size > 0 ? `(${selectedAssignments.size})` : ''}`}
                      </button>
                      {selectedAssignments.size > 0 && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                          {selectedAssignments.size} assignment(s) selected for publishing
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Homework Review Modal */}
      {reviewingAssignmentId && (() => {
        const assignment = assignments.find((a) => a.id === reviewingAssignmentId);
        if (!assignment) return null;
        return (
          <HomeworkReviewModal
            assignmentId={assignment.id}
            title={assignment.title}
            description={assignment.description || ''}
            dueAt={assignment.due_at || new Date().toISOString()}
            content={assignment.content || { questions: [] }}
            rubric={assignment.rubric || { criteria: [], total_points: 0 }}
            onClose={() => setReviewingAssignmentId(null)}
            onPublish={handlePublishFromModal}
            onUpdate={handleUpdateHomework}
          />
        );
      })()}
    </div>
  );
}
