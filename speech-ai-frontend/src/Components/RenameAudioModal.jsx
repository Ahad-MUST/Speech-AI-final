// NEW FILE: src/components/RenameAudioModal.jsx
// Modal component for renaming audio files

import React, { useState, useEffect } from 'react';

const RenameAudioModal = ({ isOpen, onClose, currentFilename, onRename }) => {
  const [newFilename, setNewFilename] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Remove extension from filename for editing
      const nameWithoutExt = currentFilename.replace(/\.[^/.]+$/, '');
      setNewFilename(nameWithoutExt);
      setError('');
    }
  }, [isOpen, currentFilename]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate
    const trimmedName = newFilename.trim();
    if (!trimmedName) {
      setError('Filename cannot be empty');
      return;
    }

    // Check for invalid characters
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    const hasInvalidChar = invalidChars.some(char => trimmedName.includes(char));
    if (hasInvalidChar) {
      setError(`Filename cannot contain: ${invalidChars.join(' ')}`);
      return;
    }

    setIsRenaming(true);
    setError('');

    try {
      // Get original extension
      const extension = currentFilename.match(/\.[^/.]+$/)?.[0] || '';
      const finalFilename = trimmedName + extension;
      
      await onRename(finalFilename);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to rename audio');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Get file extension for display
  const extension = currentFilename.match(/\.[^/.]+$/)?.[0] || '';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Rename Audio File
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-2">
              New filename
            </label>
            <div className="flex items-center">
              <input
                id="filename"
                type="text"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new filename"
                autoFocus
                disabled={isRenaming}
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-gray-600 text-sm">
                {extension}
              </span>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isRenaming}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isRenaming}
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameAudioModal;