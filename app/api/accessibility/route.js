// // File: app/api/accessibility/route.js
// // Next.js App Router API route that fetches accessibility tree using Playwright

// import { chromium } from "playwright";

// export const runtime = "nodejs";

// export async function GET(request) {
//   const { searchParams } = new URL(request.url);
//   console.log("Received request with search params:", searchParams.toString());
//   const url = searchParams.get("url");
//   console.log("Fetching accessibility tree for URL:", url);

//   if (!url) {
//     return new Response(JSON.stringify({ error: "Missing ?url= parameter" }), {
//       status: 400,
//     });
//   }

//   let browser;

//   try {
//     browser = await chromium.launch();
//     console.log("Browser launched", browser);
//     const page = await browser.newPage();
//     console.log(page);

//     await page.goto(url, { waitUntil: "domcontentloaded" });

//     const snapshot = await page.accessibility.snapshot();

//     console.log("Accessibility snapshot fetched for URL:", url);
//     console.log(snapshot);

//     return new Response(JSON.stringify(snapshot), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (err) {
//     return new Response(JSON.stringify({ error: err.message }), {
//       status: 500,
//     });
//   } finally {
//     if (browser) await browser.close();
//   }
// }

export const runtime = "nodejs";

import { chromium } from "playwright";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing ?url=" }, { status: 400 });
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const snapshot = await page.accessibility.snapshot();

    return Response.json(snapshot);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
