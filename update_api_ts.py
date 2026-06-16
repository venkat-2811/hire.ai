import re

with open('src/lib/api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_method = """
  async generateExpectedAnswers(candidateId: string, jobId?: string): Promise<{ status: string; updated: boolean; questions: any[] }> {
    return apiPost(`candidates/${candidateId}/generate-expected-answers${jobId ? `?job_id=${jobId}` : ''}`);
  },
"""

# Insert right after `export const candidatesApi = {`
if "generateExpectedAnswers" not in content:
    content = content.replace("export const candidatesApi = {", "export const candidatesApi = {" + new_method)
    with open('src/lib/api.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added generateExpectedAnswers to api.ts")
else:
    print("generateExpectedAnswers already exists")
