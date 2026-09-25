RISK_CLASSES = ["HIGH", "LOW", "MEDIUM"]


def is_valid_risk_level(level: str) -> bool:
    return level in RISK_CLASSES
