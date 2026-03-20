'use client';

import { useState } from 'react';
import { PROSPECT_STAGE_LABELS, type ProspectStage } from 'shared';

export type ProspectCard = {
  id: string;
  parent_name: string;
  email: string;
  phone?: string;
  child_name: string;
  grade_interested: string;
  current_stage: ProspectStage;
  source: string;
  tour_scheduled_at?: string | null;
  notes?: string | null;
  last_contact_at?: string | null;
  created_at: string;
  inquiry_forms?: Array<{ form_data: Array<{ question: string; answer: string }> }>;
};

type KanbanColumn = {
  id: ProspectStage;
  label: string;
  color: string;
  headerBg: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: 'inquiry_received', label: PROSPECT_STAGE_LABELS.inquiry_received, color: 'blue', headerBg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { id: 'tour_scheduled', label: PROSPECT_STAGE_LABELS.tour_scheduled, color: 'violet', headerBg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
  { id: 'waitlisted', label: PROSPECT_STAGE_LABELS.waitlisted, color: 'amber', headerBg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { id: 'enrolled', label: PROSPECT_STAGE_LABELS.enrolled, color: 'green', headerBg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  { id: 'churned', label: PROSPECT_STAGE_LABELS.churned, color: 'neutral', headerBg: 'bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-700' },
];

const STAGE_BADGE: Record<ProspectStage, string> = {
  inquiry_received: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  tour_scheduled: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  waitlisted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  enrolled: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  churned: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
};

interface KanbanBoardProps {
  grouped: Record<ProspectStage, ProspectCard[]>;
  onMoveStage: (prospectId: string, newStage: ProspectStage) => Promise<void>;
  onSelectCard: (prospect: ProspectCard) => void;
  movingId: string | null;
}

export function KanbanBoard({ grouped, onMoveStage, onSelectCard, movingId }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<ProspectStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, prospectId: string) => {
    e.dataTransfer.setData('prospectId', prospectId);
    setDraggingId(prospectId);
  };

  const handleDragOver = (e: React.DragEvent, colId: ProspectStage) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: ProspectStage) => {
    e.preventDefault();
    const prospectId = e.dataTransfer.getData('prospectId');
    setDragOverCol(null);
    setDraggingId(null);
    if (prospectId) {
      await onMoveStage(prospectId, colId);
    }
  };

  const handleDragEnd = () => {
    setDragOverCol(null);
    setDraggingId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const cards = grouped[col.id] ?? [];
        const isOver = dragOverCol === col.id;
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 rounded-xl border ${col.headerBg} ${
              isOver ? 'ring-2 ring-blue-400' : ''
            } transition-all`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
          >
            {/* Column Header */}
            <div className={`px-4 py-3 border-b ${col.headerBg} rounded-t-xl`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-200">
                  {col.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STAGE_BADGE[col.id]}`}>
                  {cards.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-32">
              {cards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectCard(card)}
                  className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all select-none ${
                    draggingId === card.id ? 'opacity-50 scale-95' : ''
                  } ${movingId === card.id ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {card.child_name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {card.parent_name}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded font-medium">
                      Gr {card.grade_interested}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 truncate">{card.email}</p>
                  {card.tour_scheduled_at && (
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                      📅 Tour: {new Date(card.tour_scheduled_at).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    {new Date(card.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}

              {cards.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-neutral-400 dark:text-neutral-600 rounded-lg border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
