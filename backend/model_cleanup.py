# Model cleanup utility for handling corrupted model files

import os
import logging
import glob
from logging.handlers import RotatingFileHandler

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('model_cleanup.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def cleanup_model_files():
    """Remove all model files to force fresh training"""
    try:
        # Define patterns for files to remove
        patterns = [
            '*.joblib',
            '*.pkl',
            'xgb_model.*',
            'mlp_model.*'
        ]
        
        removed_files = []
        
        for pattern in patterns:
            files = glob.glob(pattern)
            for file in files:
                if os.path.isfile(file):
                    os.remove(file)
                    removed_files.append(file)
                    logger.info(f"Removed model file: {file}")
        
        return {"success": True, "removed_files": removed_files, "count": len(removed_files)}
    
    except Exception as e:
        logger.exception("Error cleaning up model files")
        return {"success": False, "error": str(e)}

# This function can be called directly from the Flask route
def handle_cleanup_request():
    """Handler for cleanup API request"""
    return cleanup_model_files()

if __name__ == "__main__":
    result = cleanup_model_files()
    print(result)
