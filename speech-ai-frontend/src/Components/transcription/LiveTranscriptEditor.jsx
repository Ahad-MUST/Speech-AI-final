// src/Components/transcription/LiveTranscriptEditor.jsx

import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../../styles/SmoothScrollEditor.css';
import { 
  Save, 
  Copy,
  CheckCircle,
  User,
  AlertCircle,
  Edit3,
  Loader2
} from 'lucide-react';
import useAppStore from '../../stores/appStore';
import { backendApi } from '../../services/api';
import toast from 'react-hot-toast';

const LiveTranscriptEditor = forwardRef(({ results, hasSession }, ref) => {
  // Core State
  const [originalContent, setOriginalContent] = useState('');
  const [currentMappings, setCurrentMappings] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [speakerSamples, setSpeakerSamples] = useState({});
  const [highlightedSpeaker, setHighlightedSpeaker] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [inputFieldValues, setInputFieldValues] = useState({});
  const [speakerSegmentMap, setSpeakerSegmentMap] = useState({});
  
  // Refs
  const quillRef = useRef(null);
  const isProgrammaticUpdateRef = useRef(false);
  const updateTimeoutRef = useRef(null);
  const lastMappingsRef = useRef('{}');
  const initTimeoutRef = useRef(null);
  const lastSessionIdRef = useRef(null);
  const highlightObserverRef = useRef(null);
  const isSavingRef = useRef(false);
  const isRefreshingFromDBRef = useRef(false);
  
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  
  const segments = results?.results?.segments || results?.segments || [];
  const hasSegments = segments.length > 0;
  const hasActiveSession = hasSession ?? !!currentSessionId ?? hasSegments;

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getCurrentContent: () => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        return editor.root.innerHTML;
      }
      return generateLiveContent();
    },
    getCurrentMappings: () => currentMappings,
    hasUnsavedChanges: () => hasUnsavedChanges,
    getPlainTextContent: () => {
      const htmlContent = getCurrentContent();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      return tempDiv.textContent || tempDiv.innerText || '';
    }
  }), [currentMappings, hasUnsavedChanges]);

  // Initialize content and mappings - only on session change
  useEffect(() => {
    if (!currentSessionId) return;
    
    // Only reset on session change
    if (lastSessionIdRef.current !== currentSessionId) {
      console.log(`🔄 Session changed: ${lastSessionIdRef.current} → ${currentSessionId}`);
      
      setIsInitialized(false);
      setCurrentMappings({});
      setInputFieldValues({});
      setOriginalContent('');
      setHasUnsavedChanges(false);
      setValidationErrors({});
      setHighlightedSpeaker(null);
      setSpeakerSamples({});
      setSpeakerSegmentMap({});
      lastMappingsRef.current = '{}';
      
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      
      lastSessionIdRef.current = currentSessionId;
    }
    
    // Skip if already initialized
    if (isInitialized) {
      return;
    }
  
    const segments = results?.results?.segments || results?.segments || [];
    
    if (segments.length > 0) {
      console.log('🎬 Initializing transcript editor...');
      
      isRefreshingFromDBRef.current = true;
      
      const metadata = results?.results?.metadata || results?.metadata || {};
      const savedSpeakerMappings = metadata.speaker_mappings || {};
      
      console.log('📋 Loaded speaker mappings from database:', savedSpeakerMappings);
      
      // Build speaker label to segment index map
      const segmentMap = {};
      segments.forEach((segment, index) => {
        const speakerLabel = segment.speaker; // This should ALWAYS be SPEAKER_00, SPEAKER_01, etc.
        if (!segmentMap[speakerLabel]) {
          segmentMap[speakerLabel] = [];
        }
        segmentMap[speakerLabel].push(index);
      });
      setSpeakerSegmentMap(segmentMap);
      
      // Determine mappings
      const hasSavedMappings = Object.keys(savedSpeakerMappings).length > 0;
      let mappingsToUse = {};
      
      if (hasSavedMappings) {
        mappingsToUse = { ...savedSpeakerMappings };
        console.log('✅ Using saved mappings from database');
      } else {
        // Create default mappings: label → label
        segments.forEach((segment) => {
          const speakerLabel = segment.speaker;
          if (!mappingsToUse[speakerLabel]) {
            mappingsToUse[speakerLabel] = speakerLabel;
          }
        });
        console.log('✅ Using default speaker labels as mappings');
      }
      
      console.log('📝 Final mappings to use:', mappingsToUse);
      
      // Generate content with mappings
      const { content } = convertResultsToEditorFormat(segments, mappingsToUse);
      
      // Set all state simultaneously
      setOriginalContent(content);
      setCurrentMappings(mappingsToUse);
      setInputFieldValues(mappingsToUse);
      lastMappingsRef.current = JSON.stringify(mappingsToUse);
      
      const samples = getSpeakerSamples();
      setSpeakerSamples(samples);
      
      console.log('✅ State synchronized - content and mappings match');
      
      initTimeoutRef.current = setTimeout(() => {
        setIsInitialized(true);
        setTimeout(() => {
          isRefreshingFromDBRef.current = false;
          console.log('✅ Initialization complete');
        }, 500);
      }, 500);
      
      setHasUnsavedChanges(false);
    }
  }, [currentSessionId, results, isInitialized]);

  // ✅ CRITICAL: Convert segments to HTML, preserving labels in data-speaker
  const convertResultsToEditorFormat = (segments, mappings = {}) => {
    if (!segments || segments.length === 0) {
      return { content: '<p>No transcript available</p>', speakers: {} };
    }

    const speakers = {};
    let htmlContent = '';

    segments.forEach((segment, index) => {
      const speakerLabel = segment.speaker; // SPEAKER_00, SPEAKER_01, etc. (IMMUTABLE)
      const displayName = mappings[speakerLabel] || speakerLabel; // The name to display (MUTABLE)
      const text = segment.text || '';
      const start = segment.start || 0;
      const end = segment.end || 0;

      if (!speakers[speakerLabel]) {
        speakers[speakerLabel] = displayName;
      }

      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      const timeStamp = `[${formatTime(start)} - ${formatTime(end)}]`;
      
      // ✅ CRITICAL: data-speaker stores the LABEL (SPEAKER_00), <strong> shows the NAME (Alice)
      htmlContent += `<p data-speaker="${speakerLabel}" data-segment-index="${index}"><span style="color: #6b7280; font-size: 0.875rem; font-family: monospace;">${timeStamp}</span> <strong style="color: #059669;">${displayName}:</strong> ${text}</p>`;
    });

    return { content: htmlContent, speakers };
  };

  const getSpeakerSamples = useCallback(() => {
    const segments = results?.results?.segments || results?.segments || [];
    
    if (segments.length === 0) {
      return {};
    }

    const speakerSamples = {};

    segments.forEach((segment) => {
      const speakerLabel = segment.speaker;
      const text = segment.text || '';

      if (!speakerSamples[speakerLabel] && text.trim()) {
        const preview = text.length > 150 
          ? text.substring(0, 150) + '...' 
          : text;
        
        speakerSamples[speakerLabel] = {
          preview: preview,
          fullText: text,
          timestamp: segment.start,
          segmentCount: 1
        };
      } else if (speakerSamples[speakerLabel]) {
        speakerSamples[speakerLabel].segmentCount++;
      }
    });

    return speakerSamples;
  }, [results]);

  // ✅ CRITICAL: Highlighting based on LABELS (data-speaker), not names
  const applyHighlightToParagraphs = useCallback((speakerLabel) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) {
      console.warn('❌ Editor not available for highlighting');
      return;
    }

    editor.update();
    
    requestAnimationFrame(() => {
      const editorElement = editor.root;
      const paragraphs = editorElement.querySelectorAll('p');
      
      let highlightedCount = 0;
      const displayName = currentMappings[speakerLabel] || speakerLabel;
      
      console.log(`🔍 Highlighting speaker label: ${speakerLabel} (displayed as: ${displayName})`);
      console.log(`📊 Total paragraphs found: ${paragraphs.length}`);

      paragraphs.forEach((p, index) => {
        // ✅ CRITICAL: Match by LABEL (data-speaker attribute), not by name
        const dataSpeaker = p.getAttribute('data-speaker');
        
        if (index === 0) {
          console.log(`🔍 First paragraph data-speaker: "${dataSpeaker}"`);
        }
        
        const shouldHighlight = dataSpeaker === speakerLabel;
        
        if (shouldHighlight) {
          p.style.cssText = `
            background-color: #fef3c7 !important;
            padding: 8px !important;
            border-radius: 4px !important;
            border-left: 4px solid #fbbf24 !important;
            margin: 2px 0 !important;
            transition: all 0.3s ease !important;
          `;
          
          p.setAttribute('data-highlighted', 'true');
          p.setAttribute('data-highlighted-speaker', speakerLabel);
          
          const strong = p.querySelector('strong');
          if (strong) {
            strong.style.cssText = 'color: #78350f !important;';
          }
          
          highlightedCount++;
        } else {
          p.style.cssText = '';
          p.removeAttribute('data-highlighted');
          p.removeAttribute('data-highlighted-speaker');
          
          const strong = p.querySelector('strong');
          if (strong) {
            strong.style.cssText = 'color: #059669 !important;';
          }
        }
      });

      console.log(`✅ Successfully highlighted ${highlightedCount} segments for ${speakerLabel}`);
      
      if (highlightedCount === 0) {
        console.warn(`⚠️ No segments found for speaker label: ${speakerLabel}`);
      }
    });
  }, [currentMappings]);

  const removeAllHighlights = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    requestAnimationFrame(() => {
      const editorElement = editor.root;
      const paragraphs = editorElement.querySelectorAll('p');
      
      paragraphs.forEach((p) => {
        p.style.cssText = '';
        p.removeAttribute('data-highlighted');
        p.removeAttribute('data-highlighted-speaker');
        
        const strong = p.querySelector('strong');
        if (strong) {
          strong.style.cssText = 'color: #059669 !important;';
        }
      });
      
      console.log('✅ Removed all highlights');
    });
  }, []);

  const scrollToSpeaker = useCallback((speakerLabel) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    
    setTimeout(() => {
      const editorElement = editor.root;
      let targetParagraph = null;
      
      const segmentIndices = speakerSegmentMap[speakerLabel];
      if (segmentIndices && segmentIndices.length > 0) {
        const firstIndex = segmentIndices[0];
        targetParagraph = editorElement.querySelector(`p[data-segment-index="${firstIndex}"]`);
      }
      
      if (!targetParagraph) {
        targetParagraph = editorElement.querySelector(`p[data-speaker="${speakerLabel}"]`);
      }
      
      if (targetParagraph) {
        targetParagraph.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        console.log(`📍 Scrolled to speaker: ${speakerLabel}`);
      }
    }, 150);
  }, [speakerSegmentMap]);

  const highlightSpeaker = useCallback((speakerLabel) => {
    console.log(`🎯 Highlight requested for label: ${speakerLabel}`);
    
    if (highlightedSpeaker === speakerLabel) {
      setHighlightedSpeaker(null);
      removeAllHighlights();
      toast.success('Highlight cleared');
      return;
    }

    setHighlightedSpeaker(speakerLabel);
    
    const displayName = currentMappings[speakerLabel] || speakerLabel;
    
    const applyWithRetry = (retryCount = 0) => {
      applyHighlightToParagraphs(speakerLabel);
      
      if (retryCount < 3) {
        setTimeout(() => {
          applyWithRetry(retryCount + 1);
        }, 150);
      }
    };
    
    setTimeout(() => {
      applyWithRetry();
      scrollToSpeaker(speakerLabel);
      toast.success(`Highlighting: ${displayName}`);
    }, 100);
  }, [highlightedSpeaker, currentMappings, applyHighlightToParagraphs, removeAllHighlights, scrollToSpeaker]);

  const generateLiveContent = useCallback(() => {
    const segments = results?.results?.segments || results?.segments || [];
    
    if (segments.length === 0) {
      return '<p>No transcript available</p>';
    }

    let htmlContent = '';

    segments.forEach((segment, index) => {
      const speakerLabel = segment.speaker; // SPEAKER_00, etc. (IMMUTABLE)
      const displayName = currentMappings[speakerLabel] || speakerLabel; // Alice, Bob, etc. (MUTABLE)
      const text = segment.text || '';
      const start = segment.start || 0;
      const end = segment.end || 0;

      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      const timeStamp = `[${formatTime(start)} - ${formatTime(end)}]`;
      
      // ✅ CRITICAL: data-speaker = LABEL, <strong> = NAME
      htmlContent += `<p data-speaker="${speakerLabel}" data-segment-index="${index}"><span style="color: #6b7280; font-size: 0.875rem; font-family: monospace;">${timeStamp}</span> <strong style="color: #059669;">${displayName}:</strong> ${text}</p>`;
    });

    return htmlContent;
  }, [results, currentMappings]);

  // ✅ CRITICAL FIX: Restore data attributes after Quill processes HTML
  const updateQuillContent = useCallback((newContent) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    
    isProgrammaticUpdateRef.current = true;
    
    try {
      const currentSelection = editor.getSelection();
      
      try {
        const delta = editor.clipboard.convert(newContent);
        editor.setContents(delta, 'silent');
      } catch (e) {
        editor.setText('');
        editor.clipboard.dangerouslyPasteHTML(0, newContent);
      }
      
      // ✅ CRITICAL FIX: Restore data attributes after Quill processes the HTML
      setTimeout(() => {
        const segments = results?.results?.segments || results?.segments || [];
        const editorElement = editor.root;
        const paragraphs = editorElement.querySelectorAll('p');
        
        let restoredCount = 0;
        paragraphs.forEach((p, index) => {
          if (segments[index]) {
            const speakerLabel = segments[index].speaker;
            p.setAttribute('data-speaker', speakerLabel);
            p.setAttribute('data-segment-index', index.toString());
            restoredCount++;
          }
        });
        
        console.log(`✅ Restored data attributes to ${restoredCount} paragraphs`);
      }, 50);
      
      if (currentSelection) {
        try {
          const newLength = editor.getLength();
          const safeIndex = Math.min(currentSelection.index, Math.max(0, newLength - 1));
          editor.setSelection(safeIndex, 0);
        } catch (e) {
          // Ignore
        }
      }
    } catch (error) {
      console.error('Error updating Quill:', error);
    }
    
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
      
      if (highlightedSpeaker) {
        setTimeout(() => {
          applyHighlightToParagraphs(highlightedSpeaker);
        }, 150); // Increased delay to allow attributes to be set
      }
    }, 200);
  }, [highlightedSpeaker, applyHighlightToParagraphs, results]);

  const getCurrentContent = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      return editor.root.innerHTML;
    }
    return generateLiveContent();
  }, [generateLiveContent]);

  // Content regeneration when mappings change
  useEffect(() => {
    const mappingsString = JSON.stringify(currentMappings);
    
    if (!isInitialized || mappingsString === lastMappingsRef.current) {
      if (lastMappingsRef.current === '{}' && Object.keys(currentMappings).length > 0) {
        lastMappingsRef.current = mappingsString;
      }
      return;
    }
    
    if (isSavingRef.current || isRefreshingFromDBRef.current) {
      console.log('⏭️ Skipping regeneration - save/refresh in progress');
      lastMappingsRef.current = mappingsString;
      return;
    }
    
    console.log('🔄 Speaker mappings changed, regenerating content...');
    console.log('Old mappings:', JSON.parse(lastMappingsRef.current || '{}'));
    console.log('New mappings:', currentMappings);
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const newContent = generateLiveContent();
      
      console.log('✅ Content regenerated with new speaker names');
      
      updateQuillContent(newContent);
      setOriginalContent(newContent);
      
      lastMappingsRef.current = mappingsString;
      
      if (highlightedSpeaker) {
        setTimeout(() => {
          console.log('🔄 Re-applying highlights after name change...');
          applyHighlightToParagraphs(highlightedSpeaker);
        }, 300);
      }
    }, 100);
  }, [currentMappings, isInitialized, generateLiveContent, updateQuillContent, highlightedSpeaker, applyHighlightToParagraphs]);

  useEffect(() => {
    if (isInitialized && originalContent && quillRef.current?.getEditor()) {
      updateQuillContent(originalContent);
    }
  }, [isInitialized, originalContent, updateQuillContent]);

  useEffect(() => {
    if (!highlightedSpeaker || !isInitialized) {
      if (highlightObserverRef.current) {
        highlightObserverRef.current.disconnect();
        highlightObserverRef.current = null;
      }
      return;
    }
    
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    
    if (highlightObserverRef.current) {
      highlightObserverRef.current.disconnect();
    }
    
    const observer = new MutationObserver((mutations) => {
      const needsReapply = mutations.some(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target;
          if (target.nodeType === 1 && target.tagName === 'P') {
            const isHighlighted = target.getAttribute('data-highlighted') === 'true';
            if (isHighlighted && !target.style.backgroundColor) {
              return true;
            }
          }
        }
        return false;
      });
      
      if (needsReapply) {
        console.log('🔄 Reapplying highlights due to DOM changes');
        setTimeout(() => {
          applyHighlightToParagraphs(highlightedSpeaker);
        }, 50);
      }
    });
    
    observer.observe(editor.root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    highlightObserverRef.current = observer;
    
    return () => {
      if (highlightObserverRef.current) {
        highlightObserverRef.current.disconnect();
        highlightObserverRef.current = null;
      }
    };
  }, [highlightedSpeaker, isInitialized, applyHighlightToParagraphs]);

  const handleInputChange = useCallback((speakerLabel, newValue) => {
    console.log(`📝 Input change: ${speakerLabel} → "${newValue}"`);
    
    setInputFieldValues(prev => ({
      ...prev,
      [speakerLabel]: newValue
    }));
    
    if (newValue && newValue.trim()) {
      setValidationErrors(prev => {
        if (!prev[speakerLabel]) return prev;
        const updated = { ...prev };
        delete updated[speakerLabel];
        return updated;
      });
      
      setCurrentMappings(prev => {
        const updated = {
          ...prev,
          [speakerLabel]: newValue.trim()
        };
        console.log('✅ Updated mappings:', updated);
        return updated;
      });
      
      if (!isSavingRef.current && !isRefreshingFromDBRef.current) {
        setHasUnsavedChanges(true);
      }
    } else {
      setValidationErrors(prev => ({
        ...prev,
        [speakerLabel]: 'Speaker name cannot be empty'
      }));
    }
  }, []);

  const handleEditorChange = useCallback((content, delta, source, editor) => {
    if (isProgrammaticUpdateRef.current) {
      return;
    }
    
    if (source === 'user') {
      setOriginalContent(content);
      if (!isSavingRef.current && !isRefreshingFromDBRef.current) {
        setHasUnsavedChanges(true);
      }
    }
  }, []);

  // ✅ CRITICAL: Parse HTML and extract LABELS from data-speaker, not names from <strong>
  const parseHtmlToSegments = useCallback((htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const paragraphs = tempDiv.querySelectorAll('p');
    
    const segments = [];
    const originalSegments = results?.results?.segments || results?.segments || [];
    
    paragraphs.forEach((p, index) => {
      // ✅ CRITICAL: Get the LABEL from data-speaker (SPEAKER_00, SPEAKER_01, etc.)
      const speakerLabel = p.getAttribute('data-speaker');
      
      const text = p.textContent || '';
      
      const timestampMatch = text.match(/\[(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\]/);
      
      let start = 0;
      let end = 0;
      let speaker = speakerLabel || 'SPEAKER_UNKNOWN'; // ✅ Always use the LABEL
      let segmentText = text;
      
      if (timestampMatch) {
        const startMin = parseInt(timestampMatch[1]);
        const startSec = parseInt(timestampMatch[2]);
        const endMin = parseInt(timestampMatch[3]);
        const endSec = parseInt(timestampMatch[4]);
        
        start = startMin * 60 + startSec;
        end = endMin * 60 + endSec;
        
        const afterTimestamp = text.substring(timestampMatch[0].length).trim();
        const speakerMatch = afterTimestamp.match(/^([^:]+):\s*(.*)$/);
        
        if (speakerMatch) {
          // ✅ CRITICAL: Extract only the TEXT, not the displayed name
          // The speaker label is already from data-speaker attribute
          segmentText = speakerMatch[2].trim();
        }
      } else if (originalSegments[index]) {
        // Fallback to original segment
        start = originalSegments[index].start;
        end = originalSegments[index].end;
        speaker = originalSegments[index].speaker; // ✅ Use original label
      }
      
      // ✅ CRITICAL: Ensure we have a valid label
      if (!speaker || speaker === 'SPEAKER_UNKNOWN') {
        if (originalSegments[index]) {
          speaker = originalSegments[index].speaker;
        }
      }
      
      if (segmentText) {
        segments.push({
          speaker: speaker, // ✅ This is ALWAYS the LABEL (SPEAKER_00, etc.), NEVER the name
          text: segmentText,
          start,
          end
        });
      }
    });
    
    console.log('📦 Parsed segments with labels:', segments.map(s => ({ label: s.speaker, text: s.text.substring(0, 30) })));
    
    return segments;
  }, [results]);

  const saveChanges = useCallback(async () => {
    if (!currentSessionId) {
      toast.error('No active session to save');
      return;
    }

    const errors = {};
    const emptyFields = [];
    
    Object.entries(inputFieldValues).forEach(([speakerLabel, value]) => {
      if (!value || !value.trim()) {
        errors[speakerLabel] = 'Speaker name cannot be empty';
        emptyFields.push(speakerLabel);
      }
    });

    if (emptyFields.length > 0) {
      setValidationErrors(errors);
      toast.error(`Please provide names for: ${emptyFields.join(', ')}`);
      return;
    }

    const finalMappings = {};
    Object.entries(inputFieldValues).forEach(([speakerLabel, value]) => {
      if (value && value.trim()) {
        finalMappings[speakerLabel] = value.trim();
      }
    });

    setValidationErrors({});
    setIsSaving(true);
    isSavingRef.current = true;
    
    try {
      const currentContent = getCurrentContent();
      const updatedSegments = parseHtmlToSegments(currentContent);
      
      console.log('💾 Saving to database:');
      console.log('  - Segments:', updatedSegments.length);
      console.log('  - Mappings:', finalMappings);
      console.log('  - First segment label:', updatedSegments[0]?.speaker);
      
      const response = await backendApi.transcripts.update(currentSessionId, {
        segments: updatedSegments, // ✅ Contains labels, not names
        speaker_mappings: finalMappings // ✅ Contains label → name mapping
      });
      
      if (response.data.success) {
        setCurrentMappings(finalMappings);
        setInputFieldValues(finalMappings);
        lastMappingsRef.current = JSON.stringify(finalMappings);
        setHasUnsavedChanges(false);
        
        isSavingRef.current = false;
        
        toast.success(`Changes saved successfully`);
        
        // ✅ CRITICAL: Reload fresh data from database
        isRefreshingFromDBRef.current = true;
        
        console.log('🔄 Reloading transcript from database...');
        
        const refreshTranscript = useAppStore.getState().selectTranscript;
        if (refreshTranscript) {
          await refreshTranscript(currentSessionId);
        }
        
        setTimeout(() => {
          isRefreshingFromDBRef.current = false;
          console.log('✅ Database reload complete - ready for next edit');
        }, 1000);
      } else {
        throw new Error('Save operation returned unsuccessful status');
      }
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(error.userMessage || 'Failed to save changes to database');
      isSavingRef.current = false;
      isRefreshingFromDBRef.current = false;
    } finally {
      setIsSaving(false);
    }
  }, [currentSessionId, inputFieldValues, getCurrentContent, parseHtmlToSegments]);

  const copyAsPlainText = useCallback(async () => {
    try {
      const currentContent = getCurrentContent();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [getCurrentContent]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (highlightObserverRef.current) {
        highlightObserverRef.current.disconnect();
      }
    };
  }, []);

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  }), []);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline', 'color', 'background'
  ], []);

  useEffect(() => {
    if (quillRef.current && isInitialized) {
      const editor = quillRef.current.getEditor();
      if (editor) {
        const quillContainer = editor.container;
        const editorElement = quillContainer.querySelector('.ql-editor');
        const containerElement = quillContainer.querySelector('.ql-container');
        
        if (editorElement && containerElement) {
          containerElement.style.height = '100%';
          containerElement.style.maxHeight = '100%';
          containerElement.style.overflow = 'hidden';
          containerElement.style.display = 'flex';
          containerElement.style.flexDirection = 'column';
          
          editorElement.style.flex = '1';
          editorElement.style.height = '0';
          editorElement.style.minHeight = '0';
          editorElement.style.maxHeight = '100%';
          editorElement.style.overflowY = 'auto';
          editorElement.style.overflowX = 'hidden';
          editorElement.style.scrollBehavior = 'smooth';
          editorElement.style.padding = '20px';
          editorElement.style.boxSizing = 'border-box';
        }
      }
    }
  }, [isInitialized]);

  if (!hasActiveSession && !hasSegments && Object.keys(currentMappings).length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 h-full flex flex-col items-center justify-center">
        <Edit3 className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">Live Transcript Editor</h3>
        <p className="text-gray-500 text-center">
          {currentSessionId 
            ? 'Loading transcript data...' 
            : 'Process an audio file to start editing your transcript with live speaker name mapping.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Transcript Editor</h2>
            <p className="text-xs text-gray-500 mt-1">Session: {currentSessionId?.slice(0, 8)}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={copyAsPlainText}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span>Copy</span>
            </button>
            
            <button
              onClick={saveChanges}
              disabled={!hasUnsavedChanges || isSaving}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasUnsavedChanges && !isSaving
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save to Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-b border-gray-200">
        <div className="p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Speaker Names (This Transcript Only)
            </h4>
            <span className="text-xs text-gray-500">
              {Object.keys(currentMappings).length} speaker{Object.keys(currentMappings).length !== 1 ? 's' : ''} detected
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            {Object.entries(inputFieldValues).map(([speakerLabel, currentValue]) => (
              <div key={`speaker-${speakerLabel}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    {speakerLabel}
                  </label>
                  <button
                    onClick={() => highlightSpeaker(speakerLabel)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-300 ${
                      highlightedSpeaker === speakerLabel
                        ? 'bg-yellow-300 text-yellow-900 hover:bg-yellow-400'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{
                      backgroundColor: highlightedSpeaker === speakerLabel ? '#fcd34d' : '#f3f4f6'
                    }}
                    title="Find and highlight this speaker in transcript"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <span>{highlightedSpeaker === speakerLabel ? '✓ Active' : 'Find'}</span>
                  </button>
                </div>
                
                {speakerSamples[speakerLabel] && (
                  <div 
                    className={`border rounded-lg p-3 mb-2 transition-all duration-300 ${
                      highlightedSpeaker === speakerLabel 
                        ? 'bg-yellow-100 border-yellow-400 shadow-md' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                    style={{
                      backgroundColor: highlightedSpeaker === speakerLabel ? '#fef3c7' : '#eff6ff',
                      borderColor: highlightedSpeaker === speakerLabel ? '#fbbf24' : '#bfdbfe'
                    }}
                  >
                    <p className={`text-xs italic leading-relaxed ${
                      highlightedSpeaker === speakerLabel ? 'text-yellow-900 font-semibold' : 'text-blue-900'
                    }`}>
                      "{speakerSamples[speakerLabel].preview}"
                    </p>
                    <div className={`flex items-center justify-between mt-2 text-xs ${
                      highlightedSpeaker === speakerLabel ? 'text-yellow-800 font-medium' : 'text-blue-600'
                    }`}>
                      <span>{speakerSamples[speakerLabel].segmentCount} segments</span>
                      <span>First at {Math.floor(speakerSamples[speakerLabel].timestamp)}s</span>
                    </div>
                    {highlightedSpeaker === speakerLabel && (
                      <div className="mt-2 pt-2 border-t border-yellow-300">
                        <p className="text-xs text-yellow-800 font-semibold">🔍 Currently highlighted</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="relative">
                  <input
                    type="text"
                    value={currentValue || ''}
                    onChange={(e) => handleInputChange(speakerLabel, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-colors ${
                      validationErrors[speakerLabel]
                        ? 'border-red-300 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Enter speaker name..."
                  />
                  {validationErrors[speakerLabel] && (
                    <div className="absolute right-2 top-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                </div>
                {validationErrors[speakerLabel] && (
                  <p className="text-xs text-red-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {validationErrors[speakerLabel]}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex-1 min-w-64 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-medium mb-1">
                ❌ Fix before saving:
              </p>
              <ul className="text-xs text-red-600 space-y-1">
                {Object.entries(validationErrors).map(([speaker, error]) => (
                  <li key={speaker}>• {speaker}: {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden h-full">
        <div className="flex-1 p-4 overflow-hidden h-full">
          <div className="h-full overflow-hidden">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              onChange={handleEditorChange}
              modules={modules}
              formats={formats}
              style={{
                height: 'calc(160vh - 900px)',
                maxHeight: 'calc(160vh - 900px)',
                minHeight: '600px'
              }}
              className="smooth-scroll-editor"
            />
          </div>
        </div>
        
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <span>Speakers: {Object.keys(currentMappings).length}</span>
            <span>•</span>
            <span>{hasUnsavedChanges ? 'Unsaved Changes' : 'Saved to Database'}</span>
            {Object.keys(validationErrors).length > 0 && (
              <>
                <span>•</span>
                <span className="text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {Object.keys(validationErrors).length} error{Object.keys(validationErrors).length !== 1 ? 's' : ''}
                </span>
              </>
            )}
            {highlightedSpeaker && (
              <>
                <span>•</span>
                <span className="text-yellow-700 flex items-center">
                  🔍 Highlighting: {currentMappings[highlightedSpeaker] || highlightedSpeaker}
                </span>
              </>
            )}
          </div>
          
          {hasUnsavedChanges && (
            <div className="flex items-center space-x-2 text-orange-600">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span>Unsaved changes</span>
            </div>
          )}
          
          {isSaving && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving to database...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
});

LiveTranscriptEditor.displayName = 'LiveTranscriptEditor';

export default LiveTranscriptEditor;