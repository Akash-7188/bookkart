import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    let reply = "I'm the Bookkart AI Assistant! How can I help you with buying, selling, or renting books and notes today?";

    const lower = message.toLowerCase();
    if (lower.includes("rent")) {
      reply = "You can rent books from local stores, libraries, or individuals! Browse items with the 'For Rent' badge or list your own books for daily/weekly rental rates.";
    } else if (lower.includes("sell") || lower.includes("list")) {
      reply = "To list an item, click the 'List Item / Sell' button in the top navigation bar. Make sure you are logged in first!";
    } else if (lower.includes("note") || lower.includes("coaching")) {
      reply = "We have coaching materials and university notes available under the 'Coaching Notes' category on the homepage.";
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}