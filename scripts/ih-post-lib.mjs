/**
 * Shared Indie Hackers new-post publisher (Playwright page already on /new-post).
 */
export async function dismissOverlays(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter",
      )
      .forEach((el) => el.remove());
    document.body.style.overflow = "auto";
  });
  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click().catch(() => {});
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {{ title: string, body: string }} post
 * @returns {Promise<string>} final URL
 */
export async function publishIhPost(page, post) {
  await dismissOverlays(page);

  const titleEl = page.locator("textarea.post-page__title-field, textarea[placeholder='Enter Title']").first();
  await titleEl.waitFor({ state: "visible", timeout: 20_000 });
  await titleEl.click();
  await titleEl.fill(post.title);

  const bodyEl = page.locator("textarea.edit-post__body-field, textarea[placeholder='Enter Body']").first();
  await bodyEl.waitFor({ state: "visible", timeout: 20_000 });
  await bodyEl.click();
  await bodyEl.fill(post.body);

  // Never touch the spam honeypot input
  const submit = page.getByRole("button", { name: /submit post/i });
  if ((await submit.count()) === 0) {
    throw new Error("SUBMIT POST button not found");
  }
  await submit.first().click();

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (/\/post\/[^/]+/.test(url) && !url.includes("/new-post")) {
      return url.split("?")[0];
    }
  }
  throw new Error(`Post submit did not navigate to a post URL (still at ${page.url()})`);
}
