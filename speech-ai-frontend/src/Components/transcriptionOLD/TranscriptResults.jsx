// src/components/transcription/TranscriptResults.jsx - Results Display Component
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Clock, 
  FileText, 
  BarChart3,
  ChevronDown,
  ChevronUp,
  Play,
  User
} from 'lucide-react';

const TranscriptResults = ({ results, sessionId }) => {
  const [expandedSegments, setExpandedSegments] = useState(true);
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');

  if (!results) return null;

  const { results: data } = results;
  const { metadata, segments, speaker_stats } = data;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speaker) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-red-100 text-red-800 border-red-200',
      'bg-teal-100 text-teal-800 border-teal-200'
    ];
    const speakers = Object.keys(speaker_stats);
    const index = speakers.indexOf(speaker);
    return colors[index % colors.length] || colors[0];
  };

  const filteredSegments = selectedSpeaker === 'all' 
    ? segments 
    : segments.filter(seg => seg.speaker === selectedSpeaker);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <div className="text-lg font-bold text-blue-800">
            {formatTime(metadata.total_duration)}
          </div>
          <div className="text-sm text-blue-600">Duration</div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <div className="text-lg font-bold text-green-800">
            {metadata.num_speakers}
          </div>
          <div className="text-sm text-green-600">Speakers</div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <FileText className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <div className="text-lg font-bold text-purple-800">
            {metadata.num_segments}
          </div>
          <div className="text-sm text-purple-600">Segments</div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <BarChart3 className="w-6 h-6 text-orange-600 mx-auto mb-2" />
          <div className="text-lg font-bold text-orange-800">
            {metadata.language.toUpperCase()}
          </div>
          <div className="text-sm text-orange-600">Language</div>
        </div>
      </div>

      {/* Speaker Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Speaker Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(speaker_stats).map(([speaker, stats]) => (
            <div key={speaker} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 rounded-md text-sm font-medium border ${getSpeakerColor(speaker)}`}>
                  {speaker}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {stats.duration_percentage.toFixed(1)}%
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Duration: {formatTime(stats.total_duration)}</div>
                <div>Words: {stats.total_words}</div>
                <div>Segments: {stats.segments}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
          <div className="flex items-center space-x-4">
            {/* Speaker Filter */}
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Speakers</option>
              {Object.keys(speaker_stats).map(speaker => (
                <option key={speaker} value={speaker}>{speaker}</option>
              ))}
            </select>
            
            {/* Expand/Collapse */}
            <button
              onClick={() => setExpandedSegments(!expandedSegments)}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {expandedSegments ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Expand</span>
                </>
              )}
            </button>
          </div>
        </div>

        {expandedSegments && (
          <div className="bg-white border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {filteredSegments.map((segment, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex space-x-4">
                    <div className="flex-shrink-0">
                      <div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </div>
                      <div className={`mt-2 px-2 py-1 rounded-md text-xs font-medium border ${getSpeakerColor(segment.speaker)}`}>
                        {segment.speaker}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 leading-relaxed">{segment.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptResults;