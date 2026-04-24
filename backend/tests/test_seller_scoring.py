import unittest
from unittest.mock import patch

from app.sentra_engine.seller_scoring import analyze_product_listing, analyze_seller_application


class _Result:
    data = []


class _Query:
    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def ilike(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return _Result()


class _Db:
    def table(self, *args, **kwargs):
        return _Query()


class SellerScoringTests(unittest.TestCase):
    @patch("app.sentra_engine.seller_scoring.get_supabase", return_value=_Db())
    def test_seller_application_score_is_high_when_no_deductions(self, _):
        analysis = analyze_seller_application(
            {
                "phone": "0771234567",
                "store_name": "Kandy Crafts",
                "account_number_last4": "1234",
            },
            {"id": "profile-1", "full_name": "Customer", "phone": "0771234567", "address": "Kandy"},
            [{"document_type": "nic"}, {"document_type": "utility_bill"}],
        )

        self.assertEqual(analysis["risk_score"], 100)
        self.assertEqual(analysis["risk_label"], "Strong")
        self.assertEqual(analysis["reasons"], [])

    @patch("app.sentra_engine.seller_scoring.get_supabase", return_value=_Db())
    def test_seller_application_score_subtracts_deductions(self, _):
        analysis = analyze_seller_application(
            {"phone": "0771234567", "store_name": "Kandy Crafts"},
            {"id": "profile-1", "full_name": "", "phone": "", "address": ""},
            [],
        )

        self.assertEqual(analysis["risk_score"], 72)
        self.assertEqual(analysis["risk_label"], "Needs Review")
        self.assertEqual(sum(reason["score_impact"] for reason in analysis["reasons"]), 28)

    @patch("app.sentra_engine.seller_scoring.get_supabase", return_value=_Db())
    def test_product_listing_score_remains_high_when_risky(self, _):
        analysis = analyze_product_listing(
            {
                "name": "Premium guaranteed perfect deal",
                "description": "short",
                "price": 0,
            },
            {"id": "seller-1"},
        )

        self.assertGreaterEqual(analysis["risk_score"], 30)
        self.assertIn(analysis["risk_label"], {"Suspicious", "High Risk"})


if __name__ == "__main__":
    unittest.main()
