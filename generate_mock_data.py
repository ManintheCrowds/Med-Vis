import json
import random
from datetime import datetime, timedelta
import os
import uuid
from supabase import create_client

# Set environment variables directly
os.environ['NEXT_PUBLIC_SUPABASE_URL'] = 'https://hdnyomaryleszrjbuprt.supabase.co'
os.environ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbnlvbWFyeWxlc3pyamJ1cHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzE2OTc2OSwiZXhwIjoyMDYyNzQ1NzY5fQ.fhsW-nV_8X0w7kKpuKLsvR9GpKAaW0_r1SVPgDkhzX4'

# Initialize Supabase client
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')
)

locations = [
    'minneapolis', 'galway', 'dublin', 'shanghai', 'tokyo', 'singapore',
    'tempe', 'santa rosa', 'boulder', 'memphis', 'hangzhou', 'seoul'
]

first_names = [
    'james', 'sarah', 'michael', 'emma', 'david', 'olivia', 'john', 'sophia',
    'robert', 'isabella', 'william', 'mia', 'richard', 'charlotte', 'joseph',
    'wei', 'yuki', 'mei', 'takeshi', 'priya', 'raj', 'anika', 'sung',
    'soren', 'elena', 'liam', 'fatima', 'carlos', 'zara', 'mateo', 'nina'
]

learning_styles = [
    'visual',
    'auditory',
    'kinesthetic',
    'reading_writing'
]

shaped_by_options = [
    'mentor',
    'challenge',
    'failure',
    'success',
    'team',
    'other'
]

peak_performance_options = [
    'individual',
    'team',
    'leadership',
    'innovation',
    'crisis'
]

motivation_options = [
    'impact',
    'growth',
    'recognition',
    'autonomy',
    'purpose'
]

unique_qualities = [
    "My background in both healthcare and engineering allows me to bridge communication gaps between clinical and technical teams.",
    "Having lived in multiple countries, I naturally connect with diverse perspectives and find common ground when teams face cultural barriers.",
    "I'm known for my ability to remain calm and clear-headed during high-pressure situations, which has been particularly valuable during critical product launches.",
    "My multicultural upbringing has given me a unique lens for problem-solving that combines analytical precision with empathetic understanding of user needs.",
    "Despite my long tenure, I maintain a beginner's mindset that allows me to constantly question assumptions and find innovative approaches to longstanding challenges.",
    "My experience as a competitive athlete taught me how to rapidly adapt to changing circumstances and thrive under pressure, skills I bring to every project.",
    "I have a rare combination of technical expertise and communication skills that allows me to translate complex regulatory requirements into actionable engineering guidelines.",
    "Having been a patient who used a Medtronic device before joining the company, I bring genuine empathy and firsthand experience to our patient-centered design discussions.",
    "I excel at seeing connections between seemingly unrelated fields, which has led to several cross-functional innovations that merged technologies from different business units.",
    "My dual background in materials science and medicine gives me unique insights when troubleshooting biocompatibility issues in product development.",
    "I've developed a talent for spotting hidden talent in teams and creating opportunities for people to shine in ways they didn't know they could.",
    "I bring a unique combination of clinical nursing experience and software development skills that helps me create more intuitive user interfaces for our medical devices.",
    "My experience working across three different industries before healthcare gives me fresh perspectives on challenges that others might see as insurmountable due to industry traditions.",
    "I have an unusual ability to take complex scientific concepts and translate them into accessible language for diverse audiences, from regulators to sales teams.",
    "My synesthetic perception allows me to visualize data relationships in unique ways, often finding correlations in research data that standard analysis might miss."
]

def generate_fake_attendees():
    attendees = []
    for i in range(300):
        attendee = {
            "id": str(uuid.uuid4()),
            "first_name": random.choice(first_names),
            "last_name": f"{random.choice(locations)}{random.randint(100, 999)}",
            "email": f"test{i}@example.com",
            "is_anonymous": random.random() < 0.1,
            "created_at": datetime.now().isoformat() + "Z",
            "updated_at": datetime.now().isoformat() + "Z"
        }
        attendees.append(attendee)
    return attendees

def generate_mock_data(attendee_ids):
    base_date = datetime(2025, 7, 8, 9, 0)
    medtronic_data = []

    for i, attendee_id in enumerate(attendee_ids):
        entry = {
            "id": str(uuid.uuid4()),
            "attendee_id": attendee_id,
            "years_at_medtronic": random.randint(0, 24),
            "learning_style": random.choice(learning_styles),
            "shaped_by": random.choice(shaped_by_options),
            "peak_performance": random.choice(peak_performance_options),
            "motivation": random.choice(motivation_options),
            "unique_quality": random.choice(unique_qualities),
            "status": "approved",
            "test_data": True,
            "created_at": (base_date + timedelta(minutes=3 * i)).isoformat() + "Z",
            "updated_at": datetime.now().isoformat() + "Z"
        }
        medtronic_data.append(entry)

    return {"medtronic_data": medtronic_data}

# Generate and insert fake attendees
attendees = generate_fake_attendees()
attendee_ids = []

for attendee in attendees:
    response = supabase.table('attendees').insert(attendee).execute()
    attendee_ids.append(attendee['id'])

print("Fake attendees have been inserted into Supabase!")

# Generate and insert survey responses
mock_data = generate_mock_data(attendee_ids)

for entry in mock_data["medtronic_data"]:
    supabase.table('survey_responses').insert(entry).execute()

print("Mock survey responses have been injected into Supabase!")

# Optionally, save to JSON file for backup
with open("src/data/mockSurveyResponses3.json", "w") as f:
    json.dump(mock_data, f, indent=2)

print("Mock data has also been written to src/data/mockSurveyResponses3.json") 