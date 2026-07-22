import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-06-24.dahlia",
});

export const PRICE_ID = process.env.STRIPE_PRICE_ID || "";
export const FREE_LIMIT = 5;
