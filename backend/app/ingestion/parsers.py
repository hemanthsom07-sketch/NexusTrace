"""
ingestion/parsers.py -- Phase 2.2

Intentionally dumb: read the file into plain Python dicts, one per row.
No validation, no schema enforcement here -- that's normalize.py's job.
Keeping these two concerns separate means a parsing bug and a validation
bug never get confused with each other while debugging.
"""
import csv
import json


def parse_csv(path: str) -> list[dict]:
    """Read a CSV file into a list of raw dicts (all values as strings)."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            row["_source_row"] = i
            rows.append(row)
    return rows


def parse_json(path: str) -> list[dict]:
    """Read a JSON file (a top-level list of objects) into a list of raw dicts."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array at top level of {path}, got {type(data)}")
    for i, row in enumerate(data):
        row["_source_row"] = i
    return data


# XML parser -- Phase 2.3, P1. Only build this out if the real SIH dataset
# actually includes XML files. Left as a stub so the import doesn't break
# anything that references it, but it deliberately raises until someone
# needs it for real.
def parse_xml(path: str) -> list[dict]:
    raise NotImplementedError(
        "XML ingestion not yet implemented (P1) -- add this only if the "
        "real dataset provides XML files. See implementation plan Phase 2.3."
    )
