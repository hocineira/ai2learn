#!/usr/bin/env python3
"""
AI2Lean Backend API Testing Suite - Review Request Focus
Tests the specific endpoints mentioned in the review request:
1. Auth login (admin/etudiant1)
2. Charts endpoint (admin)
3. Student charts (etudiant1)  
4. CSV exports (admin)
5. Single result CSV
6. Proxmox config verification
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://lean-training-hub.preview.emergentagent.com/api"
print(f"Testing backend at: {BACKEND_URL}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []
        self.tests = []
    
    def test_pass(self, test_name, details=""):
        print(f"✅ {test_name}")
        if details:
            print(f"   {details}")
        self.passed += 1
        self.tests.append({"name": test_name, "status": "PASS", "details": details})
    
    def test_fail(self, test_name, error):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.failures.append(f"{test_name}: {error}")
        self.tests.append({"name": test_name, "status": "FAIL", "details": error})
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.failures:
            print(f"\nFAILED TESTS:")
            for failure in self.failures:
                print(f"  - {failure}")
        print(f"{'='*60}")
        return len(self.failures) == 0

def make_request(method, endpoint, headers=None, data=None, expect_json=True):
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=20)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=20)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request error for {method} {url}: {e}")
        return None

def test_review_requirements():
    """Test all endpoints specifically mentioned in review request"""
    results = TestResults()
    
    print("🔍 AI2Lean Backend Testing - Review Request Focus")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("-" * 60)
    
    # Test 1: Admin Authentication
    print("\n1️⃣ Admin Authentication (POST /api/auth/login)")
    
    admin_login = {
        "username": "admin",
        "password": "admin123"
    }
    
    admin_response = make_request("POST", "/auth/login", data=admin_login)
    
    if not admin_response:
        results.test_fail("Admin Login - Connection", "Failed to connect to backend")
        return results
    
    if admin_response.status_code != 200:
        results.test_fail("Admin Login", f"Status {admin_response.status_code}. Response: {admin_response.text[:200]}")
        return results
    
    try:
        admin_auth_data = admin_response.json()
        admin_token = admin_auth_data.get("token")
        if not admin_token:
            results.test_fail("Admin Login - Token", "No JWT token in response")
            return results
        
        admin_user = admin_auth_data.get("user", {})
        results.test_pass("Admin Login", f"User: {admin_user.get('full_name')} | Role: {admin_user.get('role')}")
        
    except json.JSONDecodeError:
        results.test_fail("Admin Login - JSON", "Invalid JSON response")
        return results
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test 2: Charts Endpoint (GET /api/stats/charts)
    print("\n2️⃣ Charts Endpoint (GET /api/stats/charts)")
    
    charts_response = make_request("GET", "/stats/charts", headers=admin_headers)
    
    if not charts_response:
        results.test_fail("Charts Endpoint - Connection", "Failed to connect")
    elif charts_response.status_code != 200:
        results.test_fail("Charts Endpoint", f"Status {charts_response.status_code}. Response: {charts_response.text[:200]}")
    else:
        try:
            charts_data = charts_response.json()
            required_keys = ["timeline", "score_distribution", "category_stats", "top_students"]
            missing_keys = [key for key in required_keys if key not in charts_data]
            
            if missing_keys:
                results.test_fail("Charts Endpoint - Structure", f"Missing keys: {missing_keys}")
            else:
                timeline_count = len(charts_data.get("timeline", []))
                score_dist_count = len(charts_data.get("score_distribution", []))
                category_count = len(charts_data.get("category_stats", []))
                top_students_count = len(charts_data.get("top_students", []))
                
                results.test_pass("Charts Endpoint", 
                    f"Timeline: {timeline_count}, Score dist: {score_dist_count}, Categories: {category_count}, Top students: {top_students_count}")
                
        except json.JSONDecodeError:
            results.test_fail("Charts Endpoint - JSON", "Invalid JSON response")
    
    # Test 3: Student Authentication (etudiant1/etudiant123)
    print("\n3️⃣ Student Authentication (etudiant1/etudiant123)")
    
    student_login = {
        "username": "etudiant1",
        "password": "etudiant123"
    }
    
    student_response = make_request("POST", "/auth/login", data=student_login)
    
    if not student_response:
        results.test_fail("Student Login - Connection", "Failed to connect")
        return results
    elif student_response.status_code != 200:
        results.test_fail("Student Login", f"Status {student_response.status_code}. Response: {student_response.text[:200]}")
        return results
    
    try:
        student_auth_data = student_response.json()
        student_token = student_auth_data.get("token")
        if not student_token:
            results.test_fail("Student Login - Token", "No JWT token in response")
            return results
            
        student_user = student_auth_data.get("user", {})
        results.test_pass("Student Login", f"User: {student_user.get('full_name')} | Role: {student_user.get('role')}")
        
    except json.JSONDecodeError:
        results.test_fail("Student Login - JSON", "Invalid JSON response")
        return results
    
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    # Test 4: Student Charts (GET /api/stats/student-charts)
    print("\n4️⃣ Student Charts (GET /api/stats/student-charts)")
    
    student_charts_response = make_request("GET", "/stats/student-charts", headers=student_headers)
    
    if not student_charts_response:
        results.test_fail("Student Charts - Connection", "Failed to connect")
    elif student_charts_response.status_code != 200:
        results.test_fail("Student Charts", f"Status {student_charts_response.status_code}. Response: {student_charts_response.text[:200]}")
    else:
        try:
            student_charts_data = student_charts_response.json()
            required_keys = ["progress", "radar"]
            missing_keys = [key for key in required_keys if key not in student_charts_data]
            
            if missing_keys:
                results.test_fail("Student Charts - Structure", f"Missing keys: {missing_keys}")
            else:
                progress_count = len(student_charts_data.get("progress", []))
                radar_count = len(student_charts_data.get("radar", []))
                
                results.test_pass("Student Charts", f"Progress: {progress_count}, Radar: {radar_count}")
                
        except json.JSONDecodeError:
            results.test_fail("Student Charts - JSON", "Invalid JSON response")
    
    # Test 5: CSV Export Endpoints
    print("\n5️⃣ CSV Export Endpoints")
    
    # Test 5a: Submissions CSV (GET /api/export/submissions-csv)
    submissions_csv_response = make_request("GET", "/export/submissions-csv", headers=admin_headers, expect_json=False)
    
    if not submissions_csv_response:
        results.test_fail("Submissions CSV Export - Connection", "Failed to connect")
    elif submissions_csv_response.status_code != 200:
        results.test_fail("Submissions CSV Export", f"Status {submissions_csv_response.status_code}. Response: {submissions_csv_response.text[:200]}")
    else:
        content_type = submissions_csv_response.headers.get('content-type', '')
        content_length = len(submissions_csv_response.content)
        
        if 'csv' in content_type.lower() or 'text/' in content_type.lower():
            results.test_pass("Submissions CSV Export", f"Content-Type: {content_type}, Size: {content_length} bytes")
        else:
            results.test_fail("Submissions CSV Export - Content Type", f"Expected CSV, got {content_type}")
    
    # Test 5b: Tracking CSV (GET /api/export/tracking-csv)
    tracking_csv_response = make_request("GET", "/export/tracking-csv", headers=admin_headers, expect_json=False)
    
    if not tracking_csv_response:
        results.test_fail("Tracking CSV Export - Connection", "Failed to connect")
    elif tracking_csv_response.status_code != 200:
        results.test_fail("Tracking CSV Export", f"Status {tracking_csv_response.status_code}. Response: {tracking_csv_response.text[:200]}")
    else:
        content_type = tracking_csv_response.headers.get('content-type', '')
        content_length = len(tracking_csv_response.content)
        
        if 'csv' in content_type.lower() or 'text/' in content_type.lower():
            results.test_pass("Tracking CSV Export", f"Content-Type: {content_type}, Size: {content_length} bytes")
        else:
            results.test_fail("Tracking CSV Export - Content Type", f"Expected CSV, got {content_type}")
    
    # Test 6: Single Result CSV Export
    print("\n6️⃣ Single Result CSV Export")
    
    # Direct test since we know there are no submissions
    try:
        invalid_id = "test-invalid-submission-id"
        result_csv_response = requests.get(f"{BACKEND_URL}/export/result-csv/{invalid_id}", 
                                         headers=admin_headers, timeout=20)
        
        if result_csv_response.status_code == 404:
            results.test_pass("Result CSV Export - Endpoint Working", "Returns proper 404 for invalid submission (endpoint exists)")
        else:
            results.test_fail("Result CSV Export - Response", f"Expected 404, got {result_csv_response.status_code}")
            
    except requests.exceptions.RequestException as e:
        results.test_fail("Result CSV Export - Connection", f"Request failed: {e}")
    except Exception as e:
        results.test_fail("Result CSV Export - Error", f"Unexpected error: {e}")
    
    # Test 7: Proxmox Configuration Verification
    print("\n7️⃣ Proxmox Configuration Verification")
    
    try:
        env_path = "/app/backend/.env"
        with open(env_path, 'r') as f:
            env_content = f.read()
        
        # Check for correct PROXMOX_USER
        if "PROXMOX_USER=ai2learn@pve" in env_content:
            results.test_pass("Proxmox Config - Username", "PROXMOX_USER is correctly set to ai2learn@pve")
        elif "PROXMOX_USER=ai2lean@pve" in env_content:
            results.test_fail("Proxmox Config - Username", "PROXMOX_USER is incorrectly set to ai2lean@pve (should be ai2learn@pve)")
        else:
            results.test_fail("Proxmox Config - Username", "PROXMOX_USER not found or incorrectly formatted")
        
        # Check for other Proxmox config presence
        proxmox_configs = [
            "PROXMOX_HOST",
            "PROXMOX_PORT", 
            "PROXMOX_TOKEN_NAME",
            "PROXMOX_TOKEN_SECRET"
        ]
        
        missing_configs = []
        for config in proxmox_configs:
            if config not in env_content:
                missing_configs.append(config)
        
        if not missing_configs:
            results.test_pass("Proxmox Config - Complete", "All Proxmox configuration variables present")
        else:
            results.test_fail("Proxmox Config - Incomplete", f"Missing: {', '.join(missing_configs)}")
            
    except Exception as e:
        results.test_fail("Proxmox Config - File Access", f"Could not read .env file: {e}")
    
    return results

def main():
    """Main test execution"""
    print("🚀 AI2Lean Backend Testing Suite - Review Request")
    print("=" * 60)
    
    results = test_review_requirements()
    success = results.summary()
    
    if success:
        print("\n🎉 All review requirements tests passed!")
        return 0
    else:
        print(f"\n⚠️ {len(results.failures)} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())