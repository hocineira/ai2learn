import requests
import sys
import json
import os
import tempfile
from datetime import datetime

class CourseVideoTester:
    def __init__(self, base_url="https://guac-edu-platform.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.test_data = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED - {details}")
        
        self.test_results.append({
            "name": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Don't set Content-Type for multipart uploads
        if not files:
            headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers={k: v for k, v in headers.items() if k != 'Content-Type'})
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.log_result(name, True)
                try:
                    return response.json() if response.content else {}
                except:
                    return {}
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}")
                return None

        except Exception as e:
            self.log_result(name, False, f"Request error: {str(e)}")
            return None

    def test_authentication(self):
        """Test authentication for course/video testing"""
        print("\n🔐 Testing authentication...")
        
        # Test admin login
        admin_result = self.run_test(
            "Admin Login", "POST", "auth/login", 200,
            data={"username": "admin", "password": "admin123"}
        )
        if admin_result and 'token' in admin_result:
            self.tokens['admin'] = admin_result['token']
            print(f"✅ Admin user: {admin_result['user']['full_name']}")
        
        # Test formateur login
        formateur_result = self.run_test(
            "Formateur Login", "POST", "auth/login", 200,
            data={"username": "formateur", "password": "formateur123"}
        )
        if formateur_result and 'token' in formateur_result:
            self.tokens['formateur'] = formateur_result['token']
            print(f"✅ Formateur user: {formateur_result['user']['full_name']}")
        
        # Test student login
        student_result = self.run_test(
            "Student Login", "POST", "auth/login", 200,
            data={"username": "etudiant1", "password": "etudiant123"}
        )
        if student_result and 'token' in student_result:
            self.tokens['etudiant1'] = student_result['token']
            print(f"✅ Student user: {student_result['user']['full_name']}")

        return len(self.tokens) >= 3

    def test_get_exercises(self):
        """Get exercises to find one for course creation"""
        print("\n📚 Getting exercises for course creation...")
        
        if 'admin' not in self.tokens:
            print("⚠️  Skipping exercise fetch - no admin token")
            return False

        exercises_result = self.run_test(
            "Get Exercises", "GET", "exercises", 200,
            token=self.tokens['admin']
        )
        
        if exercises_result and len(exercises_result) > 0:
            # Find a lab-type exercise or just use the first one
            lab_exercise = None
            for ex in exercises_result:
                if ex.get('exercise_type') == 'lab':
                    lab_exercise = ex
                    break
            
            if lab_exercise:
                self.test_data['exercise_id'] = lab_exercise['id']
                print(f"✅ Found lab exercise: {lab_exercise['title']} (ID: {lab_exercise['id']})")
            else:
                # Use first exercise if no lab found
                self.test_data['exercise_id'] = exercises_result[0]['id']
                print(f"✅ Using first exercise: {exercises_result[0]['title']} (ID: {exercises_result[0]['id']})")
            
            return True
        
        return False

    def test_video_endpoints(self):
        """Test video upload and management endpoints"""
        print("\n🎥 Testing video endpoints...")
        
        if 'admin' not in self.tokens:
            print("⚠️  Skipping video tests - no admin token")
            return False

        admin_token = self.tokens['admin']
        
        # Test list videos (should work even if empty)
        videos_result = self.run_test(
            "List Videos", "GET", "videos", 200,
            token=admin_token
        )
        if videos_result is not None:
            print(f"✅ Found {len(videos_result)} existing videos")
        
        # Create a small test video file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
            # Write minimal MP4 header (not a real video, but should pass content-type check)
            temp_file.write(b'\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom')
            temp_file.write(b'A' * 100)  # Some dummy data
            temp_file_path = temp_file.name
        
        try:
            # Test video upload
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_video.mp4', f, 'video/mp4')}
                upload_result = self.run_test(
                    "Upload Video", "POST", "upload/video", 200,
                    token=admin_token, files=files
                )
            
            if upload_result and 'filename' in upload_result:
                uploaded_filename = upload_result['filename']
                self.test_data['video_filename'] = uploaded_filename
                print(f"✅ Uploaded video: {uploaded_filename}")
                
                # Test serve video
                serve_result = self.run_test(
                    "Serve Video", "GET", f"videos/{uploaded_filename}", 200
                )
                
                # Test list videos again (should now have our video)
                videos_after = self.run_test(
                    "List Videos After Upload", "GET", "videos", 200,
                    token=admin_token
                )
                if videos_after is not None:
                    print(f"✅ Now have {len(videos_after)} videos")
        
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        # Test student cannot upload video
        if 'etudiant1' in self.tokens:
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                temp_file.write(b'dummy')
                temp_file_path = temp_file.name
            
            try:
                with open(temp_file_path, 'rb') as f:
                    files = {'file': ('test_video.mp4', f, 'video/mp4')}
                    self.run_test(
                        "Student Upload Video (Should Fail)", "POST", "upload/video", 403,
                        token=self.tokens['etudiant1'], files=files
                    )
            finally:
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
        
        # Test student cannot list videos
        if 'etudiant1' in self.tokens:
            self.run_test(
                "Student List Videos (Should Fail)", "GET", "videos", 403,
                token=self.tokens['etudiant1']
            )

        return True

    def test_course_crud(self):
        """Test course CRUD endpoints"""
        print("\n📖 Testing course CRUD endpoints...")
        
        if 'admin' not in self.tokens or 'exercise_id' not in self.test_data:
            print("⚠️  Skipping course CRUD tests - missing admin token or exercise ID")
            return False

        admin_token = self.tokens['admin']
        exercise_id = self.test_data['exercise_id']
        
        # Test list courses (initially empty)
        initial_courses = self.run_test(
            "List Courses (Initial)", "GET", "courses", 200,
            token=admin_token
        )
        if initial_courses is not None:
            print(f"✅ Found {len(initial_courses)} existing courses")
        
        # Create a course
        course_data = {
            "exercise_id": exercise_id,
            "title": "Test Course API",
            "content": "This is a test course created via API testing. It covers important concepts and practical exercises.",
            "objectives": ["Learn API testing", "Understand course creation"],
            "prerequisites": ["Basic knowledge", "Access to platform"],
            "duration_estimate": "30 minutes"
        }
        
        # Add video filename if we uploaded one
        if 'video_filename' in self.test_data:
            course_data['video_filename'] = self.test_data['video_filename']
        
        created_course = self.run_test(
            "Create Course", "POST", "courses", 201,
            data=course_data, token=admin_token
        )
        
        if created_course and 'id' in created_course:
            course_id = created_course['id']
            self.test_data['course_id'] = course_id
            print(f"✅ Created course: {course_id}")
            
            # Test get single course
            single_course = self.run_test(
                "Get Single Course", "GET", f"courses/{course_id}", 200,
                token=admin_token
            )
            if single_course:
                print(f"✅ Retrieved course: {single_course.get('title')}")
            
            # Test get course by exercise ID
            course_by_exercise = self.run_test(
                "Get Course by Exercise ID", "GET", f"courses/by-exercise/{exercise_id}", 200,
                token=admin_token
            )
            if course_by_exercise:
                print(f"✅ Retrieved course by exercise ID: {course_by_exercise.get('title')}")
            
            # Test list courses (should now have 1 more)
            courses_after_create = self.run_test(
                "List Courses After Create", "GET", "courses", 200,
                token=admin_token
            )
            if courses_after_create is not None:
                print(f"✅ Now have {len(courses_after_create)} courses")
            
            # Test update course
            update_data = {
                "title": "Updated Test Course API",
                "content": "This course has been updated via API testing.",
                "duration_estimate": "45 minutes"
            }
            
            update_result = self.run_test(
                "Update Course", "PUT", f"courses/{course_id}", 200,
                data=update_data, token=admin_token
            )
            
            # Verify update worked
            if update_result:
                updated_course = self.run_test(
                    "Get Updated Course", "GET", f"courses/{course_id}", 200,
                    token=admin_token
                )
                if updated_course and updated_course.get('title') == "Updated Test Course API":
                    print("✅ Course update verified")
                else:
                    self.log_result("Verify Course Update", False, "Title not updated correctly")
        
        # Test student can read courses
        if 'etudiant1' in self.tokens:
            student_courses = self.run_test(
                "Student List Courses", "GET", "courses", 200,
                token=self.tokens['etudiant1']
            )
            if student_courses is not None:
                print(f"✅ Student can see {len(student_courses)} courses")
            
            if 'course_id' in self.test_data:
                student_single_course = self.run_test(
                    "Student Get Single Course", "GET", f"courses/{self.test_data['course_id']}", 200,
                    token=self.tokens['etudiant1']
                )
        
        # Test student cannot create course
        if 'etudiant1' in self.tokens:
            self.run_test(
                "Student Create Course (Should Fail)", "POST", "courses", 403,
                data=course_data, token=self.tokens['etudiant1']
            )
        
        # Test student cannot update course
        if 'etudiant1' in self.tokens and 'course_id' in self.test_data:
            self.run_test(
                "Student Update Course (Should Fail)", "PUT", f"courses/{self.test_data['course_id']}", 403,
                data={"title": "Hacked"}, token=self.tokens['etudiant1']
            )
        
        # Test student cannot delete course
        if 'etudiant1' in self.tokens and 'course_id' in self.test_data:
            self.run_test(
                "Student Delete Course (Should Fail)", "DELETE", f"courses/{self.test_data['course_id']}", 403,
                token=self.tokens['etudiant1']
            )
        
        # Test formateur can create course
        if 'formateur' in self.tokens:
            formateur_course_data = {
                "exercise_id": exercise_id,
                "title": "Formateur Test Course",
                "content": "Course created by formateur",
                "objectives": ["Test formateur permissions"],
                "prerequisites": [],
                "duration_estimate": "20 minutes"
            }
            
            formateur_course = self.run_test(
                "Formateur Create Course", "POST", "courses", 201,
                data=formateur_course_data, token=self.tokens['formateur']
            )
            
            if formateur_course and 'id' in formateur_course:
                self.test_data['formateur_course_id'] = formateur_course['id']
                print(f"✅ Formateur created course: {formateur_course['id']}")
        
        # Test delete course (cleanup)
        if 'course_id' in self.test_data:
            delete_result = self.run_test(
                "Delete Course", "DELETE", f"courses/{self.test_data['course_id']}", 200,
                token=admin_token
            )
            
            if delete_result:
                # Verify deletion
                self.run_test(
                    "Verify Course Deleted", "GET", f"courses/{self.test_data['course_id']}", 404,
                    token=admin_token
                )
        
        # Clean up formateur course too
        if 'formateur_course_id' in self.test_data:
            self.run_test(
                "Delete Formateur Course", "DELETE", f"courses/{self.test_data['formateur_course_id']}", 200,
                token=self.tokens['formateur']
            )

        return True

    def test_course_creation_validation(self):
        """Test course creation validation and edge cases"""
        print("\n🔍 Testing course creation validation...")
        
        if 'admin' not in self.tokens:
            print("⚠️  Skipping validation tests - no admin token")
            return False

        admin_token = self.tokens['admin']
        
        # Test create course with non-existent exercise
        invalid_course_data = {
            "exercise_id": "non-existent-exercise-id",
            "title": "Invalid Course",
            "content": "This should fail",
            "objectives": [],
            "prerequisites": [],
            "duration_estimate": "10 minutes"
        }
        
        self.run_test(
            "Create Course with Invalid Exercise ID", "POST", "courses", 404,
            data=invalid_course_data, token=admin_token
        )
        
        # Test duplicate course creation (if we have a valid exercise)
        if 'exercise_id' in self.test_data:
            exercise_id = self.test_data['exercise_id']
            
            # Create first course
            first_course_data = {
                "exercise_id": exercise_id,
                "title": "First Course",
                "content": "First course content",
                "objectives": ["Objective 1"],
                "prerequisites": [],
                "duration_estimate": "15 minutes"
            }
            
            first_course = self.run_test(
                "Create First Course", "POST", "courses", 201,
                data=first_course_data, token=admin_token
            )
            
            if first_course and 'id' in first_course:
                # Try to create second course for same exercise (should fail)
                second_course_data = {
                    "exercise_id": exercise_id,
                    "title": "Second Course",
                    "content": "Second course content",
                    "objectives": ["Objective 2"],
                    "prerequisites": [],
                    "duration_estimate": "20 minutes"
                }
                
                self.run_test(
                    "Create Duplicate Course (Should Fail)", "POST", "courses", 400,
                    data=second_course_data, token=admin_token
                )
                
                # Clean up
                self.run_test(
                    "Delete Test Course", "DELETE", f"courses/{first_course['id']}", 200,
                    token=admin_token
                )

        return True

    def run_all_tests(self):
        """Run all course and video tests"""
        print("🧪 Starting Course & Video API Tests")
        print("=" * 50)
        
        test_methods = [
            self.test_authentication,
            self.test_get_exercises,
            self.test_video_endpoints,
            self.test_course_crud,
            self.test_course_creation_validation
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ Test method {test_method.__name__} crashed: {str(e)}")
        
        # Print final summary
        print("\n" + "=" * 50)
        print(f"📋 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / max(self.tests_run, 1)) * 100
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Course & Video API tests mostly successful!")
        elif success_rate >= 60:
            print("⚠️  Course & Video API has some issues but core functionality works")
        else:
            print("🚨 Course & Video API has significant issues")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": success_rate,
            "results": self.test_results,
            "test_data": self.test_data
        }

def main():
    tester = CourseVideoTester()
    results = tester.run_all_tests()
    
    return 0 if results["success_rate"] >= 70 else 1

if __name__ == "__main__":
    sys.exit(main())