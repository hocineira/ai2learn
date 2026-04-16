#!/usr/bin/env python3
"""
AI2Lean Backend API Testing Script
Tests image upload, course CRUD with images, and LLM settings endpoints
"""

import requests
import json
import os
import tempfile
from PIL import Image
import io

# Configuration
BASE_URL = "https://salut-check-3.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@netbfrs.fr", "password": "admin123"}
FORMATEUR_CREDS = {"email": "formateur@netbfrs.fr", "password": "formateur123"}
STUDENT_CREDS = {"email": "alice.martin@netbfrs.fr", "password": "etudiant123"}

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.formateur_token = None
        self.student_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status} {test_name}: {details}")
        print(f"{status} {test_name}: {details}")
        
    def login(self, credentials, role_name):
        """Login and return token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                self.log_result(f"{role_name} login", True, f"Token received")
                return token
            else:
                self.log_result(f"{role_name} login", False, f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result(f"{role_name} login", False, f"Exception: {str(e)}")
            return None
    
    def create_test_image(self, filename="test_image.png"):
        """Create a test image file"""
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        return img_bytes
    
    def test_image_upload_endpoint(self):
        """Test image upload functionality"""
        print("\n=== Testing Image Upload Endpoint ===")
        
        # Test 1: Admin can upload image
        if self.admin_token:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            test_image = self.create_test_image()
            files = {"file": ("test_admin.png", test_image, "image/png")}
            
            try:
                response = self.session.post(f"{BASE_URL}/upload/image", headers=headers, files=files)
                if response.status_code == 200:
                    data = response.json()
                    admin_filename = data.get("filename")
                    self.log_result("Admin image upload", True, f"Uploaded as {admin_filename}")
                    
                    # Test serving the uploaded image
                    if admin_filename:
                        img_response = self.session.get(f"{BASE_URL}/images/{admin_filename}")
                        if img_response.status_code == 200:
                            self.log_result("Admin image serve", True, f"Image served successfully")
                        else:
                            self.log_result("Admin image serve", False, f"Status {img_response.status_code}")
                        
                        # Test deleting the image
                        del_response = self.session.delete(f"{BASE_URL}/images/{admin_filename}", headers=headers)
                        if del_response.status_code == 200:
                            self.log_result("Admin image delete", True, "Image deleted successfully")
                        else:
                            self.log_result("Admin image delete", False, f"Status {del_response.status_code}")
                else:
                    self.log_result("Admin image upload", False, f"Status {response.status_code}: {response.text}")
            except Exception as e:
                self.log_result("Admin image upload", False, f"Exception: {str(e)}")
        
        # Test 2: Formateur can upload image
        if self.formateur_token:
            headers = {"Authorization": f"Bearer {self.formateur_token}"}
            test_image = self.create_test_image()
            files = {"file": ("test_formateur.png", test_image, "image/png")}
            
            try:
                response = self.session.post(f"{BASE_URL}/upload/image", headers=headers, files=files)
                if response.status_code == 200:
                    data = response.json()
                    formateur_filename = data.get("filename")
                    self.log_result("Formateur image upload", True, f"Uploaded as {formateur_filename}")
                    
                    # Clean up
                    if formateur_filename:
                        self.session.delete(f"{BASE_URL}/images/{formateur_filename}", headers=headers)
                else:
                    self.log_result("Formateur image upload", False, f"Status {response.status_code}: {response.text}")
            except Exception as e:
                self.log_result("Formateur image upload", False, f"Exception: {str(e)}")
        
        # Test 3: Student should get 403
        if self.student_token:
            headers = {"Authorization": f"Bearer {self.student_token}"}
            test_image = self.create_test_image()
            files = {"file": ("test_student.png", test_image, "image/png")}
            
            try:
                response = self.session.post(f"{BASE_URL}/upload/image", headers=headers, files=files)
                if response.status_code == 403:
                    self.log_result("Student image upload (403 expected)", True, "Correctly denied access")
                else:
                    self.log_result("Student image upload (403 expected)", False, f"Status {response.status_code} (should be 403)")
            except Exception as e:
                self.log_result("Student image upload (403 expected)", False, f"Exception: {str(e)}")
    
    def test_course_crud_with_images(self):
        """Test course CRUD operations with images field"""
        print("\n=== Testing Course CRUD with Images ===")
        
        if not self.admin_token:
            self.log_result("Course CRUD test", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First upload some test images
        test_images = []
        for i in range(2):
            test_image = self.create_test_image()
            files = {"file": (f"course_test_{i}.png", test_image, "image/png")}
            
            try:
                response = self.session.post(f"{BASE_URL}/upload/image", headers=headers, files=files)
                if response.status_code == 200:
                    data = response.json()
                    test_images.append(data.get("filename"))
            except Exception as e:
                print(f"Failed to upload test image {i}: {e}")
        
        if len(test_images) < 2:
            self.log_result("Course image preparation", False, "Could not upload test images")
            return
        
        self.log_result("Course image preparation", True, f"Uploaded {len(test_images)} test images")
        
        # Test 1: Create course with images
        course_data = {
            "title": "Test Course with Images",
            "content": "This is a test course with images",
            "images": test_images,
            "objectives": ["Learn image handling", "Test course creation"],
            "prerequisites": ["Basic knowledge"],
            "duration_estimate": "2 hours",
            "formation": "bts-sio-sisr",
            "category": "admin-systeme"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/courses", headers=headers, json=course_data)
            if response.status_code == 201:
                course = response.json()
                course_id = course.get("id")
                returned_images = course.get("images", [])
                
                if set(returned_images) == set(test_images):
                    self.log_result("Course creation with images", True, f"Course created with {len(returned_images)} images")
                else:
                    self.log_result("Course creation with images", False, f"Images mismatch: sent {test_images}, got {returned_images}")
                
                # Test 2: Get course and verify images field
                if course_id:
                    get_response = self.session.get(f"{BASE_URL}/courses/{course_id}", headers=headers)
                    if get_response.status_code == 200:
                        retrieved_course = get_response.json()
                        retrieved_images = retrieved_course.get("images", [])
                        
                        if set(retrieved_images) == set(test_images):
                            self.log_result("Course GET with images", True, f"Retrieved course has correct images")
                        else:
                            self.log_result("Course GET with images", False, f"Images mismatch in GET")
                    else:
                        self.log_result("Course GET with images", False, f"Status {get_response.status_code}")
                
                # Test 3: Update course with different images
                updated_images = [test_images[0]]  # Keep only first image
                update_data = {
                    "title": "Updated Test Course",
                    "images": updated_images
                }
                
                if course_id:
                    put_response = self.session.put(f"{BASE_URL}/courses/{course_id}", headers=headers, json=update_data)
                    if put_response.status_code == 200:
                        # Verify update
                        get_response = self.session.get(f"{BASE_URL}/courses/{course_id}", headers=headers)
                        if get_response.status_code == 200:
                            updated_course = get_response.json()
                            final_images = updated_course.get("images", [])
                            
                            if final_images == updated_images:
                                self.log_result("Course UPDATE with images", True, f"Images updated correctly")
                            else:
                                self.log_result("Course UPDATE with images", False, f"Images not updated correctly")
                        else:
                            self.log_result("Course UPDATE with images", False, f"Could not verify update")
                    else:
                        self.log_result("Course UPDATE with images", False, f"Status {put_response.status_code}")
                
                # Test 4: List courses and verify images field
                list_response = self.session.get(f"{BASE_URL}/courses", headers=headers)
                if list_response.status_code == 200:
                    courses = list_response.json()
                    test_course = next((c for c in courses if c.get("id") == course_id), None)
                    
                    if test_course and "images" in test_course:
                        self.log_result("Course LIST with images", True, "Images field present in course list")
                    else:
                        self.log_result("Course LIST with images", False, "Images field missing in course list")
                else:
                    self.log_result("Course LIST with images", False, f"Status {list_response.status_code}")
                
                # Clean up: Delete course
                if course_id:
                    self.session.delete(f"{BASE_URL}/courses/{course_id}", headers=headers)
            else:
                self.log_result("Course creation with images", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Course creation with images", False, f"Exception: {str(e)}")
        
        # Clean up: Delete test images
        for img_filename in test_images:
            try:
                self.session.delete(f"{BASE_URL}/images/{img_filename}", headers=headers)
            except:
                pass
    
    def test_llm_settings_endpoint(self):
        """Test LLM settings endpoint"""
        print("\n=== Testing LLM Settings Endpoint ===")
        
        if not self.admin_token:
            self.log_result("LLM settings test", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: GET settings
        try:
            response = self.session.get(f"{BASE_URL}/settings", headers=headers)
            if response.status_code == 200:
                settings = response.json()
                
                # Check required fields
                required_fields = ["llm_provider", "llm_active"]
                missing_fields = [f for f in required_fields if f not in settings]
                
                if not missing_fields:
                    self.log_result("GET settings structure", True, f"All required fields present")
                    
                    # Check if .env EMERGENT_LLM_KEY is detected
                    llm_provider = settings.get("llm_provider")
                    llm_active = settings.get("llm_active")
                    
                    if llm_provider and llm_active:
                        self.log_result("GET settings LLM detection", True, f"Provider: {llm_provider}, Active: {llm_active}")
                    else:
                        self.log_result("GET settings LLM detection", False, f"Provider: {llm_provider}, Active: {llm_active}")
                else:
                    self.log_result("GET settings structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("GET settings", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET settings", False, f"Exception: {str(e)}")
        
        # Test 2: PUT settings with new LLM key
        test_key = "sk-emergent-test123456789"
        try:
            put_data = {"llm_key": test_key}
            response = self.session.put(f"{BASE_URL}/settings", headers=headers, json=put_data)
            
            if response.status_code == 200:
                result = response.json()
                
                if "llm_provider" in result and "llm_active" in result:
                    self.log_result("PUT settings", True, f"Settings updated successfully")
                    
                    # Verify the change by getting settings again
                    get_response = self.session.get(f"{BASE_URL}/settings", headers=headers)
                    if get_response.status_code == 200:
                        updated_settings = get_response.json()
                        
                        if updated_settings.get("llm_key_set"):
                            self.log_result("PUT settings verification", True, "LLM key was set")
                        else:
                            self.log_result("PUT settings verification", False, "LLM key was not set")
                    else:
                        self.log_result("PUT settings verification", False, f"Could not verify update")
                else:
                    self.log_result("PUT settings", False, f"Missing fields in response")
            else:
                self.log_result("PUT settings", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("PUT settings", False, f"Exception: {str(e)}")
        
        # Test 3: Student should get 403 for settings
        if self.student_token:
            student_headers = {"Authorization": f"Bearer {self.student_token}"}
            
            try:
                response = self.session.get(f"{BASE_URL}/settings", headers=student_headers)
                if response.status_code == 403:
                    self.log_result("Student settings access (403 expected)", True, "Correctly denied access")
                else:
                    self.log_result("Student settings access (403 expected)", False, f"Status {response.status_code} (should be 403)")
            except Exception as e:
                self.log_result("Student settings access (403 expected)", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting AI2Lean Backend API Tests")
        print(f"Base URL: {BASE_URL}")
        
        # Login all users
        self.admin_token = self.login(ADMIN_CREDS, "Admin")
        self.formateur_token = self.login(FORMATEUR_CREDS, "Formateur")
        self.student_token = self.login(STUDENT_CREDS, "Student")
        
        if not any([self.admin_token, self.formateur_token, self.student_token]):
            print("❌ CRITICAL: No successful logins - cannot proceed with tests")
            return
        
        # Run tests
        self.test_image_upload_endpoint()
        self.test_course_crud_with_images()
        self.test_llm_settings_endpoint()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n📈 Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"⚠️  {failed} tests failed - check details above")

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()