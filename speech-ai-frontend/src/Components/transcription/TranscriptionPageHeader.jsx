// src/Components/transcription/TranscriptionPageHeader.jsx - FIXED: Download button works for database transcripts
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  Download, 
  ChevronDown,
  FileText,
  File
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAppStore from '../../stores/appStore';

const TranscriptionPageHeader = ({ 
  currentSessionId, 
  results, 
  structures, 
  parameters, 
  hasSession,
  editorRef,
  currentView = 'original' // Track which view is currently active
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // ✅ FIXED: Check if we have results (either from processing or database)
  const hasResults = results?.results?.segments && results.results.segments.length > 0;
  
  // ✅ FIXED: Download button should be enabled if we have results OR session
  const canDownload = hasResults || hasSession;

  // Helper function to format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Helper function to format time with hours
  const formatTimeWithHours = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current content based on what's actually being viewed
  const getCurrentContent = () => {
    // First check if we're in editor view and can get content from editor
    if (currentView === 'editor' && editorRef?.current?.getCurrentContent) {
      const editorContent = editorRef.current.getCurrentContent();
      const editorMappings = editorRef.current.getCurrentMappings?.() || {};
      const hasEditorContent = editorContent && editorContent.trim() && editorContent !== '<p><br></p>';
      
      if (hasEditorContent) {
        console.log('📝 Getting content from editor (has edits)');
        return {
          content: editorContent,
          isEdited: true,
          mappings: editorMappings
        };
      }
    }

    // Fallback to original results
    console.log('📄 Using original content');
    const segments = results?.results?.segments || [];
    let htmlContent = '';
    const originalMappings = {};

    segments.forEach((segment) => {
      const speaker = segment.speaker;
      const text = segment.text || '';
      const start = segment.start || 0;
      const end = segment.end || 0;

      // Build original mappings
      if (!originalMappings[speaker]) {
        originalMappings[speaker] = speaker;
      }

      const timeStamp = `[${formatTime(start)} - ${formatTime(end)}]`;
      htmlContent += `<p><span style="color: #6b7280; font-size: 0.875rem; font-family: monospace;">${timeStamp}</span> <strong style="color: #059669;">${speaker}:</strong> ${text}</p>`;
    });

    return {
      content: htmlContent,
      isEdited: false,
      mappings: originalMappings
    };
  };

  // Generate speaker statistics
  const generateSpeakerStats = (mappings = {}) => {
    const stats = {};
    const segments = results?.results?.segments || [];
    
    segments.forEach(segment => {
      const speakerName = mappings[segment.speaker] || segment.speaker;
      if (!stats[speakerName]) {
        stats[speakerName] = {
          segments: 0,
          totalDuration: 0,
          wordCount: 0
        };
      }
      stats[speakerName].segments++;
      stats[speakerName].totalDuration += (segment.end - segment.start);
      stats[speakerName].wordCount += (segment.text || '').split(' ').length;
    });
    
    return stats;
  };

  // Professional TXT format
  const downloadProfessionalTxt = () => {
    try {
      // ✅ SAFETY CHECK: Ensure we have results
      if (!hasResults) {
        toast.error('No transcript available to download');
        return;
      }

      const { content: currentContent, isEdited, mappings } = getCurrentContent();
      const segments = results?.results?.segments || [];
      const speakerStats = generateSpeakerStats(mappings);
      const metadata = results?.results?.metadata || {};
      
      // Header
      let content = `TRANSCRIPT
${'='.repeat(60)}

Document Information:
• Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
• Session ID: ${currentSessionId?.slice(0, 8) || 'N/A'}
• Total Duration: ${formatTimeWithHours(metadata.total_duration || 0)}
• Total Speakers: ${Object.keys(speakerStats).length}
• Language: ${metadata.language || 'Auto-detected'}
• Content Type: ${isEdited ? 'Edited Transcript' : 'Original Transcript'}
• View Source: ${currentView === 'editor' ? 'Live Editor' : 'Original View'}

Speaker Summary:
`;

      // Speaker stats
      Object.entries(speakerStats).forEach(([speaker, stats]) => {
        const percentage = metadata.total_duration ? 
          ((stats.totalDuration / metadata.total_duration) * 100).toFixed(1) : '0';
        content += `• ${speaker}: ${stats.segments} segments, ${formatTimeWithHours(stats.totalDuration)} (${percentage}%), ~${stats.wordCount} words\n`;
      });

      content += `\n${'='.repeat(60)}\nTRANSCRIPT CONTENT\n${'='.repeat(60)}\n\n`;

      // Format transcript with proper speaker names
      segments.forEach((segment, index) => {
        const speakerName = mappings[segment.speaker] || segment.speaker;
        const timestamp = `[${formatTimeWithHours(segment.start)} - ${formatTimeWithHours(segment.end)}]`;
        
        content += `${timestamp} ${speakerName}:\n${segment.text}\n\n`;
      });

      content += `${'='.repeat(60)}\nEnd of Transcript\nGenerated by AI Speech Diarization Platform\n`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcript_professional_${currentSessionId?.slice(0, 8) || 'session'}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${isEdited ? 'edited' : 'original'} professional transcript from ${currentView} view`);
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download transcript');
    }
  };

  // Meeting Minutes format
  const downloadMeetingMinutes = () => {
    try {
      if (!hasResults) {
        toast.error('No transcript available to download');
        return;
      }

      const { mappings, isEdited } = getCurrentContent();
      const segments = results?.results?.segments || [];
      const speakerStats = generateSpeakerStats(mappings);
      const metadata = results?.results?.metadata || {};
      
      let content = `MEETING MINUTES
${'='.repeat(60)}

Meeting Details:
• Date: ${new Date().toLocaleDateString()}
• Duration: ${formatTimeWithHours(metadata.total_duration || 0)}
• Participants: ${Object.keys(speakerStats).length}
• Content: ${isEdited ? 'Edited Version' : 'Original Recording'}
• Source: ${currentView === 'editor' ? 'Live Editor' : 'Original View'}

Attendees:
`;

      Object.keys(speakerStats).forEach(speaker => {
        content += `• ${speaker}\n`;
      });

      content += `\nDiscussion:\n${'='.repeat(40)}\n\n`;

      // Group by speaker for meeting minutes style
      const speakerGroups = {};
      segments.forEach(segment => {
        const speakerName = mappings[segment.speaker] || segment.speaker;
        if (!speakerGroups[speakerName]) {
          speakerGroups[speakerName] = [];
        }
        speakerGroups[speakerName].push(segment);
      });

      Object.entries(speakerGroups).forEach(([speaker, speakerSegments]) => {
        content += `\n${speaker}:\n`;
        speakerSegments.forEach(segment => {
          content += `  - ${segment.text}\n`;
        });
      });

      content += `\n${'='.repeat(60)}\nEnd of Meeting Minutes\n`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meeting_minutes_${currentSessionId?.slice(0, 8) || 'session'}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded meeting minutes from ${currentView} view`);
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download meeting minutes');
    }
  };

  // Simple transcript format
  const downloadSimpleTranscript = () => {
    try {
      if (!hasResults) {
        toast.error('No transcript available to download');
        return;
      }

      const { mappings } = getCurrentContent();
      const segments = results?.results?.segments || [];
      
      let content = '';
      segments.forEach(segment => {
        const speakerName = mappings[segment.speaker] || segment.speaker;
        content += `${speakerName}: ${segment.text}\n\n`;
      });

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcript_simple_${currentSessionId?.slice(0, 8) || 'session'}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded simple transcript from ${currentView} view`);
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download transcript');
    }
  };

  // PDF Download
  const downloadPDF = () => {
    try {
      if (!hasResults) {
        toast.error('No transcript available to download');
        return;
      }

      // Dynamically import jsPDF
      import('jspdf').then(({ default: jsPDF }) => {
        const { content: currentContent, isEdited, mappings } = getCurrentContent();
        const segments = results?.results?.segments || [];
        const speakerStats = generateSpeakerStats(mappings);
        const metadata = results?.results?.metadata || {};
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 20;
        const maxWidth = pageWidth - (margin * 2);
        let yPosition = margin;
        
        // Helper function to add text with word wrapping
        const addText = (text, fontSize = 10, isBold = false) => {
          doc.setFontSize(fontSize);
          if (isBold) {
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setFont('helvetica', 'normal');
          }
          
          const lines = doc.splitTextToSize(text, maxWidth);
          
          // Check if we need a new page
          if (yPosition + (lines.length * fontSize * 0.35) > doc.internal.pageSize.height - margin) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.text(lines, margin, yPosition);
          yPosition += lines.length * fontSize * 0.35 + 5;
        };
        
        // Header
        addText('TRANSCRIPT DOCUMENT', 16, true);
        yPosition += 5;
        
        // Document information
        addText('Document Information:', 12, true);
        addText(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
        addText(`Session ID: ${currentSessionId?.slice(0, 8) || 'N/A'}`);
        addText(`Total Duration: ${formatTimeWithHours(metadata.total_duration || 0)}`);
        addText(`Total Speakers: ${Object.keys(speakerStats).length}`);
        addText(`Language: ${metadata.language || 'Auto-detected'}`);
        addText(`Content Type: ${isEdited ? 'Edited Transcript' : 'Original Transcript'}`);
        addText(`View Source: ${currentView === 'editor' ? 'Live Editor' : 'Original View'}`);
        yPosition += 10;
        
        // Speaker Summary
        addText('Speaker Summary:', 12, true);
        Object.entries(speakerStats).forEach(([speaker, stats]) => {
          const percentage = metadata.total_duration ? 
            ((stats.totalDuration / metadata.total_duration) * 100).toFixed(1) : '0';
          addText(`• ${speaker}: ${stats.segments} segments, ${formatTimeWithHours(stats.totalDuration)} (${percentage}%), ~${stats.wordCount} words`);
        });
        yPosition += 10;
        
        // Transcript Content
        addText('TRANSCRIPT CONTENT', 14, true);
        yPosition += 5;
        
        segments.forEach((segment) => {
          const speakerName = mappings[segment.speaker] || segment.speaker;
          const timestamp = `[${formatTimeWithHours(segment.start)} - ${formatTimeWithHours(segment.end)}]`;
          
          addText(`${timestamp} ${speakerName}:`, 10, true);
          addText(segment.text, 10, false);
          yPosition += 5;
        });
        
        // Save the PDF
        doc.save(`transcript_${currentSessionId?.slice(0, 8) || 'session'}_${new Date().toISOString().slice(0, 10)}.pdf`);
        
        toast.success(`Downloaded ${isEdited ? 'edited' : 'original'} PDF from ${currentView} view`);
        setShowDownloadMenu(false);
      }).catch(error => {
        console.error('Failed to load jsPDF:', error);
        toast.error('PDF library not available. Please try another format.');
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // JSON Download
  const downloadJSON = () => {
    try {
      if (!hasResults) {
        toast.error('No transcript available to download');
        return;
      }

      const content = JSON.stringify(results, null, 2);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${currentSessionId}_results_${timestamp}.json`;
      
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded complete results as JSON from ${currentView} view`);
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('JSON download error:', error);
      toast.error('Failed to download JSON');
    }
  };

  return (
    <div className="mb-6">
      {/* Back Button and Title Section */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6">
        {/* Left Side - Back Button and Title */}
        <div className="flex items-center space-x-6">
          <Link
            to="/"
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back</span>
          </Link>
          
          <div>
            <h1 className="text-3xl font-bold text-psycon-mint mb-1">Results</h1>
            <p className="text-gray-600 text-sm">
              {hasResults ? 'Transcript Ready' : 'Active Session'}
            </p>
          </div>
        </div>
  
        {/* ✅ FIXED: Download Button - enabled when we have results */}
        <div className="relative sm:ml-auto">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            disabled={!canDownload}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors w-full sm:w-auto ${
              canDownload
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={!canDownload ? 'No transcript available to download' : 'Download transcript'}
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
            <ChevronDown className="w-4 h-4" />
          </button>
  
          {/* Download Dropdown Menu */}
          {showDownloadMenu && canDownload && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDownloadMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <div className="p-2">
                  <button
                    onClick={downloadProfessionalTxt}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
                  >
                    <FileText className="w-4 h-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Professional TXT</div>
                      <div className="text-xs text-gray-500">Formatted transcript with headers</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={downloadSimpleTranscript}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
                  >
                    <FileText className="w-4 h-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Simple Transcript</div>
                      <div className="text-xs text-gray-500">Clean text without formatting</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={downloadPDF}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
                  >
                    <File className="w-4 h-4" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">PDF Document</div>
                      <div className="text-xs text-gray-500">Professional PDF format</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionPageHeader;