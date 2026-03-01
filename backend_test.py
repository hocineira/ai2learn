import requests
import sys
import json
from datetime import datetime

class SISRBackendTester:
    def __init__(self, base_url="https://formateur-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.test_data = {}  # Store created test data
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

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
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

    def test_seed_data(self):
        """Initialize seed data"""
        print("\n🌱 Testing seed data initialization...")
        result = self.run_test("Seed Data", "POST", "seed", 200)
        return result is not None

    def test_authentication(self):
        """Test authentication flows"""
        print("\n🔐 Testing authentication...")
        
        # Test admin login
        admin_result = self.run_test(
            "Admin Login", "POST", "auth/login", 200,
            data={"username": "admin", "password": "admin123"}
        )
        if admin_result and 'token' in admin_result:
            self.tokens['admin'] = admin_result['token']
            print(f"Admin token obtained: {admin_result['token'][:20]}...")
        
        # Test formateur login
        formateur_result = self.run_test(
            "Formateur Login", "POST", "auth/login", 200,
            data={"username": "formateur", "password": "formateur123"}
        )
        if formateur_result and 'token' in formateur_result:
            self.tokens['formateur'] = formateur_result['token']
            print(f"Formateur token obtained: {formateur_result['token'][:20]}...")
        
        # Test student login
        student_result = self.run_test(
            "Student Login", "POST", "auth/login", 200,
            data={"username": "etudiant1", "password": "etudiant123"}
        )
        if student_result and 'token' in student_result:
            self.tokens['etudiant'] = student_result['token']
            print(f"Student token obtained: {student_result['token'][:20]}...")
        
        # Test invalid login
        self.run_test(
            "Invalid Login", "POST", "auth/login", 401,
            data={"username": "invalid", "password": "wrong"}
        )
        
        # Test /auth/me for admin
        if 'admin' in self.tokens:
            self.run_test(
                "Admin Profile Check", "GET", "auth/me", 200,
                token=self.tokens['admin']
            )

        return len(self.tokens) >= 3

    def test_user_management(self):
        """Test user management endpoints (admin only)"""
        print("\n👥 Testing user management...")
        
        if 'admin' not in self.tokens:
            print("⚠️  Skipping user management tests - no admin token")
            return False

        admin_token = self.tokens['admin']
        
        # Get users list
        users_result = self.run_test(
            "Get Users List", "GET", "users", 200,
            token=admin_token
        )
        
        if users_result:
            print(f"Found {len(users_result)} users")
            # Find a student to test role update
            student_user = next((u for u in users_result if u['role'] == 'etudiant'), None)
            if student_user:
                student_id = student_user['id']
                
                # Test role update
                self.run_test(
                    "Update User Role", "PUT", f"users/{student_id}/role", 200,
                    data={"role": "formateur"}, token=admin_token
                )
                
                # Update back to student
                self.run_test(
                    "Revert User Role", "PUT", f"users/{student_id}/role", 200,
                    data={"role": "etudiant"}, token=admin_token
                )

        # Test non-admin access (should fail)
        if 'etudiant' in self.tokens:
            self.run_test(
                "Student Access Users (Should Fail)", "GET", "users", 403,
                token=self.tokens['etudiant']
            )

        return True

    def test_categories(self):
        """Test categories endpoint"""
        print("\n📂 Testing categories...")
        result = self.run_test("Get Categories", "GET", "categories", 200)
        if result:
            print(f"Found {len(result)} categories")
        return result is not None

    def test_exercises(self):
        """Test exercise management"""
        print("\n📚 Testing exercises...")
        
        # Get exercises as student (public view)
        if 'etudiant' in self.tokens:
            exercises_result = self.run_test(
                "Get Exercises (Student)", "GET", "exercises", 200,
                token=self.tokens['etudiant']
            )
            if exercises_result:
                print(f"Student can see {len(exercises_result)} exercises")
                # Store an exercise ID for later testing
                if exercises_result:
                    self.test_data['sample_exercise_id'] = exercises_result[0]['id']
                    print(f"Using exercise ID for testing: {self.test_data['sample_exercise_id']}")
        
        # Create new exercise as formateur
        if 'formateur' in self.tokens:
            new_exercise_data = {
                "title": "Test Exercise API",
                "description": "Exercise created via API test",
                "category": "admin-systeme",
                "questions": [
                    {
                        "id": "q1",
                        "question_text": "Quelle commande Linux affiche le contenu d'un repertoire ?",
                        "question_type": "qcm",
                        "options": ["ls", "dir", "show", "list"],
                        "correct_answer": "ls",
                        "points": 2
                    },
                    {
                        "id": "q2", 
                        "question_text": "Expliquez la difference entre TCP et UDP.",
                        "question_type": "open",
                        "options": [],
                        "correct_answer": "TCP est oriente connexion avec controle d'erreur, UDP est sans connexion.",
                        "points": 4
                    }
                ],
                "time_limit": 10
            }
            
            created_exercise = self.run_test(
                "Create Exercise (Formateur)", "POST", "exercises", 201,
                data=new_exercise_data, token=self.tokens['formateur']
            )
            
            if created_exercise and 'id' in created_exercise:
                self.test_data['created_exercise_id'] = created_exercise['id']
                print(f"Created exercise with ID: {created_exercise['id']}")
                
                # Get specific exercise
                self.run_test(
                    "Get Specific Exercise", "GET", f"exercises/{created_exercise['id']}", 200,
                    token=self.tokens['formateur']
                )

        # Test student cannot create exercise
        if 'etudiant' in self.tokens:
            self.run_test(
                "Student Create Exercise (Should Fail)", "POST", "exercises", 403,
                data=new_exercise_data, token=self.tokens['etudiant']
            )

        return True

    def test_submissions(self):
        """Test submission workflow"""
        print("\n📝 Testing submissions...")
        
        if 'etudiant' not in self.tokens or 'sample_exercise_id' not in self.test_data:
            print("⚠️  Skipping submission tests - missing student token or exercise ID")
            return False

        student_token = self.tokens['etudiant']
        exercise_id = self.test_data['sample_exercise_id']
        
        # First get the exercise to see its questions
        exercise = self.run_test(
            "Get Exercise for Submission", "GET", f"exercises/{exercise_id}", 200,
            token=student_token
        )
        
        if exercise and 'questions' in exercise:
            questions = exercise['questions']
            
            # Create submission with sample answers
            answers = []
            for i, q in enumerate(questions[:2]):  # Answer first 2 questions only
                if q['question_type'] == 'qcm':
                    # Try to answer correctly if options available
                    answer = q['options'][0] if q.get('options') else "A"
                else:
                    answer = "Sample answer for open question"
                
                answers.append({
                    "question_id": q['id'],
                    "answer": answer
                })
            
            submission_data = {
                "exercise_id": exercise_id,
                "answers": answers
            }
            
            submission_result = self.run_test(
                "Create Submission", "POST", "submissions", 200,
                data=submission_data, token=student_token
            )
            
            if submission_result and 'id' in submission_result:
                submission_id = submission_result['id']
                self.test_data['submission_id'] = submission_id
                print(f"Created submission with ID: {submission_id}")
                
                # Get specific submission
                self.run_test(
                    "Get Specific Submission", "GET", f"submissions/{submission_id}", 200,
                    token=student_token
                )
                
                # Try submitting again (should fail - already submitted)
                self.run_test(
                    "Duplicate Submission (Should Fail)", "POST", "submissions", 400,
                    data=submission_data, token=student_token
                )

        # Get student's submissions
        self.run_test(
            "Get Student Submissions", "GET", "submissions", 200,
            token=student_token
        )
        
        # Test formateur can see all submissions
        if 'formateur' in self.tokens:
            self.run_test(
                "Get All Submissions (Formateur)", "GET", "submissions", 200,
                token=self.tokens['formateur']
            )

        return True

    def test_stats(self):
        """Test statistics endpoints"""
        print("\n📊 Testing statistics...")
        
        # Test admin/formateur stats
        if 'admin' in self.tokens:
            self.run_test(
                "Get Overview Stats (Admin)", "GET", "stats/overview", 200,
                token=self.tokens['admin']
            )
            
            self.run_test(
                "Get Students Tracking (Admin)", "GET", "stats/students-tracking", 200,
                token=self.tokens['admin']
            )
        
        # Test student stats
        if 'etudiant' in self.tokens:
            self.run_test(
                "Get Student Stats", "GET", "stats/student", 200,
                token=self.tokens['etudiant']
            )

        return True

    def test_ai_grading(self):
        """Test AI grading functionality"""
        print("\n🤖 Testing AI grading...")
        
        if 'formateur' not in self.tokens or 'submission_id' not in self.test_data:
            print("⚠️  Skipping AI grading tests - missing formateur token or submission")
            return False
            
        # Trigger AI grading
        result = self.run_test(
            "Trigger AI Grading", "POST", f"grade/{self.test_data['submission_id']}", 200,
            token=self.tokens['formateur']
        )
        
        return result is not None

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting SISR Backend API Tests")
        print("=" * 50)
        
        # Run tests in logical order
        test_methods = [
            self.test_seed_data,
            self.test_authentication, 
            self.test_user_management,
            self.test_categories,
            self.test_exercises,
            self.test_submissions,
            self.test_stats,
            self.test_ai_grading
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
            print("🎉 Backend tests mostly successful!")
        elif success_rate >= 60:
            print("⚠️  Backend has some issues but core functionality works")
        else:
            print("🚨 Backend has significant issues")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": success_rate,
            "results": self.test_results,
            "test_data": self.test_data,
            "tokens": {k: v[:20] + "..." for k, v in self.tokens.items()}  # Truncated tokens
        }

def main():
    tester = SISRBackendTester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results["success_rate"] >= 70 else 1

if __name__ == "__main__":
    sys.exit(main())