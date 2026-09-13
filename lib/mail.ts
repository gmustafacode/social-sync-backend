import { Resend } from 'resend';

// Initialize Resend with the provided API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, token: string) {
  const confirmLink = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${token}`;

  console.log(`[MAIL] Sending real-time verification email to: ${email}`);

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Default sender for unverified domains
      //  dont change the email for now 
      to: 'ghulammustafa000413@gmail.com', // email,
      subject: 'Verify your email - Socialyncara',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background-color: #f9f9f9;">
          <div style="max-width: 600px; margin: i0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #e1e4e8;">
            <div style="background-color: #7c3aed; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Socialyncara</h1>
            </div>
            <div style="padding: 40px; text-align: center;">
              <h2 style="color: #1a1a1a; margin-bottom: 24px;">Confirm your email address</h2>
              <p style="color: #4a5568; font-size: 16px; line-height: 24px; margin-bottom: 32px;">
                Thanks for signing up! Please verify your email to get full access to your social management dashboard.
              </p>
              <a href="${confirmLink}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 16px 32px; font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.25);">
                Verify Email Now
              </a>
              <p style="color: #718096; font-size: 14px; margin-top: 32px;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
            <div style="background-color: #f7fafc; padding: 24px; text-align: center; border-top: 1px solid #edf2f7;">
              <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                Trouble clicking? Copy this link:<br>
                <a href="${confirmLink}" style="color: #7c3aed; text-decoration: underline;">${confirmLink}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    });


    if (error) {
      console.error('[MAIL] Resend API Error:', error);
      // Fallback for developer visibility in terminal if email fails
      console.log(`[TESTING] Verification Link: ${confirmLink}`);
      return null;
    }

    console.log(`[MAIL] Success! Message ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error('[MAIL] System Crash:', error);
    return null;
  }
}
export async function sendMail({ to, subject, text, html }: { to: string, subject: string, text?: string, html?: string }) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to,
      subject: subject,
      text: text,
      html: html || `<p>${text}</p>`
    });

    if (error) {
      console.error('[MAIL] Send error:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('[MAIL] Send crash:', error);
    return null;
  }
}
