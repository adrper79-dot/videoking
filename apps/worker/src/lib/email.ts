import type { Env } from "../types";

/**
 * Generate a signed unsubscribe token for a user.
 * Format: base64(userId:expiry:HMAC-SHA256(userId+":"+expiry, BETTER_AUTH_SECRET))
 * Expiry defaults to 30 days from now.
 */
export async function generateUnsubscribeToken(userId: string, env: Env): Promise<string> {
  const expiry = (Date.now() + 30 * 24 * 60 * 60 * 1000).toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(`${userId}:${expiry}`));
  const sig = Buffer.from(sigBuffer).toString("hex");
  return Buffer.from(`${userId}:${expiry}:${sig}`).toString("base64");
}

export type EmailTemplate = 
  | "trial_ending"
  | "trial_ended"
  | "new_video"
  | "watch_party_invite"
  | "payout_milestone"
  | "referral_bonus";

/**
 * Email service for NicheStream
 * Sends transactional emails via Resend (or provider of choice)
 */
export class EmailService {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail = "noreply@itsjusus.com") {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  /**
   * Send trial ending notification email
   */
  async sendTrialEnding(email: string, daysRemaining: number, userName: string): Promise<void> {
    const subject = `Your NicheStream trial ends in ${daysRemaining} days`;
    const html = this.renderTrialEndingEmail(userName, daysRemaining);
    await this.send(email, subject, html);
  }

  /**
   * Send trial ended notification
   */
  async sendTrialEnded(email: string, userName: string): Promise<void> {
    const subject = "Your NicheStream trial has ended";
    const html = this.renderTrialEndedEmail(userName);
    await this.send(email, subject, html);
  }

  /**
   * Send new video notification
   */
  async sendNewVideo(
    email: string,
    creatorName: string,
    videoTitle: string,
    videoUrl: string
  ): Promise<void> {
    const subject = `${creatorName} uploaded: ${videoTitle}`;
    const html = this.renderNewVideoEmail(creatorName, videoTitle, videoUrl);
    await this.send(email, subject, html);
  }

  /**
   * Send watch party invite
   */
  async sendWatchPartyInvite(
    email: string,
    inviterName: string,
    videoTitle: string,
    joinUrl: string
  ): Promise<void> {
    const subject = `${inviterName} invited you to a watch party`;
    const html = this.renderWatchPartyEmail(inviterName, videoTitle, joinUrl);
    await this.send(email, subject, html);
  }

  /**
   * Send payout milestone notification
   */
  async sendPayoutMilestone(
    email: string,
    creatorName: string,
    earningsAmount: number
  ): Promise<void> {
    const subject = `🎉 Earnings milestone: $${(earningsAmount / 100).toFixed(2)}`;
    const html = this.renderPayoutMilestoneEmail(creatorName, earningsAmount);
    await this.send(email, subject, html);
  }

  /**
   * Send referral bonus notification
   */
  async sendReferralBonus(
    email: string,
    referredName: string,
    bonusValue: string
  ): Promise<void> {
    const subject = `Referral bonus: ${bonusValue}`;
    const html = this.renderReferralBonusEmail(referredName, bonusValue);
    await this.send(email, subject, html);
  }

  // ─── HTML Template Renderers ───────────────────────────────────────────

  private renderTrialEndingEmail(userName: string, daysRemaining: number): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #6366f1; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .cta { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
            .footer { color: #999; font-size: 12px; border-top: 1px solid #ede9fe; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Your trial ends in ${daysRemaining} days!</div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Your 14-day free NicheStream trial expires in <strong>${daysRemaining} days</strong>.</p>
              <p>To keep watching exclusive videos, hosting watch parties, and chatting with creators, subscribe to Citizen for just <strong>$1/month</strong>.</p>
              <a href="https://itsjusus.com/pricing?offer=trial_urgent" class="cta">Subscribe Now</a>
              <p style="color: #666; font-size: 12px;">No commitment — cancel anytime.</p>
            </div>
            <div class="footer">
              <p>© NicheStream — Supporting niche creators everywhere</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderTrialEndedEmail(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #f59e0b; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .cta { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
            .footer { color: #999; font-size: 12px; border-top: 1px solid #fef3c7; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">We miss you, ${userName}!</div>
            <div class="content">
              <p>Your trial has ended, but the community is still here.</p>
              <p>Come back and join Citizen for <strong>$1/month</strong> — the same price.</p>
              <p>Catch up on new videos, resume watch parties, and reconnect with creators.</p>
              <a href="https://itsjusus.com/pricing?offer=trial_recovery" class="cta">Reactivate Subscription</a>
            </div>
            <div class="footer">
              <p>© NicheStream — Supporting niche creators everywhere</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderNewVideoEmail(creatorName: string, videoTitle: string, videoUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #6366f1; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .cta { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">🎬 ${creatorName} just uploaded!</div>
            <div class="content">
              <p>New video: <strong>${videoTitle}</strong></p>
              <p>Watch now and join the live chat!</p>
              <a href="${videoUrl}" class="cta">Watch Video</a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderWatchPartyEmail(inviterName: string, videoTitle: string, joinUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #10b981; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .cta { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">👥 ${inviterName} invited you to a watch party!</div>
            <div class="content">
              <p>Video: <strong>${videoTitle}</strong></p>
              <p>Watch together in real-time with synchronized playback and live chat.</p>
              <a href="${joinUrl}" class="cta">Join Watch Party</a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderPayoutMilestoneEmail(creatorName: string, earningsAmount: number): string {
    const amount = (earningsAmount / 100).toFixed(2);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #10b981; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .amount { font-size: 32px; font-weight: bold; color: #10b981; }
            .cta { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">🎉 Earnings Milestone!</div>
            <div class="content">
              <p>Hi ${creatorName},</p>
              <p>Congratulations! Your creator earnings have reached:</p>
              <div class="amount">$${amount}</div>
              <p>View your earnings dashboard and request a payout.</p>
              <a href="https://itsjusus.com/dashboard/earnings" class="cta">View Dashboard</a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderReferralBonusEmail(referredName: string, bonusValue: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #f59e0b; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.6; margin-bottom: 20px; }
            .bonus { font-size: 20px; font-weight: bold; color: #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">🎁 Referral Bonus!</div>
            <div class="content">
              <p><strong>${referredName}</strong> signed up using your referral link!</p>
              <p>You earned: <span class="bonus">${bonusValue}</span></p>
              <p>Keep sharing to unlock more rewards.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // ─── Low-level send ───────────────────────────────────────────────────

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      console.log(`[EMAIL] No API key configured — skipping send to ${to} (${subject})`);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "(unreadable)");
      console.error(`[EMAIL] Resend API error ${res.status} for ${to}: ${errorBody}`);
      // Do not throw — email failures must not crash the caller
    }
  }
}

export async function createEmailService(env: Env): Promise<EmailService> {
  const apiKey = env.EMAIL_API_KEY || "";
  return new EmailService(apiKey);
}
