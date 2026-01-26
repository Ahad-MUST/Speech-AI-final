#!/usr/bin/env python3
"""
Database Initialization Script
This script sets up the SQLite database with initial data
"""

import os
import sys
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def main():
    """Initialize the database with tables and default data"""
    
    print("🚀 Initializing Speech Analysis Database...")
    print("=" * 50)
    
    try:
        # Import database components
        from database.models import DatabaseManager, AnalysisPrompt
        
        # Initialize database manager
        db_manager = DatabaseManager()
        
        # Create tables
        print("📋 Creating database tables...")
        db_manager.create_tables()
        print("✅ Tables created successfully")
        
        # Initialize default prompts
        print("📝 Initializing default prompts...")
        db_manager.init_default_prompts()
        print("✅ Default prompts initialized")
        
        # Verify setup
        print("🔍 Verifying database setup...")
        session = db_manager.get_session()
        try:
            prompt_count = session.query(AnalysisPrompt).count()
            active_count = session.query(AnalysisPrompt).filter(AnalysisPrompt.is_active == True).count()
            
            print(f"📊 Database Statistics:")
            print(f"   Total prompts: {prompt_count}")
            print(f"   Active prompts: {active_count}")
            
            # List all prompts
            prompts = session.query(AnalysisPrompt).all()
            print(f"📋 Available prompts:")
            for prompt in prompts:
                status = "🟢" if prompt.is_active else "🔴"
                system = "🔧" if prompt.is_system else "👤"
                print(f"   {status} {system} {prompt.key}: {prompt.title}")
                
        finally:
            session.close()
            
        print("=" * 50)
        print("✅ Database initialization completed successfully!")
        print(f"📁 Database file: {os.path.abspath('speech_analysis.db')}")
        print("🚀 You can now start the backend server")
        
    except ImportError as e:
        print(f"❌ Error importing database modules: {e}")
        print("💡 Please ensure all dependencies are installed:")
        print("   pip install sqlalchemy")
        sys.exit(1)
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()