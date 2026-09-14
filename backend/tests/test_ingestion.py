import io
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON
from app.ingestion.parsers import parse_csv, parse_json, parse_xml
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.api.routes import _validate_dataset, _split_merged_rows
from app.main import app


client = TestClient(app)


# ---------------------------------------------------------------------------
# Existing parser / normalizer coverage
# ---------------------------------------------------------------------------

def test_parse_csv_reads_all_rows():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    assert len(rows) == 20


def test_parse_json_reads_all_rows():
    rows = parse_json(DEFAULT_SAMPLE_TX_JSON)
    assert len(rows) == 18


def test_normalize_skips_missing_src_ip():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    events, skipped = normalize_network_events(rows)

    assert len(skipped) == 1
    assert "missing src_ip" in skipped[0]["reason"]
    assert len(events) == 19


def test_normalize_transactions_all_valid():
    rows = parse_json(DEFAULT_SAMPLE_TX_JSON)
    transactions, skipped = normalize_transactions(rows)

    assert len(skipped) == 0
    assert len(transactions) == 18


def test_normalize_network_event_fields():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    events, _ = normalize_network_events(rows)

    first = events[0]

    assert first.src_ip == "45.33.1.10"
    assert first.src_port == 8333
    assert first.timestamp == 1735700400.0


# ---------------------------------------------------------------------------
# Modern upload-format coverage
# ---------------------------------------------------------------------------

def test_normalize_iso_timestamp_and_json_arrays():
    network_rows = [
        {
            "_source_row": 2,
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": "8333",
            "dst_port": "8333",
        }
    ]

    tx_rows = [
        {
            "_source_row": 2,
            "timestamp": "2026-08-01T09:07:13",
            "txid": "TXN0001",
            "input_addresses": '["bc1qinputwallet"]',
            "output_addresses": '["bc1qoutputwallet"]',
            "input_amounts": "[1.25]",
            "output_amounts": "[1.24]",
        }
    ]

    events, event_skipped = normalize_network_events(network_rows)
    transactions, tx_skipped = normalize_transactions(tx_rows)

    assert len(event_skipped) == 0
    assert len(tx_skipped) == 0

    assert len(events) == 1
    assert events[0].src_ip == "45.33.1.10"
    assert events[0].timestamp > 0

    assert len(transactions) == 1
    assert transactions[0].txid == "TXN0001"
    assert transactions[0].input_addresses == ["bc1qinputwallet"]
    assert transactions[0].output_addresses == ["bc1qoutputwallet"]
    assert transactions[0].input_amounts == [1.25]
    assert transactions[0].output_amounts == [1.24]


def test_parse_xml_reads_records():
    xml_content = """
    <records>
        <record>
            <timestamp>2026-08-01T09:07:13</timestamp>
            <src_ip>45.33.1.10</src_ip>
            <dst_ip>8.8.8.8</dst_ip>
            <src_port>8333</src_port>
            <dst_port>8333</dst_port>
        </record>
        <record>
            <timestamp>2026-08-01T09:08:13</timestamp>
            <src_ip>51.38.72.19</src_ip>
            <dst_ip>8.8.4.4</dst_ip>
            <src_port>8333</src_port>
            <dst_port>8333</dst_port>
        </record>
    </records>
    """

    rows = parse_xml(xml_content, is_raw_str=True)

    assert len(rows) == 2
    assert rows[0]["src_ip"] == "45.33.1.10"
    assert rows[1]["src_ip"] == "51.38.72.19"


# ---------------------------------------------------------------------------
# Validation coverage
# ---------------------------------------------------------------------------

def test_validate_dataset_detects_required_fields():
    network = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": 8333,
            "dst_port": 8333,
            "txid": "TXN0001",
        }
    ]

    blockchain = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "txid": "TXN0001",
            "input_addresses": '["bc1qinput"]',
            "output_addresses": '["bc1qoutput"]',
        }
    ]

    validation = _validate_dataset(network, blockchain)

    assert validation["valid"] is True
    assert validation["network_records"] == 1
    assert validation["blockchain_records"] == 1
    assert validation["matching_txids"] == 1
    assert validation["missing_network_fields"] == []
    assert validation["missing_blockchain_fields"] == []


def test_validate_dataset_rejects_missing_required_fields():
    network = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
        }
    ]

    blockchain = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "txid": "TXN0001",
        }
    ]

    validation = _validate_dataset(network, blockchain)

    assert validation["valid"] is False
    assert "dst_ip" in validation["missing_network_fields"]
    assert "src_port" in validation["missing_network_fields"]
    assert "dst_port" in validation["missing_network_fields"]
    assert "input_addresses" in validation["missing_blockchain_fields"]
    assert "output_addresses" in validation["missing_blockchain_fields"]


def test_validation_does_not_report_matching_txids_when_missing():
    network = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": 8333,
            "dst_port": 8333,
        }
    ]

    blockchain = [
        {
            "timestamp": "2026-08-01T09:07:13",
            "txid": "TXN0001",
            "input_addresses": '["bc1qinput"]',
            "output_addresses": '["bc1qoutput"]',
        }
    ]

    validation = _validate_dataset(network, blockchain)

    assert validation["matching_txids"] is None


