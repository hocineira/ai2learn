#!/usr/bin/env python3
"""
AI2Lean Backend System Updates Management Test Suite
Tests all system update management endpoints
"""

import requests
import json
import sys
import time
from typing import Dict, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://salut-check-3.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@netbfrs.fr", "password": "admin123"}
STUDENT_CREDS = {"email": "alice.martin@netbfrs.fr", "password": "etudiant123"}

class SystemTestSession:
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
    
    def test_system_info_admin(self) -> bool:
        """Test GET /api/system/info as admin"""
        print("\n🧪 Testing GET /api/system/info as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        try:
            response = self.make_request("GET", "/system/info", token)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["os", "python_version", "hostname", "architecture"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"❌ Missing required fields: {missing_fields}")
                    return False
                
                print(f"✅ System info retrieved successfully")
                print(f"   OS: {data.get('os', 'N/A')}")
                print(f"   Python: {data.get('python_version', 'N/A')}")
                print(f"   Hostname: {data.get('hostname', 'N/A')}")
                print(f"   Architecture: {data.get('architecture', 'N/A')}")
                
                # Check optional fields
                optional_fields = ["os_description", "kernel", "uptime", "disk", "memory", "installed_packages"]
                for field in optional_fields:
                    if field in data:
                        print(f"   {field}: {data[field]}")
                
                return True
            else:
                print(f"❌ System info failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ System info error: {str(e)}")
            return False
    
    def test_system_info_student_forbidden(self) -> bool:
        """Test GET /api/system/info as student (should fail)"""
        print("\n🧪 Testing GET /api/system/info as student (should be forbidden)...")
        
        token = self.tokens.get("student")
        if not token:
            print("❌ No student token available")
            return False
        
        try:
            response = self.make_request("GET", "/system/info", token)
            
            if response.status_code == 403:
                print("✅ Student correctly forbidden from accessing system info")
                return True
            else:
                print(f"❌ Student should be forbidden: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ System info student test error: {str(e)}")
            return False
    
    def test_check_updates_admin(self) -> bool:
        """Test GET /api/system/check-updates as admin"""
        print("\n🧪 Testing GET /api/system/check-updates as admin...")
        print("   ⚠️  This may take 10-20 seconds as it runs apt update...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        try:
            # Set longer timeout for apt update
            response = self.make_request("GET", "/system/check-updates", token, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["packages", "total_upgradable", "os_info", "checked_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"❌ Missing required fields: {missing_fields}")
                    return False
                
                print(f"✅ Check updates completed successfully")
                print(f"   Total upgradable packages: {data.get('total_upgradable', 0)}")
                print(f"   OS Info: {data.get('os_info', 'N/A')}")
                print(f"   Checked at: {data.get('checked_at', 'N/A')}")
                
                # Check packages structure if any exist
                packages = data.get("packages", [])
                if packages:
                    print(f"   Sample package: {packages[0]}")
                    # Verify package structure
                    sample_pkg = packages[0]
                    pkg_fields = ["name", "source", "current_version", "new_version", "arch"]
                    missing_pkg_fields = [field for field in pkg_fields if field not in sample_pkg]
                    if missing_pkg_fields:
                        print(f"❌ Package missing fields: {missing_pkg_fields}")
                        return False
                
                # Store for other tests
                self.upgradable_packages = packages
                return True
            else:
                print(f"❌ Check updates failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Check updates error: {str(e)}")
            return False
    
    def test_check_updates_student_forbidden(self) -> bool:
        """Test GET /api/system/check-updates as student (should fail)"""
        print("\n🧪 Testing GET /api/system/check-updates as student (should be forbidden)...")
        
        token = self.tokens.get("student")
        if not token:
            print("❌ No student token available")
            return False
        
        try:
            response = self.make_request("GET", "/system/check-updates", token)
            
            if response.status_code == 403:
                print("✅ Student correctly forbidden from checking updates")
                return True
            else:
                print(f"❌ Student should be forbidden: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Check updates student test error: {str(e)}")
            return False
    
    def test_upgradable_admin(self) -> bool:
        """Test GET /api/system/upgradable as admin"""
        print("\n🧪 Testing GET /api/system/upgradable as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        try:
            response = self.make_request("GET", "/system/upgradable", token)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["packages", "total_upgradable"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"❌ Missing required fields: {missing_fields}")
                    return False
                
                print(f"✅ Upgradable packages retrieved successfully")
                print(f"   Total upgradable: {data.get('total_upgradable', 0)}")
                
                return True
            else:
                print(f"❌ Upgradable packages failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Upgradable packages error: {str(e)}")
            return False
    
    def test_changelog_admin(self) -> bool:
        """Test GET /api/system/changelog/{package_name} as admin"""
        print("\n🧪 Testing GET /api/system/changelog/{package_name} as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        # Test with a common package
        test_packages = ["openssh-client", "chromium", "curl", "wget", "bash"]
        
        for package_name in test_packages:
            try:
                print(f"   Testing changelog for: {package_name}")
                response = self.make_request("GET", f"/system/changelog/{package_name}", token)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check required fields
                    required_fields = ["package", "changelog_raw", "entries", "available"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        print(f"❌ Missing required fields: {missing_fields}")
                        return False
                    
                    print(f"✅ Changelog for {package_name} retrieved successfully")
                    print(f"   Available: {data.get('available', False)}")
                    print(f"   Entries count: {len(data.get('entries', []))}")
                    
                    return True
                else:
                    print(f"   ⚠️  Changelog for {package_name} failed: {response.status_code}")
                    continue
                    
            except Exception as e:
                print(f"   ⚠️  Changelog for {package_name} error: {str(e)}")
                continue
        
        print("❌ No package changelog could be retrieved")
        return False
    
    def test_changelog_invalid_package(self) -> bool:
        """Test GET /api/system/changelog/{package_name} with invalid package"""
        print("\n🧪 Testing GET /api/system/changelog with invalid package...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        try:
            # Test with invalid package name
            response = self.make_request("GET", "/system/changelog/nonexistent-package-12345", token)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return available: false for non-existent package
                if data.get("available") == False:
                    print("✅ Invalid package handled gracefully")
                    return True
                else:
                    print(f"❌ Invalid package should return available: false")
                    return False
            else:
                print(f"❌ Invalid package test failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Invalid package test error: {str(e)}")
            return False
    
    def test_update_history_admin(self) -> bool:
        """Test GET /api/system/update-history as admin"""
        print("\n🧪 Testing GET /api/system/update-history as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        try:
            response = self.make_request("GET", "/system/update-history", token)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return a list (may be empty)
                if isinstance(data, list):
                    print(f"✅ Update history retrieved successfully")
                    print(f"   History entries: {len(data)}")
                    
                    # Store for detail test
                    self.update_history = data
                    return True
                else:
                    print(f"❌ Update history should return a list")
                    return False
            else:
                print(f"❌ Update history failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Update history error: {str(e)}")
            return False
    
    def test_update_detail_admin(self) -> bool:
        """Test GET /api/system/update-detail/{update_id} as admin"""
        print("\n🧪 Testing GET /api/system/update-detail/{update_id} as admin...")
        
        token = self.tokens.get("admin")
        if not token:
            print("❌ No admin token available")
            return False
        
        # Test with fake ID first (should return 404)
        try:
            fake_id = "fake-update-id-12345"
            response = self.make_request("GET", f"/system/update-detail/{fake_id}", token)
            
            if response.status_code == 404:
                print("✅ Fake update ID correctly returns 404")
            else:
                print(f"❌ Fake update ID should return 404: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Fake update ID test error: {str(e)}")
            return False
        
        # If we have history entries, test with real ID
        if hasattr(self, 'update_history') and self.update_history:
            try:
                real_id = self.update_history[0].get("id")
                if real_id:
                    response = self.make_request("GET", f"/system/update-detail/{real_id}", token)
                    
                    if response.status_code == 200:
                        data = response.json()
                        print(f"✅ Real update detail retrieved successfully")
                        print(f"   Update ID: {data.get('id', 'N/A')}")
                        return True
                    else:
                        print(f"❌ Real update detail failed: {response.status_code}")
                        return False
            except Exception as e:
                print(f"❌ Real update detail test error: {str(e)}")
                return False
        else:
            print("✅ No update history available for real ID test (this is normal)")
        
        return True
    
    def test_apply_updates_not_tested(self) -> bool:
        """Verify we don't test POST /api/system/apply-updates"""
        print("\n🧪 Verifying POST /api/system/apply-updates is NOT tested...")
        print("✅ POST /api/system/apply-updates is intentionally NOT tested")
        print("   (Would actually upgrade packages on the system)")
        return True
    
    def run_all_tests(self):
        """Run all system update tests"""
        print("🚀 Starting AI2Lean System Updates Management Test Suite")
        print("=" * 70)
        
        # Login users
        print("\n📝 Logging in test users...")
        admin_token = self.login(ADMIN_CREDS, "admin")
        student_token = self.login(STUDENT_CREDS, "student")
        
        if not all([admin_token, student_token]):
            print(f"❌ Failed to login required users - admin: {bool(admin_token)}, student: {bool(student_token)}")
            return False
        
        # Run tests
        tests = [
            ("System Info - Admin", self.test_system_info_admin),
            ("System Info - Student Forbidden", self.test_system_info_student_forbidden),
            ("Check Updates - Admin", self.test_check_updates_admin),
            ("Check Updates - Student Forbidden", self.test_check_updates_student_forbidden),
            ("Upgradable Packages - Admin", self.test_upgradable_admin),
            ("Package Changelog - Admin", self.test_changelog_admin),
            ("Package Changelog - Invalid Package", self.test_changelog_invalid_package),
            ("Update History - Admin", self.test_update_history_admin),
            ("Update Detail - Admin", self.test_update_detail_admin),
            ("Apply Updates - Not Tested (Intentional)", self.test_apply_updates_not_tested),
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
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 SYSTEM UPDATES TEST SUMMARY")
        print("=" * 70)
        
        for test_name, result in self.test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL SYSTEM UPDATES TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            return False

if __name__ == "__main__":
    test_session = SystemTestSession()
    success = test_session.run_all_tests()
    sys.exit(0 if success else 1)