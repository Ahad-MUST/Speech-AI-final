#!/usr/bin/env python3
"""
Migration script to add user_favorite_prompts table
Run this script to add the favorites functionality to your database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
# FIXED: Import UserFavoritePrompt from database.models instead of database.user_favorites_model
from database.models import Base, DatabaseManager, UserFavoritePrompt
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def check_table_exists(engine, table_name):
    """Check if a table exists in the database"""
    with engine.connect() as conn:
        # For SQLite
        if 'sqlite' in str(engine.url):
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"
            ), {"table_name": table_name})
        # For PostgreSQL
        elif 'postgresql' in str(engine.url):
            result = conn.execute(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :table_name)"
            ), {"table_name": table_name})
        # For MySQL
        else:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :table_name"
            ), {"table_name": table_name})
        
        return result.fetchone() is not None


def run_migration():
    """Run the migration to add user_favorite_prompts table"""
    try:
        # Initialize database manager
        db_manager = DatabaseManager()
        engine = db_manager.engine
        
        logger.info("Starting migration: Adding user_favorite_prompts table")
        
        # Check if table already exists
        if check_table_exists(engine, "user_favorite_prompts"):
            logger.warning("Table 'user_favorite_prompts' already exists. Skipping migration.")
            return True  # Return True since table exists (not an error)
        
        # Create the new table
        UserFavoritePrompt.__table__.create(engine)
        logger.info("✅ Successfully created 'user_favorite_prompts' table")
        
        # Verify the table was created
        if check_table_exists(engine, "user_favorite_prompts"):
            logger.info("✅ Verified: Table 'user_favorite_prompts' exists in database")
            
            # Display table structure for verification
            with engine.connect() as conn:
                if 'sqlite' in str(engine.url):
                    result = conn.execute(text("PRAGMA table_info(user_favorite_prompts)"))
                    columns = result.fetchall()
                    logger.info("Table columns:")
                    for col in columns:
                        logger.info(f"  - {col[1]} ({col[2]})")
        else:
            logger.error("❌ Failed to verify table creation")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        return False


def rollback_migration():
    """Rollback the migration (drop the table)"""
    try:
        db_manager = DatabaseManager()
        engine = db_manager.engine
        
        logger.info("Rolling back migration: Dropping user_favorite_prompts table")
        
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS user_favorite_prompts"))
            conn.commit()
            
        logger.info("✅ Successfully dropped 'user_favorite_prompts' table")
        return True
        
    except Exception as e:
        logger.error(f"❌ Rollback failed: {str(e)}")
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="User Favorites Migration")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback_migration()
    else:
        success = run_migration()
    
    sys.exit(0 if success else 1)