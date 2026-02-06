from enum import Enum




class RoleLevel(str, Enum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"


class InterviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssessmentType(str, Enum):
    TECHNICAL = "technical"
    PRACTICAL = "practical"
    BEHAVIORAL = "behavioral"


class HireRecommendation(str, Enum):
    STRONG_HIRE = "strong_hire"
    HIRE = "hire"
    BORDERLINE = "borderline"
    NO_HIRE = "no_hire"


class ReasonCodeType(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class SkillRelevance(str, Enum):
    MUST_HAVE = "must_have"
    GOOD_TO_HAVE = "good_to_have"
