# services/tailscale_service.py - Tailscale Integration Service

import subprocess
import logging

logger = logging.getLogger(__name__)

class TailscaleManager:
    def get_tailscale_ip(self):
        """Get this machine's Tailscale IP"""
        try:
            result = subprocess.run(["tailscale", "ip", "-4"], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception as e:
            logger.error(f"Failed to get Tailscale IP: {e}")
        return None
    
    def is_connected(self):
        """Check if Tailscale is connected"""
        try:
            result = subprocess.run(["tailscale", "status"], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0 and "logged out" not in result.stdout.lower()
        except Exception:
            return False