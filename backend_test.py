import requests
import sys
import json
import io
from datetime import datetime

class YouTubeShortsAPITester:
    def __init__(self, base_url="https://auto-yt-creator-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_video_id = None
        self.created_metadata_id = None
        self.created_queue_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        if data and not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            required_fields = ['total_videos', 'completed', 'pending', 'unused_metadata']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field: {field}")
                    return False
            print(f"   Stats: Videos={response.get('total_videos')}, Completed={response.get('completed')}, Pending={response.get('pending')}, Unused Metadata={response.get('unused_metadata')}")
        return success

    def test_video_upload(self):
        """Test video upload with a dummy file"""
        # Create a small dummy video file
        dummy_video_content = b"dummy video content for testing"
        files = {
            'file': ('test_video.mp4', io.BytesIO(dummy_video_content), 'video/mp4')
        }
        
        success, response = self.run_test(
            "Video Upload",
            "POST",
            "videos/upload",
            200,
            files=files
        )
        
        if success and 'video_id' in response:
            self.created_video_id = response['video_id']
            print(f"   Created video ID: {self.created_video_id}")
        
        return success

    def test_get_videos(self):
        """Test getting all videos"""
        success, response = self.run_test(
            "Get All Videos",
            "GET",
            "videos",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} videos")
            if len(response) > 0:
                print(f"   Sample video: {response[0].get('filename', 'N/A')}")
        
        return success

    def test_create_metadata(self):
        """Test creating single metadata"""
        metadata_data = {
            "title": "Test Video Title",
            "description": "This is a test video description for YouTube Shorts automation",
            "hashtags": ["test", "automation", "shorts", "youtube"]
        }
        
        success, response = self.run_test(
            "Create Single Metadata",
            "POST",
            "metadata",
            200,
            data=metadata_data
        )
        
        if success and 'id' in response:
            self.created_metadata_id = response['id']
            print(f"   Created metadata ID: {self.created_metadata_id}")
        
        return success

    def test_bulk_create_metadata(self):
        """Test bulk metadata creation"""
        bulk_metadata = [
            {
                "title": "Bulk Video 1",
                "description": "First bulk video description",
                "hashtags": ["bulk1", "test", "shorts"]
            },
            {
                "title": "Bulk Video 2", 
                "description": "Second bulk video description",
                "hashtags": ["bulk2", "test", "viral"]
            }
        ]
        
        success, response = self.run_test(
            "Bulk Create Metadata",
            "POST",
            "metadata/bulk",
            200,
            data=bulk_metadata
        )
        
        return success

    def test_get_metadata(self):
        """Test getting all metadata"""
        success, response = self.run_test(
            "Get All Metadata",
            "GET",
            "metadata",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} metadata entries")
            if len(response) > 0:
                print(f"   Sample metadata: {response[0].get('title', 'N/A')}")
        
        return success

    def test_get_unused_metadata(self):
        """Test getting unused metadata"""
        success, response = self.run_test(
            "Get Unused Metadata",
            "GET",
            "metadata/unused",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} unused metadata entries")
        
        return success

    def test_create_upload_queue(self):
        """Test creating upload queue item"""
        if not self.created_video_id or not self.created_metadata_id:
            print("❌ Skipping queue test - missing video or metadata ID")
            return False
            
        queue_data = {
            "video_id": self.created_video_id,
            "metadata_id": self.created_metadata_id,
            "schedule_interval": "immediately"
        }
        
        success, response = self.run_test(
            "Create Upload Queue",
            "POST",
            "queue",
            200,
            data=queue_data
        )
        
        if success and 'id' in response:
            self.created_queue_id = response['id']
            print(f"   Created queue ID: {self.created_queue_id}")
        
        return success

    def test_get_upload_queue(self):
        """Test getting upload queue"""
        success, response = self.run_test(
            "Get Upload Queue",
            "GET",
            "queue",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} queue items")
            if len(response) > 0:
                print(f"   Sample queue item status: {response[0].get('status', 'N/A')}")
        
        return success

    def test_get_pending_uploads(self):
        """Test getting pending uploads"""
        success, response = self.run_test(
            "Get Pending Uploads",
            "GET",
            "queue/pending",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} pending uploads")
        
        return success

def main():
    print("🚀 Starting YouTube Shorts Automation Server API Tests")
    print("=" * 60)
    
    tester = YouTubeShortsAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_dashboard_stats,
        tester.test_video_upload,
        tester.test_get_videos,
        tester.test_create_metadata,
        tester.test_bulk_create_metadata,
        tester.test_get_metadata,
        tester.test_get_unused_metadata,
        tester.test_create_upload_queue,
        tester.test_get_upload_queue,
        tester.test_get_pending_uploads
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())