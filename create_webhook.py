import stripe

# Stripe Secret Key
stripe.api_key = "os.getenv('STRIPE_SECRET_KEY') # Add your key to environment variables"

WEBHOOK_URL = "https://plantbased-balance.org/.netlify/functions/stripe-webhook"

try:
    print(f"Attempting to create webhook endpoint for: {WEBHOOK_URL}")
    
    webhook = stripe.WebhookEndpoint.create(
      url=WEBHOOK_URL,
      enabled_events=[
        "invoice.paid",
        "checkout.session.completed",
      ],
    )
    
    print("\nSUCCESS: Webhook Endpoint Created!")
    print(f"Webhook ID: {webhook.id}")
    print(f"Webhook Secret (Signing Secret): {webhook.secret}")
    print("\n--- ACTION REQUIRED ---")
    print("Please copy the 'Webhook Secret' above and add it to your Netlify environment variables as:")
    print("STRIPE_WEBHOOK_SECRET")
    print("----------------------")

except Exception as e:
    print(f"ERROR: {e}")
