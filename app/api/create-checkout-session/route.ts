import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { cardId } = body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: "aud",

            product_data: {
              name: "Premium Group E-Card",
              description:
                "Collaborative digital card with photos, scheduling and unlimited messages",
            },

            unit_amount: 499,
          },

          quantity: 1,
        },
      ],

      mode: "payment",

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?cardId=${cardId}`,

      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-cancelled`,
    });

    return Response.json({
      url: session.url,
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