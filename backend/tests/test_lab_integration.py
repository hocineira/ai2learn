"""
AI2Lean Backend Tests - Lab Integration and Core APIs
Tests cover: Authentication, Exercise CRUD, Lab endpoints, Formation management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def seed_data(api_client):
    """Initialize seed data"""
    response = api_client.post(f"{BASE_URL}/api/seed")
    # Accept 200 (already seeded) or 200 (newly seeded)
    assert response.status_code == 200
    return response.json()

@pytest.fixture(scope="module")
def admin_token(api_client, seed_data):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="module")
def formateur_token(api_client, seed_data):
    """Get formateur authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "formateur",
        "password": "formateur123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="module")
def student_token(api_client, seed_data):
    """Get student (etudiant1) authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "etudiant1",
        "password": "etudiant123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="module")
def ais_student_token(api_client, seed_data):
    """Get AIS student authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "ais_student1",
        "password": "etudiant123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    return data["token"]

# ============== Authentication Tests ==============

class TestAuthentication:
    """Authentication endpoint tests"""

    def test_admin_login_success(self, api_client, seed_data):
        """Admin can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["username"] == "admin"

    def test_formateur_login_success(self, api_client, seed_data):
        """Formateur can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "formateur",
            "password": "formateur123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "formateur"

    def test_bts_student_login_success(self, api_client, seed_data):
        """BTS student can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "etudiant1",
            "password": "etudiant123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "etudiant"
        assert data["user"]["formation"] == "bts-sio-sisr"

    def test_ais_student_login_success(self, api_client, seed_data):
        """AIS student can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "ais_student1",
            "password": "etudiant123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "etudiant"
        assert data["user"]["formation"] == "bachelor-ais"

    def test_login_invalid_credentials(self, api_client, seed_data):
        """Login fails with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_auth_me_endpoint(self, api_client, admin_token):
        """Auth/me returns current user info"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"

# ============== Formations & Categories Tests ==============

