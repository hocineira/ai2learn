#!/usr/bin/env python3
"""
AI2Lean Backend Email Change Features Test Suite
Tests all email change related endpoints and functionality
"""

import requests
import json
import sys
from typing import Dict, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://salut-check-3.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@netbfrs.fr", "password": "admin123"}
FORMATEUR_CREDS = {"email": "formateur@netbfrs.fr", "password": "formateur123"}
STUDENT_CREDS = {"email": "alice.martin@netbfrs.fr", "password": "etudiant123"}
STUDENT2_CREDS = {"email": "bob.durand@netbfrs.fr", "password": "etudiant123"}

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        
    def login(self, credentials: Dict[str, str], role: str) -> Optional[str]:
        """Login and return JWT token"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                self.tokens[role] = token
                print(f"✅ Login successful for {role}: {credentials['email']}")
                return token
            else:
                print(f"❌ Login failed for {role}: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Login error for {role}: {str(e)}")
            return None
    
    def make_request(self, method: str, endpoint: str, token: str, **kwargs) -> requests.Response:
        """Make authenticated request"""
        headers = {"Authorization": f"Bearer {token}"}
        if "headers" in kwargs:
            kwargs["headers"].update(headers)
        else:
            kwargs["headers"] = headers
        
        url = f"{BACKEND_URL}{endpoint}"
        return self.session.request(method, url, **kwargs)
    
    def test_email_change_request_formateur(self) -> bool:
        """Test POST /api/email-change-request as formateur"""
        print("\n🧪 Testing email change request as formateur...")
        
        token = self.tokens.get("formateur")
        if not token:
            print("❌ No formateur token available")
            return False
        
        # Use timestamp to make email unique
        import time
        timestamp = int(time.time())
        
        # Test valid request
        data = {"new_email": f"test-formateur-{timestamp}@test.fr", "reason": "Test email change"}
        response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if response.status_code == 200:
            print("✅ Email change request created successfully")
            return True
        else:
            print(f"❌ Email change request failed: {response.status_code} - {response.text}")
            return False
    
    def test_email_change_request_student(self) -> bool:
        """Test POST /api/email-change-request as student"""
        print("\n🧪 Testing email change request as student...")
        
        token = self.tokens.get("student")
        if not token:
            print("❌ No student token available")
            return False
        
        # Use timestamp to make email unique
        import time
        timestamp = int(time.time())
        
        # Test valid request
        data = {"new_email": f"test-student-{timestamp}@test.fr", "reason": "Test email change for student"}
        response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if response.status_code == 200:
            print("✅ Student email change request created successfully")
            return True
        else:
            print(f"❌ Student email change request failed: {response.status_code} - {response.text}")
            return False
    
    def test_email_change_request_admin_forbidden(self) -> bool:
        """Test POST /api/email-change-request as admin (should fail)"""
        print("\n🧪 Testing email change request as admin (should be forbidden)...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        data = {"new_email": "test-admin@test.fr", "reason": "Test"}
        response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if response.status_code == 400:
            print("✅ Admin correctly forbidden from using email change request")
            return True
        else:
            print(f"❌ Admin should be forbidden: {response.status_code} - {response.text}")
            return False
    
    def test_duplicate_email_request(self) -> bool:
        """Test POST /api/email-change-request with duplicate email"""
        print("\n🧪 Testing email change request with duplicate email...")
        
        token = self.tokens.get("formateur")
        if not token:
            print("❌ No formateur token available")
            return False
        
        # Try to use admin's email
        data = {"new_email": "admin@netbfrs.fr", "reason": "Test duplicate"}
        response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if response.status_code == 400:
            print("✅ Duplicate email correctly rejected")
            return True
        else:
            print(f"❌ Duplicate email should be rejected: {response.status_code} - {response.text}")
            return False
    
    def test_pending_request_duplicate(self) -> bool:
        """Test POST /api/email-change-request when user already has pending request"""
        print("\n🧪 Testing duplicate pending request...")
        
        token = self.tokens.get("formateur")
        if not token:
            print("❌ No formateur token available")
            return False
        
        # Try to create another request
        data = {"new_email": "another-test@test.fr", "reason": "Another test"}
        response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if response.status_code == 400:
            print("✅ Duplicate pending request correctly rejected")
            return True
        else:
            print(f"❌ Duplicate pending request should be rejected: {response.status_code} - {response.text}")
            return False
    
    def test_get_email_change_requests_admin(self) -> bool:
        """Test GET /api/email-change-requests as admin"""
        print("\n🧪 Testing get email change requests as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        response = self.make_request("GET", "/email-change-requests", token)
        
        if response.status_code == 200:
            requests_data = response.json()
            print(f"✅ Retrieved {len(requests_data)} email change requests")
            
            # Store request IDs for later tests
            self.pending_requests = [req for req in requests_data if req.get("status") == "pending"]
            print(f"   Found {len(self.pending_requests)} pending requests")
            return True
        else:
            print(f"❌ Get email change requests failed: {response.status_code} - {response.text}")
            return False
    
    def test_get_email_change_requests_non_admin(self) -> bool:
        """Test GET /api/email-change-requests as non-admin (should fail)"""
        print("\n🧪 Testing get email change requests as non-admin (should be forbidden)...")
        
        token = self.tokens.get("formateur")
        if not token:
            print("❌ No formateur token available")
            return False
        
        response = self.make_request("GET", "/email-change-requests", token)
        
        if response.status_code == 403:
            print("✅ Non-admin correctly forbidden from viewing email change requests")
            return True
        else:
            print(f"❌ Non-admin should be forbidden: {response.status_code} - {response.text}")
            return False
    
    def test_approve_email_change_request(self) -> bool:
        """Test PUT /api/email-change-requests/{id}?action=approve"""
        print("\n🧪 Testing approve email change request...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        if not hasattr(self, 'pending_requests') or not self.pending_requests:
            print("❌ No pending requests available for approval")
            return False
        
        # Approve the first pending request
        request_id = self.pending_requests[0]["id"]
        response = self.make_request("PUT", f"/email-change-requests/{request_id}?action=approve", token)
        
        if response.status_code == 200:
            print("✅ Email change request approved successfully")
            # Store approved request for cleanup
            self.approved_request = self.pending_requests[0]
            return True
        else:
            print(f"❌ Email change request approval failed: {response.status_code} - {response.text}")
            return False
    
    def test_reject_email_change_request(self) -> bool:
        """Test PUT /api/email-change-requests/{id}?action=reject"""
        print("\n🧪 Testing reject email change request...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        # First create a new request to reject
        student2_token = self.tokens.get("student2")
        if student2_token:
            data = {"new_email": "reject-test@test.fr", "reason": "Test rejection"}
            create_response = self.make_request("POST", "/email-change-request", student2_token, json=data)
            
            if create_response.status_code != 200:
                print(f"❌ Could not create request for rejection test: {create_response.status_code}")
                return False
        
        # Get updated requests list
        response = self.make_request("GET", "/email-change-requests", token)
        if response.status_code != 200:
            print("❌ Could not get updated requests list")
            return False
        
        requests_data = response.json()
        pending_requests = [req for req in requests_data if req.get("status") == "pending"]
        
        if not pending_requests:
            print("❌ No pending requests available for rejection")
            return False
        
        # Reject the first pending request
        request_id = pending_requests[0]["id"]
        response = self.make_request("PUT", f"/email-change-requests/{request_id}?action=reject", token)
        
        if response.status_code == 200:
            print("✅ Email change request rejected successfully")
            return True
        else:
            print(f"❌ Email change request rejection failed: {response.status_code} - {response.text}")
            return False
    
    def test_get_my_email_change_request(self) -> bool:
        """Test GET /api/my-email-change-request"""
        print("\n🧪 Testing get my email change request...")
        
        # Use student2 who should not have a pending request yet
        token = self.tokens.get("student2")
        if not token:
            print("❌ No student2 token available")
            return False
        
        # Use timestamp to make email unique
        import time
        timestamp = int(time.time())
        
        # Create a request
        data = {"new_email": f"my-request-test-{timestamp}@test.fr", "reason": "Test my request"}
        create_response = self.make_request("POST", "/email-change-request", token, json=data)
        
        if create_response.status_code != 200:
            print(f"❌ Could not create request for my-request test: {create_response.status_code}")
            return False
        
        # Now get my request
        response = self.make_request("GET", "/my-email-change-request", token)
        
        if response.status_code == 200:
            request_data = response.json()
            if request_data and request_data.get("new_email") == f"my-request-test-{timestamp}@test.fr":
                print("✅ My email change request retrieved successfully")
                return True
            else:
                print("❌ My email change request data incorrect")
                return False
        else:
            print(f"❌ Get my email change request failed: {response.status_code} - {response.text}")
            return False
    
    def test_admin_direct_email_change(self) -> bool:
        """Test PUT /api/users/{user_id} with email field"""
        print("\n🧪 Testing admin direct email change...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        # First get users list to find a user to update
        response = self.make_request("GET", "/users", token)
        if response.status_code != 200:
            print(f"❌ Could not get users list: {response.status_code}")
            return False
        
        users = response.json()
        # Find a student user (not admin)
        student_user = None
        for user in users:
            if user.get("role") == "etudiant" and user.get("email") != "alice.martin@netbfrs.fr":
                student_user = user
                break
        
        if not student_user:
            print("❌ No suitable student user found for testing")
            return False
        
        # Use timestamp to make email unique
        import time
        timestamp = int(time.time())
        new_email = f"admin-direct-{timestamp}@test.fr"
        
        # Test direct email change
        data = {"email": new_email}
        response = self.make_request("PUT", f"/users/{student_user['id']}", token, json=data)
        
        if response.status_code == 200:
            print("✅ Admin direct email change successful")
            # Store for cleanup
            self.direct_change_user = {"id": student_user["id"], "original_email": student_user["email"], "new_email": new_email}
            return True
        else:
            print(f"❌ Admin direct email change failed: {response.status_code} - {response.text}")
            return False
    
    def test_admin_direct_email_duplicate(self) -> bool:
        """Test PUT /api/users/{user_id} with duplicate email"""
        print("\n🧪 Testing admin direct email change with duplicate...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        # Get users list to find a user to update
        response = self.make_request("GET", "/users", token)
        if response.status_code != 200:
            print(f"❌ Could not get users list: {response.status_code}")
            return False
        
        users = response.json()
        # Find a student user
        student_user = None
        for user in users:
            if user.get("role") == "etudiant":
                student_user = user
                break
        
        if not student_user:
            print("❌ No suitable student user found for testing")
            return False
        
        # Try to set email to admin's email (should fail)
        data = {"email": "admin@netbfrs.fr"}
        response = self.make_request("PUT", f"/users/{student_user['id']}", token, json=data)
        
        if response.status_code == 400:
            print("✅ Admin direct email change with duplicate correctly rejected")
            return True
        else:
            print(f"❌ Admin direct email change with duplicate should be rejected: {response.status_code} - {response.text}")
            return False
    
    def cleanup_existing_requests(self):
        """Clean up any existing pending requests for test users"""
        print("\n🧹 Cleaning up existing pending requests...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token for cleanup")
            return
        
        # Get all pending requests
        response = self.make_request("GET", "/email-change-requests", token)
        if response.status_code != 200:
            print("❌ Could not get email change requests for cleanup")
            return
        
        requests_data = response.json()
        pending_requests = [req for req in requests_data if req.get("status") == "pending"]
        
        # Reject all pending requests to clean up
        for req in pending_requests:
            reject_response = self.make_request("PUT", f"/email-change-requests/{req['id']}?action=reject", token)
            if reject_response.status_code == 200:
                print(f"✅ Cleaned up pending request for {req['user_email']}")
            else:
                print(f"⚠️  Failed to clean up request for {req['user_email']}")
        
        print("✅ Existing requests cleanup completed")
    
    def cleanup_test_data(self):
        print("\n🧹 Cleaning up test data...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token for cleanup")
            return
        
        # If we approved a request, restore the original email
        if hasattr(self, 'approved_request'):
            original_email = self.approved_request.get("user_email")
            user_id = self.approved_request.get("user_id")
            
            if original_email and user_id:
                # Restore original email
                data = {"email": original_email}
                response = self.make_request("PUT", f"/users/{user_id}", token, json=data)
                if response.status_code == 200:
                    print(f"✅ Restored {user_id} to {original_email}")
                else:
                    print(f"⚠️  Failed to restore {user_id} to {original_email}")
        
        # If we did a direct email change, restore it
        if hasattr(self, 'direct_change_user'):
            user_info = self.direct_change_user
            data = {"email": user_info["original_email"]}
            response = self.make_request("PUT", f"/users/{user_info['id']}", token, json=data)
            if response.status_code == 200:
                print(f"✅ Restored direct change user to {user_info['original_email']}")
            else:
                print(f"⚠️  Failed to restore direct change user to {user_info['original_email']}")
        
        print("✅ Cleanup completed")
    
    def run_all_tests(self):
        """Run all email change tests"""
        print("🚀 Starting AI2Lean Email Change Features Test Suite")
        print("=" * 60)
        
        # Login all users
        print("\n📝 Logging in test users...")
        admin_token = self.login(ADMIN_CREDS, "admin")
        formateur_token = self.login(FORMATEUR_CREDS, "formateur")
        student_token = self.login(STUDENT_CREDS, "student")
        student2_token = self.login(STUDENT2_CREDS, "student2")
        
        if not all([admin_token, formateur_token, student_token, student2_token]):
            print(f"❌ Failed to login all required users - admin: {bool(admin_token)}, formateur: {bool(formateur_token)}, student: {bool(student_token)}, student2: {bool(student2_token)}")
            return False
        
        # Clean up any existing pending requests
        self.cleanup_existing_requests()
        
        # Run tests
        tests = [
            ("Email change request - Formateur", self.test_email_change_request_formateur),
            ("Email change request - Student", self.test_email_change_request_student),
            ("Email change request - Admin forbidden", self.test_email_change_request_admin_forbidden),
            ("Duplicate email request", self.test_duplicate_email_request),
            ("Pending request duplicate", self.test_pending_request_duplicate),
            ("Get email change requests - Admin", self.test_get_email_change_requests_admin),
            ("Get email change requests - Non-admin forbidden", self.test_get_email_change_requests_non_admin),
            ("Approve email change request", self.test_approve_email_change_request),
            ("Reject email change request", self.test_reject_email_change_request),
            ("Get my email change request", self.test_get_my_email_change_request),
            ("Admin direct email change", self.test_admin_direct_email_change),
            ("Admin direct email duplicate", self.test_admin_direct_email_duplicate),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                if result:
                    passed += 1
                self.test_results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} - Exception: {str(e)}")
                self.test_results.append((test_name, False))
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        for test_name, result in self.test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            return False

if __name__ == "__main__":
    test_session = TestSession()
    success = test_session.run_all_tests()
    sys.exit(0 if success else 1)