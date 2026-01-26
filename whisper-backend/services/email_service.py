import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from pathlib import Path
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = "smtp.gmail.com"
        self.smtp_port = 587
        self.email = os.getenv("GMAIL_EMAIL")
        self.password = os.getenv("GMAIL_APP_PASSWORD")
        self.from_name = os.getenv("EMAIL_FROM_NAME", "Audio Transcription Service")
        
        if not self.email or not self.password:
            logger.error("Gmail credentials not configured in environment variables")
    
    async def send_completion_email(
        self, 
        to_email: str, 
        session_id: str, 
        filename: str,
        pdf_path: Optional[Path] = None
    ) -> bool:
        """Send transcription completion email with optional PDF attachment"""
        try:
            logger.info(f"Sending completion email for session {session_id} to {to_email}")
            
            # Create message
            msg = MIMEMultipart()
            msg['Subject'] = f"Audio Transcription Complete - {filename}"
            msg['From'] = f"{self.from_name} <{self.email}>"
            msg['To'] = to_email
            
            # Email body
            body = self._create_email_body(filename, session_id)
            msg.attach(MIMEText(body, 'html'))
            
            # Attach PDF if available
            if pdf_path and pdf_path.exists():
                try:
                    with open(pdf_path, 'rb') as f:
                        pdf_attachment = MIMEApplication(f.read(), _subtype='pdf')
                        pdf_attachment.add_header(
                            'Content-Disposition', 
                            'attachment', 
                            filename=f"transcript_{filename}.pdf"
                        )
                        msg.attach(pdf_attachment)
                    logger.info(f"PDF attached: {pdf_path}")
                except Exception as e:
                    logger.error(f"Failed to attach PDF: {e}")
                    # Continue without attachment
            
            # Send email
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.email, self.password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    async def send_text_only_email(self, to_email: str, session_id: str, filename: str) -> bool:
        """Fallback: send email without PDF attachment"""
        try:
            logger.info(f"Sending text-only email for session {session_id} to {to_email}")
            
            msg = MIMEText(self._create_simple_email_body(filename, session_id))
            msg['Subject'] = f"Audio Transcription Complete - {filename}"
            msg['From'] = f"{self.from_name} <{self.email}>"
            msg['To'] = to_email
            
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.email, self.password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Text-only email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send text-only email: {e}")
            return False
    
    def _create_email_body(self, filename: str, session_id: str) -> str:
        """Create HTML email body"""
        return f"""
        <html>
        <body>
            <h2>🎉 Your Audio Transcription is Ready!</h2>
            
           
            <p><strong>Completed:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p><strong>Session ID:</strong> {session_id}</p>
            
            <p>Your audio file has been successfully transcribed. Please find the transcript attached as a PDF.</p>
            
            <hr>
            <p><small>This is an automated message from Audio Transcription Service.</small></p>
        </body>
        </html>
        """
    
    def _create_simple_email_body(self, filename: str, session_id: str) -> str:
        """Create simple text email body for fallback"""
        return f"""
Your Audio Transcription is Ready!

File: {filename}
Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Session ID: {session_id}

Your audio file has been successfully transcribed. 
Please check the platform to view your results.

Results will be available for the next 2-3 hours.

---
This is an automated message from Audio Transcription Service.
        """

# Global instance
email_service = EmailService()