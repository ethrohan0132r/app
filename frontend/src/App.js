import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [stats, setStats] = useState({
    total_videos: 0,
    completed: 0,
    pending: 0,
    unused_metadata: 0
  });
  const [videos, setVideos] = useState([]);
  const [metadata, setMetadata] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [apiConfig, setApiConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch videos
  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API}/videos`);
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  // Fetch metadata
  const fetchMetadata = async () => {
    try {
      const response = await axios.get(`${API}/metadata`);
      setMetadata(response.data);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  // Fetch upload queue
  const fetchQueue = async () => {
    try {
      const response = await axios.get(`${API}/queue`);
      setUploadQueue(response.data);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  // Fetch API configuration
  const fetchApiConfig = async () => {
    try {
      const response = await axios.get(`${API}/config/api`);
      setApiConfig(response.data);
    } catch (error) {
      console.error('Error fetching API config:', error);
      setApiConfig(null);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchVideos();
    fetchMetadata();
    fetchQueue();
  }, []);

  // Video Upload Component
  const VideoUpload = () => {
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      } else if (e.type === "dragleave") {
        setDragActive(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
      }
    };

    const handleChange = (e) => {
      e.preventDefault();
      if (e.target.files && e.target.files[0]) {
        handleFiles(e.target.files);
      }
    };

    const handleFiles = async (files) => {
      setLoading(true);
      setUploadProgress(0);
      
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          await axios.post(`${API}/videos/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            }
          });
        } catch (error) {
          console.error('Upload error:', error);
          alert('Upload failed: ' + (error.response?.data?.detail || error.message));
        }
      }
      
      setLoading(false);
      setUploadProgress(0);
      fetchStats();
      fetchVideos();
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upload Video</h3>
        <p className="text-sm text-gray-600 mb-4">Upload a video file to queue for YouTube Shorts upload</p>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="text-4xl text-gray-400">📁</div>
            <div>
              <p className="text-lg font-medium">Choose video file or drag and drop</p>
              <p className="text-sm text-gray-500">MP4, MOV, AVI files up to 2GB</p>
            </div>
            
            <input
              type="file"
              multiple
              accept=".mp4,.mov,.avi"
              onChange={handleChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Upload Video
            </label>
            
            {loading && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Metadata Form Component
  const MetadataForm = () => {
    const [formData, setFormData] = useState({
      title: '',
      description: '',
      hashtags: ''
    });
    const [bulkMetadata, setBulkMetadata] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        const hashtags = formData.hashtags.split(',').map(tag => tag.trim());
        await axios.post(`${API}/metadata`, {
          title: formData.title,
          description: formData.description,
          hashtags: hashtags
        });
        
        setFormData({ title: '', description: '', hashtags: '' });
        fetchStats();
        fetchMetadata();
        alert('Metadata added successfully!');
      } catch (error) {
        console.error('Error adding metadata:', error);
        alert('Failed to add metadata');
      }
      
      setLoading(false);
    };

    const handleBulkSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        const metadataList = JSON.parse(bulkMetadata);
        await axios.post(`${API}/metadata/bulk`, metadataList);
        
        setBulkMetadata('');
        fetchStats();
        fetchMetadata();
        alert('Bulk metadata added successfully!');
      } catch (error) {
        console.error('Error adding bulk metadata:', error);
        alert('Failed to add bulk metadata. Check JSON format.');
      }
      
      setLoading(false);
    };

    return (
      <div className="space-y-6">
        {/* Single Metadata Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Add Single Metadata</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags (comma separated)</label>
              <input
                type="text"
                value={formData.hashtags}
                onChange={(e) => setFormData({...formData, hashtags: e.target.value})}
                placeholder="#viral, #shorts, #trending"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Metadata'}
            </button>
          </form>
        </div>

        {/* Bulk Metadata Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Bulk Add Metadata</h3>
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JSON Data</label>
              <textarea
                value={bulkMetadata}
                onChange={(e) => setBulkMetadata(e.target.value)}
                rows="8"
                placeholder={`[
  {
    "title": "Amazing Video 1",
    "description": "This is description 1",
    "hashtags": ["viral", "shorts", "trending"]
  },
  {
    "title": "Amazing Video 2", 
    "description": "This is description 2",
    "hashtags": ["funny", "shorts", "viral"]
  }
]`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Bulk Add Metadata'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Schedule Component
  const ScheduleComponent = () => {
    const [selectedVideo, setSelectedVideo] = useState('');
    const [selectedMetadata, setSelectedMetadata] = useState('');
    const [scheduleInterval, setScheduleInterval] = useState('immediately');

    const handleSchedule = async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        await axios.post(`${API}/queue`, {
          video_id: selectedVideo,
          metadata_id: selectedMetadata,
          schedule_interval: scheduleInterval
        });
        
        setSelectedVideo('');
        setSelectedMetadata('');
        setScheduleInterval('immediately');
        fetchStats();
        fetchQueue();
        alert('Video scheduled successfully!');
      } catch (error) {
        console.error('Error scheduling video:', error);
        alert('Failed to schedule video');
      }
      
      setLoading(false);
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Schedule Upload</h3>
        <form onSubmit={handleSchedule} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Video</label>
            <select
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Choose a video...</option>
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.filename}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Metadata</label>
            <select
              value={selectedMetadata}
              onChange={(e) => setSelectedMetadata(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Choose metadata...</option>
              {metadata.filter(meta => !meta.is_used).map((meta) => (
                <option key={meta.id} value={meta.id}>
                  {meta.title}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <select
              value={scheduleInterval}
              onChange={(e) => setScheduleInterval(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="immediately">Upload Immediately</option>
              <option value="30m">Upload in 30 minutes</option>
              <option value="1h">Upload in 1 hour</option>
              <option value="3h">Upload in 3 hours</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Scheduling...' : 'Schedule Upload'}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">YouTube Shorts Automation Server</h1>
              <p className="text-sm text-gray-600">Automated YouTube Shorts uploader with Google Sheets integration</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total_videos}</div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Total Videos</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Completed</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Pending</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="text-3xl font-bold text-purple-600">{stats.unused_metadata}</div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Unused Metadata</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'upload', label: 'Upload' },
                { id: 'metadata', label: 'Metadata' },
                { id: 'schedule', label: 'Schedule' },
                { id: 'queue', label: 'Queue' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'upload' && <VideoUpload />}
          {activeTab === 'metadata' && <MetadataForm />}
          {activeTab === 'schedule' && <ScheduleComponent />}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Queue</h3>
              <div className="space-y-4">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Video ID: {item.video_id}</p>
                        <p className="text-sm text-gray-600">Scheduled: {new Date(item.scheduled_time).toLocaleString()}</p>
                        <p className="text-sm text-gray-600">Interval: {item.schedule_interval}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </div>
                ))}
                {uploadQueue.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No uploads in queue</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;