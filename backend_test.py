import requests
import sys
import json
from datetime import datetime

class AI2LeanBackendTester:
    def __init__(self, base_url="https://api-corrector.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users (admin, formateur, etudiant1, ais_student1)
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
        """Test authentication flows for multi-formation users"""
        print("\n🔐 Testing authentication...")
        
        # Test admin login
        admin_result = self.run_test(
            "Admin Login", "POST", "auth/login", 200,
            data={"username": "admin", "password": "admin123"}
        )
        if admin_result and 'token' in admin_result:
            self.tokens['admin'] = admin_result['token']
            print(f"✅ Admin user: {admin_result['user']['full_name']} | Role: {admin_result['user']['role']} | Formation: {admin_result['user']['formation']}")
        
        # Test formateur login
        formateur_result = self.run_test(
            "Formateur Login", "POST", "auth/login", 200,
            data={"username": "formateur", "password": "formateur123"}
        )
        if formateur_result and 'token' in formateur_result:
            self.tokens['formateur'] = formateur_result['token']
            print(f"✅ Formateur user: {formateur_result['user']['full_name']} | Role: {formateur_result['user']['role']} | Formation: {formateur_result['user']['formation']}")
        
        # Test BTS student login
        bts_student_result = self.run_test(
            "BTS Student Login", "POST", "auth/login", 200,
            data={"username": "etudiant1", "password": "etudiant123"}
        )
        if bts_student_result and 'token' in bts_student_result:
            self.tokens['etudiant1'] = bts_student_result['token']
            print(f"✅ BTS Student: {bts_student_result['user']['full_name']} | Role: {bts_student_result['user']['role']} | Formation: {bts_student_result['user']['formation']}")
        
        # Test AIS student login 
        ais_student_result = self.run_test(
            "AIS Student Login", "POST", "auth/login", 200,
            data={"username": "ais_student1", "password": "etudiant123"}
        )
        if ais_student_result and 'token' in ais_student_result:
            self.tokens['ais_student1'] = ais_student_result['token']
            print(f"✅ AIS Student: {ais_student_result['user']['full_name']} | Role: {ais_student_result['user']['role']} | Formation: {ais_student_result['user']['formation']}")
        
        # Test invalid login
        self.run_test(
            "Invalid Login", "POST", "auth/login", 401,
            data={"username": "invalid", "password": "wrong"}
        )
        
        # Test /auth/me for each user
        for user_type, token in self.tokens.items():
            me_result = self.run_test(
                f"{user_type} Profile Check", "GET", "auth/me", 200,
                token=token
            )
            if me_result:
                print(f"   Profile verified for {user_type}: {me_result.get('full_name')} ({me_result.get('formation')})")

        return len(self.tokens) >= 4

    def test_user_management(self):
        """Test user management with formation filtering"""
        print("\n👥 Testing user management...")
        
        if 'admin' not in self.tokens:
            print("⚠️  Skipping user management tests - no admin token")
            return False

        admin_token = self.tokens['admin']
        
        # Get all users
        all_users_result = self.run_test(
            "Get All Users", "GET", "users", 200,
            token=admin_token
        )
        
        if all_users_result:
            print(f"✅ Found {len(all_users_result)} total users")
            
            # Count users by formation
            formations_count = {}
            for user in all_users_result:
                formation = user.get('formation', 'unknown')
                formations_count[formation] = formations_count.get(formation, 0) + 1
            
            for formation, count in formations_count.items():
                print(f"   - {formation}: {count} users")
        
        # Test formation filtering
        bts_users = self.run_test(
            "Get BTS Users", "GET", "users", 200,
            params={"formation": "bts-sio-sisr"}, token=admin_token
        )
        if bts_users:
            print(f"✅ BTS SIO SISR: {len(bts_users)} users")
        
        ais_users = self.run_test(
            "Get AIS Users", "GET", "users", 200,
            params={"formation": "bachelor-ais"}, token=admin_token
        )
        if ais_users:
            print(f"✅ Bachelor AIS: {len(ais_users)} users")
        
        # Test formateur can access users
        if 'formateur' in self.tokens:
            self.run_test(
                "Formateur Access Users", "GET", "users", 200,
                token=self.tokens['formateur']
            )
        
        # Test student cannot access users
        if 'etudiant1' in self.tokens:
            self.run_test(
                "Student Access Users (Should Fail)", "GET", "users", 403,
                token=self.tokens['etudiant1']
            )

        return True

    def test_formations_and_categories(self):
        """Test formations and formation-specific categories"""
        print("\n🎓 Testing formations and categories...")
        
        # Test formations endpoint
        formations_result = self.run_test("Get Formations", "GET", "formations", 200)
        if formations_result:
            print(f"✅ Found {len(formations_result)} formations:")
            for f in formations_result:
                print(f"   - {f['name']} ({f['id']}): {f['description']}")
        
        # Test categories for BTS SIO SISR
        bts_categories = self.run_test(
            "Get BTS Categories", "GET", "categories", 200, 
            params={"formation": "bts-sio-sisr"}
        )
        if bts_categories:
            print(f"✅ BTS SIO SISR has {len(bts_categories)} categories:")
            for cat in bts_categories:
                print(f"   - {cat['name']} ({cat['id']})")
        
        # Test categories for Bachelor AIS
        ais_categories = self.run_test(
            "Get AIS Categories", "GET", "categories", 200,
            params={"formation": "bachelor-ais"}
        )
        if ais_categories:
            print(f"✅ Bachelor AIS has {len(ais_categories)} categories:")
            for cat in ais_categories:
                print(f"   - {cat['name']} ({cat['id']})")
        
        # Verify categories are different between formations
        if bts_categories and ais_categories:
            bts_cat_ids = {cat['id'] for cat in bts_categories}
            ais_cat_ids = {cat['id'] for cat in ais_categories}
            shared_cats = bts_cat_ids.intersection(ais_cat_ids)
            if len(shared_cats) == 0:
                self.log_result("Formation Categories Different", True, "Categories properly differentiated by formation")
            else:
                self.log_result("Formation Categories Different", False, f"Found {len(shared_cats)} shared categories")
        
        return formations_result is not None

    def test_exercises(self):
        """Test exercise management with formation filtering"""
        print("\n📚 Testing exercises...")
        
        # Test exercises for BTS students
        if 'etudiant1' in self.tokens:
            bts_exercises = self.run_test(
                "Get Exercises (BTS Student)", "GET", "exercises", 200,
                params={"formation": "bts-sio-sisr"}, token=self.tokens['etudiant1']
            )
            if bts_exercises:
                print(f"✅ BTS student sees {len(bts_exercises)} exercises")
                bts_exercise_titles = [ex['title'] for ex in bts_exercises]
                print(f"   BTS exercises: {', '.join(bts_exercise_titles[:3])}")
                if bts_exercises:
                    self.test_data['bts_exercise_id'] = bts_exercises[0]['id']
        
        # Test exercises for AIS students
        if 'ais_student1' in self.tokens:
            ais_exercises = self.run_test(
                "Get Exercises (AIS Student)", "GET", "exercises", 200,
                params={"formation": "bachelor-ais"}, token=self.tokens['ais_student1']
            )
            if ais_exercises:
                print(f"✅ AIS student sees {len(ais_exercises)} exercises")
                ais_exercise_titles = [ex['title'] for ex in ais_exercises]
                print(f"   AIS exercises: {', '.join(ais_exercise_titles[:3])}")
                if ais_exercises:
                    self.test_data['ais_exercise_id'] = ais_exercises[0]['id']
        
        # Test formateur can see exercises from different formations
        if 'formateur' in self.tokens:
            formateur_exercises = self.run_test(
                "Get All Exercises (Formateur)", "GET", "exercises", 200,
                token=self.tokens['formateur']
            )
            if formateur_exercises:
                print(f"✅ Formateur sees {len(formateur_exercises)} total exercises")
        
        # Create new BTS exercise as formateur
        if 'formateur' in self.tokens:
            bts_exercise_data = {
                "title": "Test BTS Exercise API",
                "description": "BTS exercise created via API test",
                "category": "admin-systeme",
                "formation": "bts-sio-sisr",
                "shared": False,
                "questions": [
                    {
                        "id": "q1",
                        "question_text": "Quelle commande Linux affiche le contenu d'un repertoire ?",
                        "question_type": "qcm",
                        "options": ["ls", "dir", "show", "list"],
                        "correct_answer": "ls",
                        "points": 2
                    }
                ],
                "time_limit": 10
            }
            
            created_bts_exercise = self.run_test(
                "Create BTS Exercise", "POST", "exercises", 201,
                data=bts_exercise_data, token=self.tokens['formateur']
            )
            
            if created_bts_exercise and 'id' in created_bts_exercise:
                self.test_data['created_bts_exercise_id'] = created_bts_exercise['id']
                print(f"✅ Created BTS exercise: {created_bts_exercise['id']}")
        
        # Create new AIS exercise as formateur
        if 'formateur' in self.tokens:
            ais_exercise_data = {
                "title": "Test AIS Exercise API",
                "description": "AIS exercise created via API test",
                "category": "admin-securise",
                "formation": "bachelor-ais",
                "shared": False,
                "questions": [
                    {
                        "id": "q1",
                        "question_text": "Quel outil permet de scanner les ports ouverts ?",
                        "question_type": "qcm",
                        "options": ["Wireshark", "Nmap", "Ansible", "Nagios"],
                        "correct_answer": "Nmap",
                        "points": 3
                    }
                ],
                "time_limit": 15
            }
            
            created_ais_exercise = self.run_test(
                "Create AIS Exercise", "POST", "exercises", 201,
                data=ais_exercise_data, token=self.tokens['formateur']
            )
            
            if created_ais_exercise and 'id' in created_ais_exercise:
                self.test_data['created_ais_exercise_id'] = created_ais_exercise['id']
                print(f"✅ Created AIS exercise: {created_ais_exercise['id']}")

        # Test student cannot create exercise
        if 'etudiant1' in self.tokens:
            self.run_test(
                "Student Create Exercise (Should Fail)", "POST", "exercises", 403,
                data=bts_exercise_data, token=self.tokens['etudiant1']
            )

        return True

    def test_submissions(self):
        """Test submission workflow for both formations"""
        print("\n📝 Testing submissions...")
        
        # Test BTS student submission
        if 'etudiant1' in self.tokens and 'bts_exercise_id' in self.test_data:
            self._test_student_submission('etudiant1', 'bts_exercise_id', 'BTS')
        
        # Test AIS student submission
        if 'ais_student1' in self.tokens and 'ais_exercise_id' in self.test_data:
            self._test_student_submission('ais_student1', 'ais_exercise_id', 'AIS')
        
        # Test formateur can see all submissions
        if 'formateur' in self.tokens:
            all_submissions = self.run_test(
                "Get All Submissions (Formateur)", "GET", "submissions", 200,
                token=self.tokens['formateur']
            )
            if all_submissions:
                print(f"✅ Formateur sees {len(all_submissions)} total submissions")
        
        return True
    
    def _test_student_submission(self, student_key, exercise_key, formation_name):
        """Helper to test submission for a specific student"""
        student_token = self.tokens[student_key]
        exercise_id = self.test_data[exercise_key]
        
        # Get the exercise to see its questions
        exercise = self.run_test(
            f"Get {formation_name} Exercise for Submission", "GET", f"exercises/{exercise_id}", 200,
            token=student_token
        )
        
        if exercise and 'questions' in exercise:
            questions = exercise['questions']
            
            # Create submission with sample answers
            answers = []
            for q in questions:
                if q['question_type'] == 'qcm':
                    # Use correct answer if it's in options
                    answer = q.get('correct_answer', q['options'][0] if q.get('options') else 'A')
                else:
                    answer = f"Sample answer for {formation_name} open question"
                
                answers.append({
                    "question_id": q['id'],
                    "answer": answer
                })
            
            submission_data = {
                "exercise_id": exercise_id,
                "answers": answers
            }
            
            submission_result = self.run_test(
                f"Create {formation_name} Submission", "POST", "submissions", 200,
                data=submission_data, token=student_token
            )
            
            if submission_result and 'id' in submission_result:
                submission_id = submission_result['id']
                self.test_data[f'{formation_name.lower()}_submission_id'] = submission_id
                print(f"✅ Created {formation_name} submission: {submission_id}")
                
                # Verify student can see their submission
                self.run_test(
                    f"Get {formation_name} Submission", "GET", f"submissions/{submission_id}", 200,
                    token=student_token
                )
        
        # Get all submissions for this student
        student_submissions = self.run_test(
            f"Get {formation_name} Student Submissions", "GET", "submissions", 200,
            token=student_token
        )
        if student_submissions:
            print(f"✅ {formation_name} student has {len(student_submissions)} submissions")

    def test_stats(self):
        """Test statistics endpoints with formation filtering"""
        print("\n📊 Testing statistics...")
        
        # Test admin overview stats (all formations)
        if 'admin' in self.tokens:
            admin_stats = self.run_test(
                "Get Overview Stats (Admin - All)", "GET", "stats/overview", 200,
                token=self.tokens['admin']
            )
            if admin_stats:
                print(f"✅ Admin sees stats for all formations:")
                if 'formation_stats' in admin_stats:
                    for f_stat in admin_stats['formation_stats']:
                        print(f"   - {f_stat['name']}: {f_stat['students']} students, {f_stat['exercises']} exercises")
            
            # Test BTS-specific stats
            bts_stats = self.run_test(
                "Get BTS Stats (Admin)", "GET", "stats/overview", 200,
                params={"formation": "bts-sio-sisr"}, token=self.tokens['admin']
            )
            
            # Test AIS-specific stats
            ais_stats = self.run_test(
                "Get AIS Stats (Admin)", "GET", "stats/overview", 200,
                params={"formation": "bachelor-ais"}, token=self.tokens['admin']
            )
            
            # Test students tracking with formation filter
            bts_tracking = self.run_test(
                "Get BTS Students Tracking", "GET", "stats/students-tracking", 200,
                params={"formation": "bts-sio-sisr"}, token=self.tokens['admin']
            )
            if bts_tracking:
                print(f"✅ BTS tracking: {len(bts_tracking)} students")
            
            ais_tracking = self.run_test(
                "Get AIS Students Tracking", "GET", "stats/students-tracking", 200,
                params={"formation": "bachelor-ais"}, token=self.tokens['admin']
            )
            if ais_tracking:
                print(f"✅ AIS tracking: {len(ais_tracking)} students")
        
        # Test formateur stats (should be formation-aware)
        if 'formateur' in self.tokens:
            formateur_stats = self.run_test(
                "Get Stats (Formateur)", "GET", "stats/overview", 200,
                token=self.tokens['formateur']
            )
        
        # Test student stats (BTS)
        if 'etudiant1' in self.tokens:
            bts_student_stats = self.run_test(
                "Get BTS Student Stats", "GET", "stats/student", 200,
                token=self.tokens['etudiant1']
            )
            if bts_student_stats:
                print(f"✅ BTS student stats: {bts_student_stats.get('completed_exercises', 0)} completed")
        
        # Test student stats (AIS)
        if 'ais_student1' in self.tokens:
            ais_student_stats = self.run_test(
                "Get AIS Student Stats", "GET", "stats/student", 200,
                token=self.tokens['ais_student1']
            )
            if ais_student_stats:
                print(f"✅ AIS student stats: {ais_student_stats.get('completed_exercises', 0)} completed")

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
        print("🧪 Starting AI2Lean Multi-Formation Backend API Tests")
        print("=" * 60)
        
        # Run tests in logical order
        test_methods = [
            self.test_seed_data,
            self.test_authentication, 
            self.test_formations_and_categories,
            self.test_user_management,
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
    tester = AI2LeanBackendTester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results["success_rate"] >= 70 else 1

if __name__ == "__main__":
    sys.exit(main())