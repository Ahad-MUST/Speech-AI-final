# speechbrain_engine.py - Fixed SpeechBrain Speaker Diarization Engine

import torch
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple
import librosa
import soundfile as sf
import tempfile
import os
import warnings
import logging
from sklearn.cluster import AgglomerativeClustering
import time
import shutil

# Configure logging
logging.basicConfig(level=logging.WARNING)
warnings.filterwarnings("ignore")
logging.getLogger("speechbrain").setLevel(logging.ERROR)

class SpeechBrainEngine:
    """
    Fixed SpeechBrain Speaker Diarization Engine
    """
    
    SEGMENT_LENGTH = 1.5
    SEGMENT_SHIFT = 0.5
    MIN_DURATION = 1.0
    MIN_SEGMENT_DURATION = 0.3
    EMBEDDING_SIZE = 192
    ENERGY_THRESHOLD = 1e-4
    
    def __init__(self, device: str = "auto"):
        self.device = "cpu"  # Force CPU on Mac
        self.temp_files: List[str] = []
        self.embedding_model = None
        self.vad_model = None
        
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize SpeechBrain models with Windows symlink fix"""
        try:
            import speechbrain
            from speechbrain.pretrained import EncoderClassifier
            
            print("Loading SpeechBrain models...")
            
            # Find cached model
            hf_cache_dir = os.environ.get('HF_HOME', os.path.join(os.path.expanduser('~'), '.cache', 'huggingface'))
            cached_model_path = os.path.join(hf_cache_dir, 'hub', 'models--speechbrain--spkrec-ecapa-voxceleb')
            
            cached_snapshot = None
            if os.path.exists(cached_model_path):
                snapshots_dir = os.path.join(cached_model_path, 'snapshots')
                if os.path.exists(snapshots_dir):
                    snapshots = [d for d in os.listdir(snapshots_dir) if os.path.isdir(os.path.join(snapshots_dir, d))]
                    if snapshots:
                        cached_snapshot = os.path.join(snapshots_dir, snapshots[0])
                        print(f"Found cached model at: {cached_snapshot}")
            
            # Copy files instead of symlinking
            if cached_snapshot and os.path.exists(cached_snapshot):
                try:
                    # Create a local copy directory
                    local_model_dir = os.path.join(os.getcwd(), 'speechbrain_local_model')
                    
                    # Only copy if not already copied
                    if not os.path.exists(local_model_dir) or len(os.listdir(local_model_dir)) == 0:
                        print(f"Copying model files to avoid symlink issues...")
                        if os.path.exists(local_model_dir):
                            shutil.rmtree(local_model_dir)
                        shutil.copytree(cached_snapshot, local_model_dir)
                        print(f"✅ Model files copied to: {local_model_dir}")
                    else:
                        print(f"Using existing local model at: {local_model_dir}")
                    
                    # Load from the copied directory
                    self.embedding_model = EncoderClassifier.from_hparams(
                        source=local_model_dir,
                        run_opts={"device": "cpu"}
                    )
                    print("✅ SpeechBrain model loaded successfully!")
                    self.vad_model = None
                    return
                    
                except Exception as e:
                    print(f"Failed to load copied model: {e}")
                    # Clean up failed copy
                    if os.path.exists(local_model_dir):
                        try:
                            shutil.rmtree(local_model_dir)
                        except:
                            pass
            
            # If we get here, all methods failed
            print("❌ All loading methods failed")
            self.embedding_model = None
            self.vad_model = None
                
        except ImportError:
            raise ImportError("SpeechBrain not installed. Run: pip install speechbrain==0.5.16")
        except Exception as e:
            print(f"SpeechBrain initialization failed: {e}")
            self.embedding_model = None
            self.vad_model = None
        
    def diarize_audio(
        self, 
        audio_path: Union[str, Path],
        num_speakers: Optional[int] = None,
        min_speakers: int = 1,
        max_speakers: int = 10
    ) -> Dict:
        """Perform speaker diarization with robust error handling"""
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        start_time = time.time()
        
        try:
            if self.embedding_model is None:
                # Use energy-based fallback
                return self._energy_based_diarization(audio_path, num_speakers, max_speakers)
            
            # Full SpeechBrain processing
            processed_audio_path = self._preprocess_audio(audio_path)
            embeddings, timestamps, voice_activity = self._extract_embeddings(processed_audio_path)
            cluster_labels = self._perform_clustering(embeddings, voice_activity, num_speakers, max_speakers)
            segments = self._create_segments(cluster_labels, timestamps)
            segments = self._postprocess_segments(segments)
            
            speakers = sorted(set(seg['speaker'] for seg in segments))
            speaker_stats = self._calculate_speaker_stats(segments)
            
            processing_time = time.time() - start_time
            total_duration = max([seg['end'] for seg in segments]) if segments else 0
            
            return {
                'segments': segments,
                'speakers': speakers,
                'timeline': segments,  # Add timeline for compatibility
                'num_speakers': len(speakers),
                'total_duration': total_duration,
                'speaker_stats': speaker_stats,
                'metadata': {
                    'file_name': audio_path.name,
                    'processing_time': processing_time,
                    'num_speakers_detected': len(speakers),
                    'engine': 'speechbrain_fixed',
                    'embedding_model': 'spkrec-ecapa-voxceleb',
                    'vad_available': False
                }
            }
            
        except Exception as e:
            print(f"SpeechBrain processing failed, using fallback: {e}")
            return self._energy_based_diarization(audio_path, num_speakers, max_speakers)
        finally:
            self._cleanup_temp_files()
    
    def _energy_based_diarization(self, audio_path: Path, num_speakers: Optional[int], max_speakers: int) -> Dict:
        """Energy-based fallback diarization"""
        try:
            start_time = time.time()
            audio_data, sr = librosa.load(str(audio_path), sr=16000, mono=True)
            duration = len(audio_data) / sr
            
            # Simple energy-based segmentation
            window_size = int(0.5 * sr)
            hop_size = int(0.25 * sr)
            
            segments = []
            current_speaker = 0
            
            for i in range(0, len(audio_data) - window_size, hop_size):
                window = audio_data[i:i + window_size]
                energy = np.sum(window ** 2)
                
                start_time_seg = i / sr
                end_time_seg = (i + window_size) / sr
                
                if energy > np.mean(audio_data ** 2):
                    speaker_id = f"SPEAKER_{current_speaker % 2}"
                    
                    segments.append({
                        'start': start_time_seg,
                        'end': end_time_seg,
                        'speaker': speaker_id,
                        'duration': end_time_seg - start_time_seg
                    })
                    
                    current_speaker += 1
            
            # Merge consecutive segments
            merged_segments = self._merge_segments(segments)
            speakers = sorted(set(seg['speaker'] for seg in merged_segments))
            speaker_stats = self._calculate_speaker_stats(merged_segments)
            
            processing_time = time.time() - start_time
            
            return {
                'segments': merged_segments,
                'speakers': speakers,
                'timeline': merged_segments,
                'num_speakers': len(speakers),
                'duration': duration,
                'speaker_stats': speaker_stats,
                'metadata': {
                    'file_name': audio_path.name,
                    'processing_time': processing_time,
                    'num_speakers_detected': len(speakers),
                    'engine': 'energy_based_fallback',
                    'note': 'Using energy-based fallback'
                }
            }
            
        except Exception as e:
            raise RuntimeError(f"Fallback diarization failed: {e}")
    
    def _merge_segments(self, segments: List[Dict]) -> List[Dict]:
        """Merge consecutive segments from same speaker"""
        if not segments:
            return []
        
        merged = []
        current_seg = segments[0].copy()
        
        for seg in segments[1:]:
            if (seg['speaker'] == current_seg['speaker'] and 
                seg['start'] - current_seg['end'] < 0.5):
                current_seg['end'] = seg['end']
                current_seg['duration'] = current_seg['end'] - current_seg['start']
            else:
                merged.append(current_seg)
                current_seg = seg.copy()
        
        merged.append(current_seg)
        return merged
    
    def _preprocess_audio(self, audio_path: Path) -> str:
        """Preprocess audio for SpeechBrain processing"""
        try:
            audio_data, _ = librosa.load(str(audio_path), sr=16000, mono=True, res_type='kaiser_fast')
            
            if len(audio_data) / 16000 < self.MIN_DURATION:
                target_length = int(self.MIN_DURATION * 16000)
                audio_data = np.pad(audio_data, (0, target_length - len(audio_data)), mode='constant')
            
            if np.max(np.abs(audio_data)) > 0:
                audio_data = audio_data / np.max(np.abs(audio_data)) * 0.95
            
            temp_fd, temp_path = tempfile.mkstemp(suffix='.wav', prefix='speechbrain_')
            os.close(temp_fd)
            sf.write(temp_path, audio_data, 16000, subtype='PCM_16')
            
            self.temp_files.append(temp_path)
            return temp_path
            
        except Exception as e:
            raise RuntimeError(f"Audio preprocessing failed: {e}")
    
    def _extract_embeddings(self, audio_path: str) -> Tuple[np.ndarray, List[float], List[bool]]:
        """Extract speaker embeddings with error handling"""
        try:
            audio_data, sr = librosa.load(audio_path, sr=16000)
            frame_samples = int(self.SEGMENT_LENGTH * sr)
            shift_samples = int(self.SEGMENT_SHIFT * sr)
            
            embeddings = []
            timestamps = []
            voice_activity = []
            
            for start_sample in range(0, len(audio_data) - frame_samples + 1, shift_samples):
                end_sample = start_sample + frame_samples
                frame = audio_data[start_sample:end_sample]
                start_time = start_sample / sr
                
                has_voice = self._detect_voice_activity(frame)
                voice_activity.append(has_voice)
                
                if has_voice and self.embedding_model:
                    try:
                        embedding = self._extract_embedding(frame)
                    except Exception:
                        embedding = np.random.randn(self.EMBEDDING_SIZE) * 0.1
                else:
                    embedding = np.zeros(self.EMBEDDING_SIZE)
                
                embeddings.append(embedding)
                timestamps.append(start_time)
            
            if not embeddings:
                raise ValueError("No embeddings extracted from audio")
            
            return np.vstack(embeddings), timestamps, voice_activity
            
        except Exception as e:
            raise RuntimeError(f"Embedding extraction failed: {e}")
    
    def _detect_voice_activity(self, audio_frame: np.ndarray) -> bool:
        """Detect voice activity using energy threshold"""
        return np.mean(audio_frame ** 2) > self.ENERGY_THRESHOLD
    
    def _extract_embedding(self, audio_frame: np.ndarray) -> np.ndarray:
        """Extract speaker embedding from audio frame"""
        try:
            audio_tensor = torch.tensor(audio_frame).unsqueeze(0).to(self.device)
            with torch.no_grad():
                embedding = self.embedding_model.encode_batch(audio_tensor)
                return embedding.squeeze().cpu().numpy()
        except Exception:
            return np.random.randn(self.EMBEDDING_SIZE) * 0.1
    
    def _perform_clustering(
        self, 
        embeddings: np.ndarray, 
        voice_activity: List[bool],
        num_speakers: Optional[int],
        max_speakers: int
    ) -> np.ndarray:
        """Perform speaker clustering"""
        try:
            # Filter embeddings for voiced segments
            voiced_embeddings = []
            voiced_indices = []
            
            for i, (embedding, has_voice) in enumerate(zip(embeddings, voice_activity)):
                if has_voice and embedding is not None:
                    voiced_embeddings.append(embedding)
                    voiced_indices.append(i)
            
            if len(voiced_embeddings) == 0:
                return np.zeros(len(embeddings), dtype=int)
            
            voiced_embeddings = np.array(voiced_embeddings)
            
            # Normalize embeddings
            norms = np.linalg.norm(voiced_embeddings, axis=1, keepdims=True)
            norms[norms == 0] = 1
            voiced_embeddings_norm = voiced_embeddings / norms
            
            # Determine number of clusters
            if num_speakers is not None:
                n_clusters = num_speakers
            else:
                n_clusters = self._estimate_speakers(voiced_embeddings_norm, max_speakers)
            
            # Perform clustering
            if n_clusters == 1 or len(voiced_embeddings) < n_clusters:
                voiced_labels = np.zeros(len(voiced_embeddings), dtype=int)
            else:
                clustering = AgglomerativeClustering(
                    n_clusters=n_clusters,
                    metric='cosine',
                    linkage='average'
                )
                voiced_labels = clustering.fit_predict(voiced_embeddings_norm)
            
            # Map labels back to all frames
            all_labels = np.full(len(embeddings), -1, dtype=int)
            for voiced_idx, label in zip(voiced_indices, voiced_labels):
                all_labels[voiced_idx] = label
            
            # Fill non-voiced segments
            self._fill_nonvoiced_labels(all_labels)
            
            # Ensure consecutive numbering
            unique_labels = np.unique(all_labels[all_labels >= 0])
            label_mapping = {old_label: new_label for new_label, old_label in enumerate(unique_labels)}
            
            for i in range(len(all_labels)):
                if all_labels[i] >= 0:
                    all_labels[i] = label_mapping[all_labels[i]]
            
            return all_labels
            
        except Exception as e:
            print(f"Clustering failed: {e}")
            return np.zeros(len(embeddings), dtype=int)
    
    def _estimate_speakers(self, embeddings: np.ndarray, max_speakers: int) -> int:
        """Estimate optimal number of speakers"""
        try:
            from sklearn.metrics import silhouette_score
            
            if len(embeddings) < 4:
                return 1
            
            max_clusters = min(max_speakers, len(embeddings) // 2)
            best_score = -1
            best_n_clusters = 1
            
            for n_clusters in range(2, max_clusters + 1):
                try:
                    clustering = AgglomerativeClustering(
                        n_clusters=n_clusters,
                        metric='cosine',
                        linkage='average'
                    )
                    labels = clustering.fit_predict(embeddings)
                    score = silhouette_score(embeddings, labels, metric='cosine')
                    
                    if score > best_score:
                        best_score = score
                        best_n_clusters = n_clusters
                except Exception:
                    continue
            
            return best_n_clusters
            
        except ImportError:
            return min(2, max_speakers)
        except Exception:
            return 1

    def _fill_nonvoiced_labels(self, labels: np.ndarray):
        """Fill non-voiced segments with nearest voiced segment labels"""
        voiced_indices = np.where(labels >= 0)[0]
        
        if len(voiced_indices) == 0:
            labels[:] = 0
            return
        
        for i in range(len(labels)):
            if labels[i] == -1:
                distances = np.abs(voiced_indices - i)
                nearest_idx = voiced_indices[np.argmin(distances)]
                labels[i] = labels[nearest_idx]

    def _create_segments(self, cluster_labels: np.ndarray, timestamps: List[float]) -> List[Dict]:
        """Convert cluster labels to segments"""
        if len(cluster_labels) == 0:
            return []
        
        segments = []
        current_speaker = cluster_labels[0]
        segment_start = timestamps[0]
        
        for i in range(1, len(cluster_labels)):
            if cluster_labels[i] != current_speaker:
                segment_end = timestamps[i-1] + self.SEGMENT_LENGTH
                
                segments.append({
                    'start': segment_start,
                    'end': segment_end,
                    'speaker': f"SPEAKER_{current_speaker:02d}",
                    'duration': segment_end - segment_start
                })
                
                current_speaker = cluster_labels[i]
                segment_start = timestamps[i]
        
        # Add final segment
        final_end = timestamps[-1] + self.SEGMENT_LENGTH
        segments.append({
            'start': segment_start,
            'end': final_end,
            'speaker': f"SPEAKER_{current_speaker:02d}",
            'duration': final_end - segment_start
        })
        
        return segments

    def _postprocess_segments(self, segments: List[Dict]) -> List[Dict]:
        """Post-process segments to remove short segments and merge consecutive ones"""
        if not segments:
            return segments
        
        # Remove very short segments
        filtered_segments = [seg for seg in segments if seg['duration'] >= self.MIN_SEGMENT_DURATION]
        
        if not filtered_segments:
            segments.sort(key=lambda x: x['duration'], reverse=True)
            filtered_segments = segments[:max(1, len(segments) // 2)]
        
        # Merge consecutive segments from same speaker
        merged_segments = []
        for segment in filtered_segments:
            if (merged_segments and 
                merged_segments[-1]['speaker'] == segment['speaker'] and
                abs(merged_segments[-1]['end'] - segment['start']) < 0.2):
                # Merge with previous segment
                merged_segments[-1]['end'] = segment['end']
                merged_segments[-1]['duration'] = merged_segments[-1]['end'] - merged_segments[-1]['start']
            else:
                merged_segments.append(segment)
        
        return merged_segments

    def _calculate_speaker_stats(self, segments: List[Dict]) -> Dict:
        """Calculate statistics for each speaker"""
        speaker_stats = {}
        total_duration = sum(seg['duration'] for seg in segments)
        
        for segment in segments:
            speaker = segment['speaker']
            if speaker not in speaker_stats:
                speaker_stats[speaker] = {
                    'segments': 0,
                    'total_duration': 0,
                    'percentage': 0
                }
            
            speaker_stats[speaker]['segments'] += 1
            speaker_stats[speaker]['total_duration'] += segment['duration']
        
        # Calculate percentages
        for speaker, stats in speaker_stats.items():
            stats['percentage'] = (stats['total_duration'] / total_duration * 100) if total_duration > 0 else 0
        
        return speaker_stats
    
    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except OSError:
                pass
        self.temp_files.clear()