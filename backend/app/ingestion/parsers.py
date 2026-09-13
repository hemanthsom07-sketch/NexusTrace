import csv
import json
import xml.etree.ElementTree as ET

def parse_csv(path_or_content: str, is_raw_str: bool = False) -> list[dict]:
    rows = []
    if is_raw_str:
        lines = path_or_content.strip().splitlines()
        reader = csv.DictReader(lines)
        for i, row in enumerate(reader):
            row["_source_row"] = i
            rows.append(row)
    else:
        with open(path_or_content, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                row["_source_row"] = i
                rows.append(row)
    return rows

def parse_json(path_or_content: str, is_raw_str: bool = False) -> list[dict]:
    data = json.loads(path_or_content) if is_raw_str else json.load(open(path_or_content, encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array at top level, got {type(data)}")
    for i, row in enumerate(data):
        row["_source_row"] = i
    return data

def parse_xml(path_or_content: str, is_raw_str: bool = False) -> list[dict]:
    root = ET.fromstring(path_or_content) if is_raw_str else ET.parse(path_or_content).getroot()
    rows = []
    for i, elem in enumerate(root):
        row = {"_source_row": i}
        for child in elem:
            if child.tag in ("input_addresses", "output_addresses", "input_amounts", "output_amounts"):
                row[child.tag] = [item.text for item in child]
            else:
                row[child.tag] = child.text
        rows.append(row)
    return rows