# ---------------------------------------------------------------------------
# Merged dataset coverage
# ---------------------------------------------------------------------------

def test_split_merged_rows_supports_combined_rows():
    rows = [
        {
            "_source_row": 5,
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": 8333,
            "dst_port": 8333,
            "txid": "TXN0001",
            "input_addresses": '["bc1qinput"]',
            "output_addresses": '["bc1qoutput"]',
            "input_amounts": "[1.25]",
            "output_amounts": "[1.24]",
        }
    ]

    network_rows, tx_rows = _split_merged_rows(rows)

    assert len(network_rows) == 1
    assert len(tx_rows) == 1

    assert network_rows[0]["src_ip"] == "45.33.1.10"
    assert network_rows[0]["txid"] == "TXN0001"

    assert tx_rows[0]["txid"] == "TXN0001"
    assert tx_rows[0]["input_addresses"] == '["bc1qinput"]'


def test_split_merged_rows_supports_separate_shapes():
    rows = [
        {
            "_source_row": 1,
            "timestamp": "2026-08-01T09:07:13",
            "src_ip": "45.33.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": 8333,
            "dst_port": 8333,
        },
        {
            "_source_row": 2,
            "timestamp": "2026-08-01T09:07:13",
            "txid": "TXN0001",
            "input_addresses": '["bc1qinput"]',
            "output_addresses": '["bc1qoutput"]',
        },
    ]

    network_rows, tx_rows = _split_merged_rows(rows)

    assert len(network_rows) == 1
    assert len(tx_rows) == 1

    assert network_rows[0]["src_ip"] == "45.33.1.10"
    assert tx_rows[0]["txid"] == "TXN0001"


# ---------------------------------------------------------------------------
# API upload coverage
# ---------------------------------------------------------------------------

def test_upload_dual_rejects_missing_required_fields():
    network_csv = (
        "timestamp,src_ip\n"
        "2026-08-01T09:07:13,45.33.1.10\n"
    )

    blockchain_csv = (
        "timestamp,txid,input_addresses,output_addresses\n"
        '2026-08-01T09:07:13,TXN0001,"[\\"bc1qinput\\"]","[\\"bc1qoutput\\"]"\n'
    )

    response = client.post(
        "/api/pipeline/upload-dual",
        files={
            "network_file": (
                "network.csv",
                io.BytesIO(network_csv.encode("utf-8")),
                "text/csv",
            ),
            "blockchain_file": (
                "blockchain.csv",
                io.BytesIO(blockchain_csv.encode("utf-8")),
                "text/csv",
            ),
        },
    )

    assert response.status_code == 400

    body = response.json()
    assert body["detail"]["message"] == "Dataset validation failed."
    assert body["detail"]["valid"] is False


def test_upload_rejects_unsupported_file_format():
    response = client.post(
        "/api/pipeline/upload-dual",
        files={
            "network_file": (
                "network.txt",
                io.BytesIO(b"not supported"),
                "text/plain",
            ),
            "blockchain_file": (
                "blockchain.csv",
                io.BytesIO(
                    b"timestamp,txid,input_addresses,output_addresses\n"
                    b"2026-08-01T09:07:13,TXN0001,[],[]\n"
                ),
                "text/csv",
            ),
        },
    )

    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


# ---------------------------------------------------------------------------
# P0 regression test:
# required headers may exist while every row is unparseable.
#
# This test is intentionally expected to fail against the current route
# implementation. The next audit fix will make the API reject this dataset
# instead of returning a false successful analysis with zero ingested rows.
# ---------------------------------------------------------------------------

def test_upload_dual_rejects_unparseable_dataset():
    network_csv = (
        "timestamp,src_ip,dst_ip,src_port,dst_port\n"
        "NOT_A_TIMESTAMP,45.33.1.10,8.8.8.8,8333,8333\n"
    )

    blockchain_csv = (
        "timestamp,txid,input_addresses,output_addresses\n"
        'NOT_A_TIMESTAMP,TXN0001,"[\\"bc1qinput\\"]","[\\"bc1qoutput\\"]"\n'
    )

    response = client.post(
        "/api/pipeline/upload-dual",
        files={
            "network_file": (
                "network.csv",
                io.BytesIO(network_csv.encode("utf-8")),
                "text/csv",
            ),
            "blockchain_file": (
                "blockchain.csv",
                io.BytesIO(blockchain_csv.encode("utf-8")),
                "text/csv",
            ),
        },
    )

    assert response.status_code == 400

    body = response.json()
    assert body["detail"]["valid"] is False
    assert body["detail"]["network_parseable_records"] == 0
    assert body["detail"]["blockchain_parseable_records"] == 0
    assert body["detail"]["network_unparseable_records"] == 1
    assert body["detail"]["blockchain_unparseable_records"] == 1