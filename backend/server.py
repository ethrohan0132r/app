from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import shutil
import json
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="YouTube Shorts Automation Server")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class VideoStatus(str, Enum):
    UPLOADED = "uploaded"
    PENDING = "pending" 
    COMPLETED = "completed"
    FAILED = "failed"

class ScheduleInterval(str, Enum):
    IMMEDIATELY = "immediately"
    THIRTY_MIN = "30m"
    ONE_HOUR = "1h"
    THREE_HOUR = "3h"

# Models
class VideoUpload(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_path: str
    file_size: int
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    status: VideoStatus = VideoStatus.UPLOADED
    metadata_id: Optional[str] = None
    sequence_number: Optional[int] = None

class VideoMetadata(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    hashtags: List[str]
    created_date: datetime = Field(default_factory=datetime.utcnow)
    is_used: bool = False
    sequence_number: Optional[int] = None

class VideoMetadataCreate(BaseModel):
    title: str
    description: str
    hashtags: List[str]

class UploadQueue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_id: str
    metadata_id: str
    schedule_interval: ScheduleInterval
    scheduled_time: datetime
    status: VideoStatus = VideoStatus.PENDING
    created_date: datetime = Field(default_factory=datetime.utcnow)

class UploadQueueCreate(BaseModel):
    video_id: str
    metadata_id: str
    schedule_interval: ScheduleInterval

class DashboardStats(BaseModel):
    total_videos: int
    completed: int
    pending: int
    unused_metadata: int

# Helper functions
def calculate_scheduled_time(interval: ScheduleInterval) -> datetime:
    now = datetime.utcnow()
    if interval == ScheduleInterval.IMMEDIATELY:
        return now
    elif interval == ScheduleInterval.THIRTY_MIN:
        return now + timedelta(minutes=30)
    elif interval == ScheduleInterval.ONE_HOUR:
        return now + timedelta(hours=1)
    elif interval == ScheduleInterval.THREE_HOUR:
        return now + timedelta(hours=3)
    return now

# API Routes

@api_router.get("/")
async def root():
    return {"message": "YouTube Shorts Automation Server API"}

# Dashboard Stats
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    total_videos = await db.videos.count_documents({})
    completed = await db.upload_queue.count_documents({"status": VideoStatus.COMPLETED})
    pending = await db.upload_queue.count_documents({"status": VideoStatus.PENDING})
    unused_metadata = await db.metadata.count_documents({"is_used": False})
    
    return DashboardStats(
        total_videos=total_videos,
        completed=completed,
        pending=pending,
        unused_metadata=unused_metadata
    )

# Video Upload
@api_router.post("/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    # Check file extension
    allowed_extensions = ['.mp4', '.mov', '.avi']
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only MP4, MOV, AVI files allowed")
    
    # Check file size (2GB limit)
    file_size = 0
    file_content = await file.read()
    file_size = len(file_content)
    if file_size > 2 * 1024 * 1024 * 1024:  # 2GB
        raise HTTPException(status_code=400, detail="File size exceeds 2GB limit")
    
    # Save file
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    # Save to database
    video_data = VideoUpload(
        filename=file.filename,
        file_path=str(file_path),
        file_size=file_size
    )
    
    await db.videos.insert_one(video_data.dict())
    return {"message": "Video uploaded successfully", "video_id": video_data.id}

# Get all videos
@api_router.get("/videos", response_model=List[VideoUpload])
async def get_videos():
    videos = await db.videos.find().to_list(1000)
    return [VideoUpload(**video) for video in videos]

# Metadata Management
@api_router.post("/metadata", response_model=VideoMetadata)
async def create_metadata(metadata: VideoMetadataCreate):
    metadata_obj = VideoMetadata(**metadata.dict())
    await db.metadata.insert_one(metadata_obj.dict())
    return metadata_obj

@api_router.post("/metadata/bulk")
async def bulk_create_metadata(metadata_list: List[VideoMetadataCreate]):
    metadata_objects = [VideoMetadata(**metadata.dict()) for metadata in metadata_list]
    metadata_dicts = [metadata.dict() for metadata in metadata_objects]
    await db.metadata.insert_many(metadata_dicts)
    return {"message": f"Created {len(metadata_objects)} metadata entries"}

@api_router.get("/metadata", response_model=List[VideoMetadata])
async def get_metadata():
    metadata = await db.metadata.find().to_list(1000)
    return [VideoMetadata(**meta) for meta in metadata]

@api_router.get("/metadata/unused", response_model=List[VideoMetadata])
async def get_unused_metadata():
    metadata = await db.metadata.find({"is_used": False}).to_list(1000)
    return [VideoMetadata(**meta) for meta in metadata]

# Upload Queue Management
@api_router.post("/queue", response_model=UploadQueue)
async def create_upload_queue(queue_item: UploadQueueCreate):
    # Check if video and metadata exist
    video = await db.videos.find_one({"id": queue_item.video_id})
    metadata = await db.metadata.find_one({"id": queue_item.metadata_id})
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not metadata:
        raise HTTPException(status_code=404, detail="Metadata not found")
    
    scheduled_time = calculate_scheduled_time(queue_item.schedule_interval)
    
    queue_obj = UploadQueue(
        video_id=queue_item.video_id,
        metadata_id=queue_item.metadata_id,
        schedule_interval=queue_item.schedule_interval,
        scheduled_time=scheduled_time
    )
    
    await db.upload_queue.insert_one(queue_obj.dict())
    
    # Mark metadata as used
    await db.metadata.update_one(
        {"id": queue_item.metadata_id},
        {"$set": {"is_used": True}}
    )
    
    return queue_obj

@api_router.get("/queue", response_model=List[UploadQueue])
async def get_upload_queue():
    queue_items = await db.upload_queue.find().sort("scheduled_time", 1).to_list(1000)
    return [UploadQueue(**item) for item in queue_items]

@api_router.get("/queue/pending", response_model=List[UploadQueue])
async def get_pending_uploads():
    queue_items = await db.upload_queue.find({"status": VideoStatus.PENDING}).sort("scheduled_time", 1).to_list(1000)
    return [UploadQueue(**item) for item in queue_items]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()