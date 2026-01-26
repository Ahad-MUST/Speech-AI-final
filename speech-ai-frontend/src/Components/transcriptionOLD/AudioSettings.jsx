// src/components/transcription/AudioSettings.jsx - Audio Processing Settings
import React from 'react';
import { Settings, Globe, Users, Zap } from 'lucide-react';

const AudioSettings = ({ settings, onSettingsChange, disabled }) => {
  const handleSettingChange = (key, value) => {
    onSettingsChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const languages = [
    { code: '', name: '🌍 Auto-detect' },
    { code: 'en', name: '🇺🇸 English' },
    { code: 'es', name: '🇪🇸 Spanish' },
    { code: 'fr', name: '🇫🇷 French' },
    { code: 'de', name: '🇩🇪 German' },
    { code: 'it', name: '🇮🇹 Italian' },
    { code: 'pt', name: '🇧🇷 Portuguese' },
    { code: 'ru', name: '🇷🇺 Russian' },
    { code: 'ja', name: '🇯🇵 Japanese' },
    { code: 'ko', name: '🇰🇷 Korean' },
    { code: 'zh', name: '🇨🇳 Chinese' },
    { code: 'ar', name: '🇸🇦 Arabic' },
    { code: 'hi', name: '🇮🇳 Hindi' }
  ];

  const speakerOptions = [
    { value: '', label: '🤖 Auto-detect' },
    { value: '1', label: '1 Speaker' },
    { value: '2', label: '2 Speakers' },
    { value: '3', label: '3 Speakers' },
    { value: '4', label: '4 Speakers' },
    { value: '5', label: '5 Speakers' },
    { value: '6', label: '6 Speakers' },
    { value: '7', label: '7 Speakers' },
    { value: '8', label: '8 Speakers' },
    { value: '9', label: '9 Speakers' },
    { value: '10', label: '10 Speakers' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <Settings className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900">Processing Settings</h3>
      </div>

      {/* Language Selection */}
      <div>
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
          <Globe className="w-4 h-4" />
          <span>Language</span>
        </label>
        <select
          value={settings.language}
          onChange={(e) => handleSettingChange('language', e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Auto-detect works well for most languages
        </p>
      </div>

      {/* Number of Speakers */}
      <div>
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
          <Users className="w-4 h-4" />
          <span>Number of Speakers</span>
        </label>
        <select
          value={settings.numSpeakers}
          onChange={(e) => handleSettingChange('numSpeakers', e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {speakerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Auto-detect analyzes the audio to find speakers
        </p>
      </div>

      {/* Audio Preprocessing */}
      <div>
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
          <Zap className="w-4 h-4" />
          <span>Audio Enhancement</span>
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="preprocessing"
            checked={settings.preprocessing}
            onChange={(e) => handleSettingChange('preprocessing', e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
          />
          <label htmlFor="preprocessing" className="text-sm text-gray-700">
            Enable audio preprocessing
          </label>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <div className="space-y-1">
            <div>• Converts to optimal format (16kHz mono)</div>
            <div>• Removes noise and DC offset</div>
            <div>• Normalizes audio levels</div>
            <div>• Improves recognition accuracy</div>
          </div>
        </div>
      </div>

      {/* Advanced Settings Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Processing Tips</h4>
        <div className="text-xs text-blue-800 space-y-1">
          <div>• Clear audio with minimal background noise works best</div>
          <div>• Enable preprocessing for low-quality recordings</div>
          <div>• Specify speaker count if known for better accuracy</div>
          <div>• Processing time depends on file length and settings</div>
        </div>
      </div>
    </div>
  );
};

export default AudioSettings;