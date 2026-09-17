'use client';

import { useState } from 'react';
import { CareType } from '@/types/plant';

interface CareNotesModalProps {
  careType: CareType;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
}

const CARE_LABELS: Record<CareType, string> = {
  watering: 'watering',
  fertilizing: 'fertilizing',
  repotting: 'repotting',
};

/**
 * Styled replacement for `window.prompt()` when marking a care event done —
 * same fixed-overlay/rounded-card pattern as ConfirmDialog.
 */
export default function CareNotesModal({ careType, onClose, onConfirm }: CareNotesModalProps) {
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(notes.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-sm w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Mark {CARE_LABELS[careType]} done
          </h2>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
            placeholder="Anything worth remembering about this care event?"
          />
          <div className="flex space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
