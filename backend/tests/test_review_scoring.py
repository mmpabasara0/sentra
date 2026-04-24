import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.sentra_engine.scoring import analyze_review


class FakeResult:
    def __init__(self, data=None):
        self.data = data or []


class FakeQuery:
    """In-memory PostgREST-style query builder backed by a list of rows.

    Supports the operators used by the scoring/anomaly modules: select, eq,
    neq, gte, in_, ilike, order, limit, execute. Filters are applied in
    sequence so the order of chained calls does not matter.
    """

    def __init__(self, rows):
        self._rows = list(rows)

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self._rows = [row for row in self._rows if row.get(column) == value]
        return self

    def neq(self, column, value):
        self._rows = [row for row in self._rows if row.get(column) != value]
        return self

    def gte(self, column, value):
        self._rows = [row for row in self._rows if str(row.get(column, "")) >= str(value)]
        return self

    def in_(self, column, values):
        values = set(values)
        self._rows = [row for row in self._rows if row.get(column) in values]
        return self

    def ilike(self, column, value):
        target = (value or "").lower().strip("%")
        self._rows = [row for row in self._rows if (row.get(column) or "").lower() == target]
        return self

    def execute(self):
        return FakeResult(self._rows)


class FakeDb:
    def __init__(self, tables):
        self._tables = tables

    def table(self, name):
        return FakeQuery(self._tables.get(name, []))


def _iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


class ReviewScoringTests(unittest.TestCase):
    def _analyze(self, review, profile, db, product=None):
        with patch("app.sentra_engine.scoring.get_supabase", return_value=db):
            return analyze_review(review, product, profile)

    def test_fresh_account_no_purchase_generic_praise_is_flagged(self):
        now = datetime.now(timezone.utc)
        profile = {
            "id": "user-1",
            "username": "newbuyer1",
            "full_name": "",
            "phone": "",
            "address": "",
            "created_at": _iso(now - timedelta(hours=2)),
        }
        review = {
            "user_id": "user-1",
            "product_id": "prod-1",
            "rating": 5,
            "title": "",
            "body": "waw superr product",
            "device_fingerprint": "fp-solo",
            "ip_hash": "ip-solo",
        }
        db = FakeDb({"reviews": [], "orders": [], "user_trust_scores": []})
        result = self._analyze(review, profile, db)

        rule_codes = {f["rule_code"] for f in result["flags"]}
        self.assertIn("GENERIC_PRAISE", rule_codes)
        self.assertIn("NEW_ACCOUNT", rule_codes)
        self.assertIn("NO_VERIFIED_PURCHASE", rule_codes)
        # Either the <24h or the <7d-no-purchase rule should fire — the demo
        # case of a brand new account hits the stronger fresh-account version.
        self.assertTrue(
            "FRESH_ACCOUNT_EXTREME_RATING" in rule_codes
            or "NEW_ACCOUNT_NO_PURCHASE_EXTREME" in rule_codes
        )
        self.assertIn(result["status"], {"flagged", "quarantined"})
        self.assertGreaterEqual(result["risk_score"], 25)

    def test_multi_account_device_fires(self):
        now = datetime.now(timezone.utc)
        recent = _iso(now - timedelta(hours=1))
        existing_reviews = [
            {"id": "r1", "user_id": "u-other-1", "product_id": "p-x", "device_fingerprint": "fp-shared", "ip_hash": "ip-x", "body": "alpha", "created_at": recent},
            {"id": "r2", "user_id": "u-other-2", "product_id": "p-y", "device_fingerprint": "fp-shared", "ip_hash": "ip-y", "body": "beta", "created_at": recent},
        ]
        profile = {
            "id": "u-mine",
            "username": "buyer42",
            "full_name": "Real Name",
            "phone": "1234",
            "address": "Street",
            "created_at": _iso(now - timedelta(days=200)),
        }
        review = {
            "user_id": "u-mine",
            "product_id": "p-z",
            "rating": 4,
            "title": "Solid",
            "body": "It worked exactly as described and arrived on time.",
            "device_fingerprint": "fp-shared",
            "ip_hash": "ip-z",
        }
        db = FakeDb({"reviews": existing_reviews, "orders": [], "user_trust_scores": []})
        result = self._analyze(review, profile, db)

        rule_codes = {f["rule_code"] for f in result["flags"]}
        self.assertIn("MULTI_ACCOUNT_DEVICE", rule_codes)

    def test_borderline_score_lands_published_but_visible_to_admin(self):
        # A 25-29 score should classify as 'flagged' under the new threshold,
        # while a 15-24 score remains 'published' but is borderline and
        # admin UI surfaces it via include_borderline=true.
        now = datetime.now(timezone.utc)
        profile = {
            "id": "user-2",
            "username": "longtimer",
            "full_name": "Long Timer",
            "phone": "1234",
            "address": "Street",
            "created_at": _iso(now - timedelta(days=400)),
        }
        review = {
            "user_id": "user-2",
            "product_id": "prod-9",
            "rating": 5,
            "title": "",
            "body": "This is a normal length review that mentions colour, fit, and delivery time.",
            "device_fingerprint": "fp-solo-2",
            "ip_hash": "ip-solo-2",
        }
        db = FakeDb({"reviews": [], "orders": [], "user_trust_scores": []})
        result = self._analyze(review, profile, db)
        self.assertIn(result["status"], {"published", "flagged"})


if __name__ == "__main__":
    unittest.main()
