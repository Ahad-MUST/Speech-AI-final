// src/components/transcription/AudioPlayer.jsx - FIXED Play/Pause Button Visibility
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AudioPlayer = forwardRef(({ audioUrl, sessionId, onTimeUpdate, onLoadedMetadata, onError }, ref) => {
  // Audio element ref
  const audioRef = useRef(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);
  
  // Track pending seek operations
  const pendingSeekRef = useRef(null);
  const currentSessionRef = useRef(sessionId);
  const hasLoadedMetadataRef = useRef(false);
  
  // Track if we're currently seeking
  const isSeekingRef = useRef(false);
  
  // ✅ CRITICAL: Reset everything when session or URL changes
  useEffect(() => {
    console.log('🎵 Audio source changed:', {
      sessionId,
      audioUrl: audioUrl?.substring(0, 50) + '...',
      previousSession: currentSessionRef.current
    });
    
    // Check if session actually changed
    const sessionChanged = currentSessionRef.current !== sessionId;
    
    if (sessionChanged) {
      console.log('🔄 Session changed, resetting player state');
      
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // Reset all state
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(true);
      setLoadError(null);
      setCanPlay(false);
      hasLoadedMetadataRef.current = false;
      pendingSeekRef.current = null;
      isSeekingRef.current = false;
      
      // Update session tracking
      currentSessionRef.current = sessionId;
    }
    
    // Force audio element to reload
    if (audioRef.current && audioUrl) {
      console.log('🔄 Reloading audio element');
      audioRef.current.load();
    }
    
  }, [sessionId, audioUrl]);
  
  // ✅ Handle metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    
    const audioDuration = audioRef.current.duration;
    
    console.log('✅ Audio metadata loaded:', {
      duration: audioDuration,
      sessionId: currentSessionRef.current
    });
    
    setDuration(audioDuration);
    setIsLoading(false);
    setCanPlay(true);
    hasLoadedMetadataRef.current = true;
    
    if (onLoadedMetadata) {
      onLoadedMetadata(audioDuration);
    }
    
    // If there's a pending seek, execute it now
    if (pendingSeekRef.current !== null) {
      const seekTime = pendingSeekRef.current;
      console.log('⏩ Executing pending seek to:', seekTime);
      pendingSeekRef.current = null;
      
      // Use setTimeout to ensure audio is fully ready
      setTimeout(() => {
        performSeek(seekTime);
      }, 100);
    }
  }, [onLoadedMetadata]);
  
  // ✅ Handle can play through (audio is buffered enough)
  const handleCanPlayThrough = useCallback(() => {
    console.log('✅ Audio can play through');
    setCanPlay(true);
    setIsLoading(false);
  }, []);
  
  // ✅ Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || isSeekingRef.current) return;
    
    const time = audioRef.current.currentTime;
    setCurrentTime(time);
    
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
  }, [onTimeUpdate]);
  
  // ✅ Handle play/pause events from audio element
  const handlePlay = useCallback(() => {
    console.log('▶️ Audio playing');
    setIsPlaying(true);
  }, []);
  
  const handlePause = useCallback(() => {
    console.log('⏸️ Audio paused');
    setIsPlaying(false);
  }, []);
  
  const handleEnded = useCallback(() => {
    console.log('⏹️ Audio ended');
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);
  
  // ✅ Handle errors
  const handleError = useCallback((e) => {
    const error = audioRef.current?.error;
    let errorMessage = 'Failed to load audio file';
    let shouldShowToast = true;
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Audio loading aborted';
          shouldShowToast = false; // User action, don't show error
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading audio';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'Audio decoding failed';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          // This often happens when audio isn't ready yet, not a real error
          errorMessage = 'Audio not available yet';
          shouldShowToast = false; // Don't spam user with this
          console.log('ℹ️ Audio source not supported (may not be ready yet)');
          break;
        default:
          errorMessage = 'Unknown audio error';
      }
    }
    
    console.error('❌ Audio error:', errorMessage, error);
    setLoadError(errorMessage);
    setIsLoading(false);
    setCanPlay(false);
    
    // Only show toast for real errors, not "not ready yet" situations
    if (shouldShowToast) {
      toast.error(errorMessage);
    }
    
    if (onError) {
      onError(errorMessage);
    }
  }, [onError]);
  
  // ✅ Handle waiting (buffering)
  const handleWaiting = useCallback(() => {
    console.log('⏳ Audio buffering...');
    setIsLoading(true);
  }, []);
  
  const handlePlaying = useCallback(() => {
    console.log('▶️ Audio playing after buffer');
    setIsLoading(false);
  }, []);
  
  // ✅ Attach all event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, [
    handleLoadedMetadata,
    handleCanPlayThrough,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleEnded,
    handleError,
    handleWaiting,
    handlePlaying
  ]);
  
  // ✅ CRITICAL: Perform seek operation safely
  const performSeek = useCallback((time) => {
    if (!audioRef.current) {
      console.warn('⚠️ Cannot seek: audio element not ready');
      return false;
    }
    
    // Validate time
    const seekTime = Math.max(0, Math.min(duration || Infinity, time));
    
    console.log('⏩ Seeking to:', seekTime);
    
    try {
      isSeekingRef.current = true;
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      
      // Clear seeking flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
      
      return true;
    } catch (error) {
      console.error('❌ Seek failed:', error);
      isSeekingRef.current = false;
      return false;
    }
  }, [duration]);
  
  // ✅ Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      console.log('🎯 seekTo called:', {
        time,
        canPlay,
        hasMetadata: hasLoadedMetadataRef.current,
        isLoading
      });
      
      // If audio is ready, seek immediately
      if (canPlay && hasLoadedMetadataRef.current && !isLoading) {
        return performSeek(time);
      } else {
        // Otherwise, store as pending
        console.log('⏳ Audio not ready, storing pending seek');
        pendingSeekRef.current = time;
        return false;
      }
    },
    
    play: async () => {
      if (!audioRef.current) {
        console.warn('⚠️ Cannot play: audio element not ready');
        return;
      }
      
      try {
        await audioRef.current.play();
        console.log('▶️ Play initiated');
      } catch (error) {
        console.error('❌ Play failed:', error);
        toast.error('Failed to play audio');
      }
    },
    
    pause: () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      console.log('⏸️ Pause initiated');
    },
    
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    isReady: () => canPlay && hasLoadedMetadataRef.current && !isLoading,
    isPlaying: () => isPlaying
  }), [canPlay, isLoading, currentTime, duration, isPlaying, performSeek]);
  
  // ✅ Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !canPlay) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('❌ Toggle play/pause failed:', error);
      toast.error('Playback error');
    }
  }, [isPlaying, canPlay]);
  
  // ✅ Handle seek via progress bar
  const handleSeek = useCallback((e) => {
    const seekTime = parseFloat(e.target.value);
    performSeek(seekTime);
  }, [performSeek]);
  
  // ✅ Handle volume change
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  }, []);
  
  // ✅ Toggle mute
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      const newVolume = volume || 0.5;
      audioRef.current.volume = newVolume;
      setIsMuted(false);
      setVolume(newVolume);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);
  
  // ✅ Skip forward/backward
  const skip = useCallback((seconds) => {
    const newTime = currentTime + seconds;
    performSeek(newTime);
  }, [currentTime, performSeek]);
  
  // ✅ Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };
  
  // ✅ Don't render if no audio URL
  if (!audioUrl) {
    return null;
  }
  
  // ✅ Show error state ONLY for real errors (not "not ready yet")
  if (loadError && loadError !== 'Audio not available yet') {
    return (
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{loadError}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border-t border-gray-200 shadow-lg">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />

      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Skip Back Button */}
          <button
            onClick={() => skip(-10)}
            disabled={!canPlay || isLoading}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip back 10s"
          >
            <SkipBack className="w-5 h-5 text-gray-700" />
          </button>

          {/* ✅ FIXED: Play/Pause Button with solid teal background and visible icons */}
          <button
            onClick={togglePlayPause}
            disabled={!canPlay || isLoading}
            className="p-3 bg-teal-500 hover:bg-teal-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 text-white fill-white" />
            ) : (
              <Play className="w-6 h-6 text-white fill-white" />
            )}
          </button>

          {/* Skip Forward Button */}
          <button
            onClick={() => skip(10)}
            disabled={!canPlay || isLoading}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip forward 10s"
          >
            <SkipForward className="w-5 h-5 text-gray-700" />
          </button>

          {/* Time Display */}
          <div className="text-sm text-gray-600 font-medium w-24 text-center">
            {formatTime(currentTime)}
          </div>

          {/* Progress Bar */}
          <div className="flex-1 mx-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={!canPlay || isLoading}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (!canPlay || isLoading)
                  ? '#e5e7eb'
                  : `linear-gradient(to right, #2DD4BF ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%)`
              }}
            />
          </div>

          {/* Duration Display */}
          <div className="text-sm text-gray-600 font-medium w-24 text-center">
            {formatTime(duration)}
          </div>

          {/* Volume Control */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-gray-700" />
            ) : (
              <Volume2 className="w-5 h-5 text-gray-700" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2DD4BF ${(isMuted ? 0 : volume) * 100}%, #e5e7eb ${(isMuted ? 0 : volume) * 100}%)`
            }}
          />
        </div>
        
        {/* Status indicator */}
        {isLoading && (
          <div className="mt-2 text-center text-xs text-gray-500">
            Loading audio...
          </div>
        )}
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;