class TestFormationsCategories:
    """Formation and category endpoint tests"""

    def test_get_formations(self, api_client):
        """Get all formations"""
        response = api_client.get(f"{BASE_URL}/api/formations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        formations_ids = [f["id"] for f in data]
        assert "bts-sio-sisr" in formations_ids
        assert "bachelor-ais" in formations_ids

    def test_get_categories_for_bts(self, api_client, admin_token):
        """Get categories for BTS formation"""
        response = api_client.get(f"{BASE_URL}/api/categories?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        cat_ids = [c["id"] for c in data]
        assert "reseaux" in cat_ids or "admin-systeme" in cat_ids

    def test_get_categories_for_ais(self, api_client, admin_token):
        """Get categories for Bachelor AIS formation"""
        response = api_client.get(f"{BASE_URL}/api/categories?formation=bachelor-ais", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

# ============== Exercise Tests (including Lab) ==============

class TestExercises:
    """Exercise CRUD and lab-specific tests"""

    def test_get_exercises_as_student(self, api_client, student_token):
        """Student can get exercises for their formation"""
        response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_exercises_returns_exercise_type(self, api_client, student_token):
        """Exercises include exercise_type field"""
        response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        # Check if lab exercise exists and has exercise_type
        lab_exercises = [e for e in data if e.get("exercise_type") == "lab"]
        if lab_exercises:
            lab = lab_exercises[0]
            assert lab["exercise_type"] == "lab"
            assert "lab_instructions" in lab

    def test_create_lab_exercise(self, api_client, formateur_token):
        """Formateur can create a lab exercise with lab-specific fields"""
        response = api_client.post(f"{BASE_URL}/api/exercises", headers={
            "Authorization": f"Bearer {formateur_token}"
        }, json={
            "title": "TEST_Lab Exercise - DNS Config",
            "description": "Configure DNS server on Windows Server",
            "category": "services-infra",
            "formation": "bts-sio-sisr",
            "exercise_type": "lab",
            "lab_instructions": "1. Open DNS Manager\n2. Create forward lookup zone\n3. Add A records",
            "lab_username": "Administrator",
            "lab_password": "TestPass123!",
            "questions": [
                {
                    "id": "test-q1",
                    "question_text": "What is DNS?",
                    "question_type": "qcm",
                    "options": ["Domain Name System", "Data Network Service", "Direct Naming Service", "None"],
                    "correct_answer": "Domain Name System",
                    "points": 2
                }
            ],
            "time_limit": 30
        })
        assert response.status_code == 201
        data = response.json()
        assert data["exercise_type"] == "lab"
        assert data["lab_instructions"] is not None
        assert data["lab_username"] == "Administrator"

    def test_get_single_exercise(self, api_client, student_token):
        """Can get a single exercise by ID"""
        # First get all exercises to get an ID
        list_response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert list_response.status_code == 200
        exercises = list_response.json()
        if not exercises:
            pytest.skip("No exercises found")
        
        exercise_id = exercises[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/exercises/{exercise_id}", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == exercise_id

# ============== Lab Endpoint Tests ==============

class TestLabEndpoints:
    """Lab-specific endpoint tests"""

    def test_get_lab_status_not_started(self, api_client, student_token):
        """Lab status returns not_started for new lab"""
        # Get lab exercise
        list_response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {student_token}"
        })
        exercises = list_response.json()
        lab_exercises = [e for e in exercises if e.get("exercise_type") == "lab"]
        
        if not lab_exercises:
            pytest.skip("No lab exercises found")
        
        lab_id = lab_exercises[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/labs/status/{lab_id}", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        # Either running or not_started is valid
        assert data.get("status") in ["not_started", "running"]

    def test_start_lab_proxmox_error_expected(self, api_client, student_token):
        """Lab start fails gracefully when Proxmox is unreachable"""
        # Get lab exercise
        list_response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {student_token}"
        })
        exercises = list_response.json()
        lab_exercises = [e for e in exercises if e.get("exercise_type") == "lab"]
        
        if not lab_exercises:
            pytest.skip("No lab exercises found")
        
        lab_id = lab_exercises[0]["id"]
        response = api_client.post(f"{BASE_URL}/api/labs/start", headers={
            "Authorization": f"Bearer {student_token}"
        }, json={"exercise_id": lab_id})
        
        # Expected: 500 error (Proxmox unreachable) or 200 if lab already running
        assert response.status_code in [200, 500]
        if response.status_code == 500:
            data = response.json()
            assert "detail" in data
            # Should contain Proxmox-related error
            assert "Proxmox" in data["detail"] or "provisionnement" in data["detail"]

    def test_lab_start_requires_student_role(self, api_client, admin_token):
        """Lab start is restricted to students"""
        # Get lab exercise
        list_response = api_client.get(f"{BASE_URL}/api/exercises?formation=bts-sio-sisr", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        exercises = list_response.json()
        lab_exercises = [e for e in exercises if e.get("exercise_type") == "lab"]
        
        if not lab_exercises:
            pytest.skip("No lab exercises found")
        
        lab_id = lab_exercises[0]["id"]
        response = api_client.post(f"{BASE_URL}/api/labs/start", headers={
            "Authorization": f"Bearer {admin_token}"
        }, json={"exercise_id": lab_id})
        
        # Admin should get 403
        assert response.status_code == 403

    def test_get_active_labs_admin(self, api_client, admin_token):
        """Admin can get list of active labs"""
        response = api_client.get(f"{BASE_URL}/api/labs/active", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_active_labs_student_forbidden(self, api_client, student_token):
        """Students cannot access active labs list"""
        response = api_client.get(f"{BASE_URL}/api/labs/active", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 403

# ============== Stats Tests ==============

class TestStats:
    """Statistics endpoint tests"""

    def test_admin_overview_stats(self, api_client, admin_token):
        """Admin can get overview stats"""
        response = api_client.get(f"{BASE_URL}/api/stats/overview", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "total_students" in data
        assert "total_exercises" in data
        assert "formation_stats" in data

    def test_student_stats(self, api_client, student_token):
        """Student can get their own stats"""
        response = api_client.get(f"{BASE_URL}/api/stats/student", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "total_exercises" in data
        assert "completed_exercises" in data

    def test_students_tracking_admin(self, api_client, admin_token):
        """Admin can access student tracking"""
        response = api_client.get(f"{BASE_URL}/api/stats/students-tracking", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

# ============== User Management Tests ==============

class TestUserManagement:
    """User management endpoint tests"""

    def test_admin_can_list_users(self, api_client, admin_token):
        """Admin can list all users"""
        response = api_client.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_student_cannot_list_users(self, api_client, student_token):
        """Students cannot list users"""
        response = api_client.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 403
