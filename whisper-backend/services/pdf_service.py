from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pathlib import Path
from typing import List, Dict, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class PDFGenerator:
    def __init__(self):
        self.page_width, self.page_height = letter
        self.margin = 50
        self.line_height = 20
    
    def generate_transcript_pdf(
        self, 
        segments: List[Dict], 
        metadata: Dict, 
        output_path: Path,
        filename: str
    ) -> bool:
        """Generate simple PDF from transcript segments"""
        try:
            # Create PDF canvas
            c = canvas.Canvas(str(output_path), pagesize=letter)
            
            # Add title and header info
            self._add_header(c, filename, metadata)
            
            # Add transcript content
            self._add_transcript_content(c, segments)
            
            # Save PDF
            c.save()
            
            logger.info(f"PDF generated successfully: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            return False
    
    def _add_header(self, canvas, filename: str, metadata: Dict):
        """Add header information to PDF"""
        y_position = self.page_height - self.margin
        
        # Title
        canvas.setFont("Helvetica-Bold", 16)
        canvas.drawString(self.margin, y_position, "Audio Transcription Report")
        y_position -= 30
        
        # File info
        canvas.setFont("Helvetica", 12)
        canvas.drawString(self.margin, y_position, f"File: {filename}")
        y_position -= 20
        
        canvas.drawString(self.margin, y_position, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        y_position -= 20
        
        # Duration and language if available
        if metadata:
            duration = metadata.get('audio_duration_seconds', 0)
            if duration:
                minutes = int(duration // 60)
                seconds = int(duration % 60)
                canvas.drawString(self.margin, y_position, f"Duration: {minutes}m {seconds}s")
                y_position -= 20
            
            language = metadata.get('language', 'Unknown')
            canvas.drawString(self.margin, y_position, f"Language: {language}")
        
        # Add separator line
        y_position -= 30
        canvas.line(self.margin, y_position, self.page_width - self.margin, y_position)
        
        return y_position - 20
    
    def _add_transcript_content(self, canvas, segments: List[Dict]):
        """Add transcript segments to PDF"""
        y_position = self.page_height - 150  # Start below header
        canvas.setFont("Helvetica", 10)
        
        for segment in segments:
            # Check if we need a new page
            if y_position < self.margin + 40:
                canvas.showPage()
                canvas.setFont("Helvetica", 10)
                y_position = self.page_height - self.margin
            
            # Format timestamp
            start_time = segment.get('start', 0)
            end_time = segment.get('end', 0)
            speaker = segment.get('speaker', 'Unknown')
            text = segment.get('text', '').strip()
            
            if not text:
                continue
                
            # Convert seconds to mm:ss format
            start_min, start_sec = divmod(int(start_time), 60)
            end_min, end_sec = divmod(int(end_time), 60)
            timestamp = f"[{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}]"
            
            # Draw timestamp and speaker
            canvas.setFont("Helvetica-Bold", 10)
            header_text = f"{timestamp} {speaker}:"
            canvas.drawString(self.margin, y_position, header_text)
            y_position -= 15
            
            # Draw text content (handle long text wrapping)
            canvas.setFont("Helvetica", 10)
            wrapped_text = self._wrap_text(text, self.page_width - 2 * self.margin - 20)
            
            for line in wrapped_text:
                if y_position < self.margin + 20:
                    canvas.showPage()
                    canvas.setFont("Helvetica", 10)
                    y_position = self.page_height - self.margin
                
                canvas.drawString(self.margin + 20, y_position, line)
                y_position -= 12
            
            y_position -= 10  # Add space between segments
    
    def _wrap_text(self, text: str, max_width: float) -> List[str]:
        """Simple text wrapping for PDF"""
        words = text.split()
        lines = []
        current_line = []
        
        for word in words:
            test_line = ' '.join(current_line + [word])
            # Rough estimation: 6 pixels per character
            if len(test_line) * 6 < max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
        
        if current_line:
            lines.append(' '.join(current_line))
        
        return lines