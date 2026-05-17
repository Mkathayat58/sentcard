import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { recipientEmail, recipientName, cardLink } = body;

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
    to: recipientEmail.toLowerCase(),
      subject: `A group card was created for you 🎉`,
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 40px;">
    <div style="max-width: 600px; margin: auto; background: white; border-radius: 20px; padding: 40px; text-align: center;">

      <h1 style="color: #6d28d9; font-size: 32px;">
        🎉 A Special Group Card Is Waiting For You
      </h1>

      <p style="font-size: 18px; color: #333;">
        Hi ${recipientName},
      </p>

      <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Your team has created a thoughtful group card for you.
        Click below to open and view your card.
      </p>

      <a href="${cardLink}"
        style="display: inline-block; margin-top: 25px; background-color: #6d28d9; color: white; padding: 16px 28px; border-radius: 999px; text-decoration: none; font-weight: bold;">
        Open My Card
      </a>

      <p style="margin-top: 35px; font-size: 13px; color: #888;">
        Powered by Ecard Platform
      </p>

    </div>
  </div>
`,
    });
console.log(data);
    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error,
      },
      {
        status: 500,
      }
    );
  }
}