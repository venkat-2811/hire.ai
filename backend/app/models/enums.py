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


class WorkAuthorization(str, Enum):
    US_CITIZEN = "US Citizen"
    GREEN_CARD = "Green Card"
    GC_EAD = "GC EAD"
    H4_EAD = "H4 EAD"
    H1B = "H1B"
    H1B_TRANSFER = "H1B Transfer"
    OPT = "OPT"
    STEM_OPT = "STEM OPT"
    CPT = "CPT"
    TN_VISA = "TN Visa"
    L1 = "L1"
    L2_EAD = "L2 EAD"
    O1 = "O1"
    E3 = "E3"
    CANADIAN_CITIZEN = "Canadian Citizen"
    REQUIRES_SPONSORSHIP = "Requires Sponsorship"
    OTHER = "Other"


class EmploymentType(str, Enum):
    FULL_TIME = "Full Time"
    CONTRACT = "Contract"
    CONTRACT_TO_HIRE = "Contract to Hire"
    PART_TIME = "Part Time"
    INTERNSHIP = "Internship"
