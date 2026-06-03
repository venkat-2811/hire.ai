import asyncio
from app.models.schemas import JobDescription
from app.services.question_generator import get_question_generator
import os

async def main():
    os.environ["OPENAI_API_KEY"] = "dummy" # This might fail if the real app needs actual keys, but the backend is running.
    # Actually, the real app should use the .env keys
    from dotenv import load_dotenv
    load_dotenv()
    
    qgen = get_question_generator()
    job = JobDescription(
        id="test",
        title="Test Job",
        role="software_engineer",
        level="mid",
        description="Test",
        must_have_skills=["python"],
        good_to_have_skills=["sql"],
        min_experience_years=2,
        is_active=True
    )
    
    print("Generating MCQs...")
    try:
        mcqs = await qgen.generate_mcq_questions(job, count=2, difficulty="easy")
        print(f"Generated {len(mcqs)} MCQs")
    except Exception as e:
        print(f"MCQ error: {e}")
    
    print("Generating SQL...")
    try:
        sql = await qgen.generate_sql_challenges(job, count=1, difficulty="easy")
        print(f"Generated {len(sql)} SQL challenges")
    except Exception as e:
        print(f"SQL error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
