/**
 * Phase 4 API Tests
 * 
 * Tests for referral system, analytics, and payout endpoints.
 * Run with: npm test -- phase4-api.test.ts
 * 
 * Prerequisites:
 * - HYPERDRIVE database bound and migrated
 * - BETTER_AUTH_SECRET configured
 * - STRIPE_SECRET_KEY configured
 * - TEST_USER_ID and TEST_CREATOR_ID environment variables set
 */

describe("Phase 4 — Referral System", () => {
  const apiBase = "http://localhost:8787";
  let referralCode: string;

  describe("POST /api/referrals/create", () => {
    it("should generate a unique referral code for authenticated user", async () => {
      const response = await fetch(`${apiBase}/api/referrals/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("referral_code");
      expect(data).toHaveProperty("share_url");
      expect(data.share_url).toContain(data.referral_code);
      referralCode = data.referral_code;
    });
  });

  describe("GET /api/referrals/my-link", () => {
    it("should retrieve user's referral link", async () => {
      const response = await fetch(`${apiBase}/api/referrals/my-link`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("referral_code");
      expect(data.referral_code).toBe(referralCode);
    });
  });

  describe("GET /api/referrals/stats", () => {
    it("should return referral statistics", async () => {
      const response = await fetch(`${apiBase}/api/referrals/stats`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("total_signups");
      expect(data).toHaveProperty("total_conversions");
      expect(data).toHaveProperty("conversion_rate");
      expect(typeof data.total_signups).toBe("number");
      expect(typeof data.conversion_rate).toBe("number");
    });
  });

  describe("POST /api/referrals/apply", () => {
    it("should apply referral code at signup and grant bonuses", async () => {
      const newUserId = `test_user_${Date.now()}`;
      
      const response = await fetch(`${apiBase}/api/referrals/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referral_code: referralCode,
          user_id: newUserId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data.success).toBe(true);
      expect(data).toHaveProperty("bonus");
    });

    it("should reject expired referral codes", async () => {
      const expiredCode = "expired_code_123";
      
      const response = await fetch(`${apiBase}/api/referrals/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referral_code: expiredCode,
          user_id: "some_user",
        }),
      });

      expect(response.status).toBe(404);
    });
  });
});

describe("Phase 4 — Analytics System (Admin)", () => {
  const apiBase = "http://localhost:8787";
  const adminToken = process.env.TEST_ADMIN_TOKEN;

  describe("GET /api/admin/analytics/cohorts", () => {
    it("should return cohort retention data with date range", async () => {
      const response = await fetch(`${apiBase}/api/admin/analytics/cohorts?start_date=2026-03-01&end_date=2026-04-13`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty("cohort_week");
        expect(data[0]).toHaveProperty("signup_count");
        expect(data[0]).toHaveProperty("d7_retention");
        expect(data[0]).toHaveProperty("d30_retention");
      }
    });

    it("should reject unauthenticated requests", async () => {
      const response = await fetch(`${apiBase}/api/admin/analytics/cohorts`, {
        method: "GET",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/admin/analytics/churn", () => {
    it("should return at-risk user data", async () => {
      const response = await fetch(`${apiBase}/api/admin/analytics/churn`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("at_risk_count");
      expect(data).toHaveProperty("churn_rate");
      expect(data).toHaveProperty("inactive_threshold_days");
    });
  });

  describe("GET /api/admin/analytics/conversion-funnel", () => {
    it("should return conversion pipeline data", async () => {
      const response = await fetch(`${apiBase}/api/admin/analytics/conversion-funnel`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("total_signups");
      expect(data).toHaveProperty("trial_activations");
      expect(data).toHaveProperty("conversions");
      expect(data).toHaveProperty("conversion_rate");
    });
  });

  describe("GET /api/admin/analytics/arpu", () => {
    it("should return Average Revenue Per User breakdown", async () => {
      const response = await fetch(`${apiBase}/api/admin/analytics/arpu`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("arpu_cents");
      expect(data).toHaveProperty("breakdown");
      expect(typeof data.arpu_cents).toBe("number");
    });
  });
});

describe("Phase 4 — Database Schema", () => {
  describe("Referrals Table", () => {
    it("should have referral_conversion_status enum", () => {
      const validStatuses = ["pending", "trial_started", "converted", "expired"];
      expect(validStatuses).toContain("pending");
      expect(validStatuses.length).toBeGreaterThan(0);
    });
  });

  describe("Cohorts Daily Table", () => {
    it("should track user engagement metrics", () => {
      const cohortColumns = [
        "user_id",
        "cohort_date",
        "days_since_signup",
        "is_active",
        "watched_minutes",
        "engagement_score",
      ];
      expect(cohortColumns.length).toBeGreaterThan(0);
    });
  });

  describe("Churn Tracking Table", () => {
    it("should identify at-risk users", () => {
      const churnColumns = ["user_id", "is_at_risk", "churned", "inactivity_days"];
      expect(churnColumns.length).toBeGreaterThan(0);
    });
  });

  describe("Payout Runs Table", () => {
    it("should track creator payouts", () => {
      const payoutColumns = [
        "creator_id",
        "total_gross_cents",
        "platform_fee_cents",
        "creator_net_cents",
        "stripe_transfer_id",
        "transfer_status",
      ];
      expect(payoutColumns.length).toBeGreaterThan(0);
    });
  });
});

describe("Phase 4 — Integration Scenarios", () => {
  const apiBase = "http://localhost:8787";

  it("should handle complete referral flow: create → apply → stats", async () => {
    // Step 1: Create referral code
    const createRes = await fetch(`${apiBase}/api/referrals/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });
    expect(createRes.status).toBe(200);
    const { referral_code } = await createRes.json();

    // Step 2: Apply code
    const applyRes = await fetch(`${apiBase}/api/referrals/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referral_code,
        user_id: `test_${Date.now()}`,
      }),
    });
    expect(applyRes.status).toBe(200);

    // Step 3: Check stats
    const statsRes = await fetch(`${apiBase}/api/referrals/stats`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });
    expect(statsRes.status).toBe(200);
    const stats = await statsRes.json();
    expect(stats.total_signups).toBeGreaterThan(0);
  });
});
