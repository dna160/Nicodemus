'use client';

import { useState } from 'react';
import { Mic, ChevronRight, Square, X } from 'lucide-react';

interface NicodemusAiModalProps {
  onClose: () => void;
  onProcess?: (transcript: string) => void;
  placeholderTranscript?: string;
}

export function NicodemusAiModal({
  onClose,
  onProcess,
  placeholderTranscript = 'Start speaking to record your note...',
}: NicodemusAiModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const displayText = transcript || placeholderTranscript;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative border border-blue-100">
        {/* Gradient top stripe */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-black dark:text-white hover:text-black dark:hover:text-white bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pr-8">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-black dark:text-white">
              <Mic size={20} className="text-indigo-600" /> Nicodemus Cue
            </h2>
            <span className="text-[10px] uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold">
              Beta AI
            </span>
          </div>

          {/* Waveform */}
          <div className="h-16 bg-gray-50 dark:bg-gray-800 rounded-xl mb-4 flex items-center justify-center gap-1 overflow-hidden px-4 border border-gray-100 dark:border-gray-700 shadow-inner">
            {isRecording ? (
              [...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-indigo-500 rounded-full animate-pulse"
                  style={{
                    height: `${(((i * 7) % 5) + 2) * 12}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))
            ) : (
              <div className="w-full h-[2px] bg-gray-300 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/3 h-[2px] bg-indigo-400" />
                <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full shadow-md cursor-pointer" />
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 min-h-[100px] mb-6 shadow-sm">
            <p className="text-sm text-black dark:text-white leading-relaxed italic">
              {transcript ? `"${displayText}"` : <span className="text-black dark:text-white">{displayText}</span>}
            </p>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setIsRecording((r) => !r)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all shadow-sm ${
                isRecording
                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {isRecording ? (
                <><Square size={14} fill="currentColor" /> Stop Recording</>
              ) : (
                <><Mic size={14} /> Hold to Speak</>
              )}
            </button>
            <button
              onClick={() => onProcess?.(transcript)}
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-sm transition-colors"
            >
              Process to ERP <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
