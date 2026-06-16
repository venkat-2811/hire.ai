import re

with open('backend/app/prompts/interview.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_behavioral_questions_prompt JSON to include expected_answer
content = content.replace(
    '"difficulty_level": 3,',
    '"difficulty_level": 3,\n            "expected_answer": "Key points a strong verbal answer should cover in at most 2 lines",'
)

# Update technical prompt
content = content.replace(
    '"expected_answer": "Key points a strong verbal answer should cover",',
    '"expected_answer": "Key points a strong verbal answer should cover in at most 2 lines",'
)

with open('backend/app/prompts/interview.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Prompts updated successfully.")
