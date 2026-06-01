import sqlite3
import time
import re
from typing import Dict, Any, Tuple, List

class SQLExecutorError(Exception):
    pass

class SQLExecutor:
    """
    Safely executes candidate SQL queries using an in-memory SQLite database.
    This acts as a proxy for MySQL to support standard LeetCode SQL features
    (Joins, CTEs, Window Functions, etc.) securely without docker.
    """
    
    @staticmethod
    def _is_safe_query(query: str) -> bool:
        """Basic validation to prevent destructive operations."""
        # Strip block comments (/* ... */)
        cleaned_query = re.sub(r'/\*.*?\*/', '', query, flags=re.DOTALL)
        # Strip line comments (-- ...)
        cleaned_query = re.sub(r'--.*', '', cleaned_query)
        # Strip string literals ('...' and "...") so we don't flag words inside them
        cleaned_query = re.sub(r"'[^']*'", "''", cleaned_query)
        cleaned_query = re.sub(r'"[^"]*"', '""', cleaned_query)
        
        query_upper = cleaned_query.strip().upper()
        
        if not query_upper:
            return False
            
        # Ensure it starts with SELECT or WITH
        if not query_upper.startswith('SELECT') and not query_upper.startswith('WITH'):
            return False
            
        # Prevent destructive operations
        forbidden = [
            'DROP', 'DELETE', 'ALTER', 'TRUNCATE', 'UPDATE', 'INSERT', 
            'CREATE', 'GRANT', 'REVOKE', 'ATTACH', 'DETACH', 'PRAGMA'
        ]
        
        # Check for forbidden keywords (simplified word boundary check)
        for word in forbidden:
            if re.search(rf'\b{word}\b', query_upper):
                return False
                
        return True

    @staticmethod
    def execute_query(db_schema: str, sample_data: str, query: str) -> Tuple[List[Dict[str, Any]], str, float]:
        """
        Executes a query and returns the results, error message (if any), and execution time.
        """
        start_time = time.time()
        
        if not query or not str(query).strip():
            return [], "Query is empty.", 0.0
            
        if not SQLExecutor._is_safe_query(query):
            return [], "Invalid Query: Only SELECT queries are permitted.", 0.0

        try:
            # Create in-memory database
            conn = sqlite3.connect(':memory:')
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Setup Schema
            if db_schema:
                cursor.executescript(db_schema)
                
            # Setup Data
            if sample_data:
                cursor.executescript(sample_data)
                
            # Execute Candidate Query
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Format results as list of dicts
            result_data = [dict(row) for row in rows]
            
            conn.close()
            
            exec_time = time.time() - start_time
            return result_data, "", exec_time
            
        except sqlite3.Error as e:
            exec_time = time.time() - start_time
            return [], f"SQL Error: {str(e)}", exec_time
        except Exception as e:
            exec_time = time.time() - start_time
            return [], f"Execution Error: {str(e)}", exec_time

    @staticmethod
    def evaluate_submission(db_schema: str, sample_data: str, candidate_query: str, expected_query: str) -> Dict[str, Any]:
        """
        Evaluates a candidate's SQL query against the expected query.
        Returns a dictionary with the evaluation results.
        """
        # Execute Expected Query to get the correct result
        expected_result, exp_err, _ = SQLExecutor.execute_query(db_schema, sample_data, expected_query)
        
        if exp_err:
            # This indicates an issue with the AI generated question/schema itself
            return {
                "score": 0,
                "feedback": f"System Error: Invalid expected query or schema. Please contact support. Error: {exp_err}",
                "execution_result": "Runtime Error",
                "status": "Runtime Error"
            }
            
        # Execute Candidate Query
        candidate_result, cand_err, exec_time = SQLExecutor.execute_query(db_schema, sample_data, candidate_query)
        
        if cand_err:
            return {
                "score": 0,
                "feedback": cand_err,
                "execution_result": "Runtime Error",
                "status": "Runtime Error"
            }
            
        # Compare Results
        # First, compare lengths
        if len(candidate_result) != len(expected_result):
            return {
                "score": 0,
                "feedback": f"Wrong Answer: Expected {len(expected_result)} rows, but got {len(candidate_result)} rows.",
                "execution_result": "Wrong Answer",
                "status": "Wrong Answer"
            }
            
        # Check if columns match exactly
        if expected_result:
            exp_cols = set(expected_result[0].keys())
            cand_cols = set(candidate_result[0].keys()) if candidate_result else set()
            
            # SQLite might return different casing or aliases, but we enforce exact column match if possible
            # or we can compare values regardless of column names if there's only 1 column
            if exp_cols != cand_cols and not (len(exp_cols) == 1 and len(cand_cols) == 1):
                # Minor penalty or feedback about column names
                pass
                
        # To handle ORDER BY properly:
        # If the expected query has an ORDER BY, the order must match.
        # But SQLite doesn't strictly guarantee order unless ORDER BY is specified.
        # Since we don't parse the expected query to check for ORDER BY, 
        # we will do an exact ordered match first. If that fails, we check unordered match.
        
        # Normalize data for comparison
        def normalize_row(row):
            return tuple(sorted((str(k).lower(), str(v)) for k, v in row.items()))
            
        exp_normalized = [normalize_row(r) for r in expected_result]
        cand_normalized = [normalize_row(r) for r in candidate_result]
        
        if exp_normalized == cand_normalized:
            return {
                "score": 100,
                "feedback": "Accepted! Your query returned the expected results.",
                "execution_result": "Accepted",
                "status": "Accepted",
                "time_taken_seconds": exec_time
            }
            
        # If order doesn't match, check if unordered matches
        # Note: If the question requires ordering, this will incorrectly give 100%,
        # but in LeetCode DB questions, unordered matches are usually Wrong Answers.
        # We will enforce exact order if the results differ only in order.
        if sorted(exp_normalized) == sorted(cand_normalized):
             return {
                "score": 80,
                "feedback": "Wrong Answer (Order Mismatch): Your query returned the correct rows, but in the wrong order. Ensure you have the correct ORDER BY clause.",
                "execution_result": "Wrong Answer",
                "status": "Wrong Answer",
                "time_taken_seconds": exec_time
            }
            
        # Completely wrong data
        return {
            "score": 0,
            "feedback": "Wrong Answer: The query results do not match the expected output.",
            "execution_result": "Wrong Answer",
            "status": "Wrong Answer",
            "time_taken_seconds": exec_time
        }
