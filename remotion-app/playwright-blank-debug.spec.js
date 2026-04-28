import {test} from "@playwright/test";

test("debug blank preview page", async ({page}) => {
  page.on("console", (msg) => {
    console.log("CONSOLE", msg.type(), msg.text());
  });
  page.on("pageerror", (error) => {
    console.log("PAGEERROR", error.stack || error.message);
  });
  page.on("requestfailed", (request) => {
    console.log("REQUESTFAILED", request.url(), request.failure()?.errorText);
  });

  await page.goto("http://localhost:3010/?previewLane=hyperframes", {
    waitUntil: "networkidle"
  });

  console.log("TITLE", await page.title());
  console.log("BODY_TEXT", JSON.stringify(await page.locator("body").innerText()));

  await page.screenshot({
    path: "playwright-blank-debug.png",
    fullPage: true
  });
});
