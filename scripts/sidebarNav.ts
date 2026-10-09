import type { Locator, Page } from 'playwright';

/**
 * Click a sidebar link. Collapsed sidebar groups unmount their links, so open them one at a time
 * until the target is visible. Mirrors `e2e/navigation.ts`; kept separate because `scripts/` is
 * runtime-only code that must not import from the test tree.
 */
export async function clickSidebarLink(page: Page, link: Locator): Promise<void> {
  const collapsed = page.locator('#app-nav nav button[aria-expanded="false"]');
  for (let remaining = await collapsed.count(); remaining > 0; remaining--) {
    if (await link.isVisible()) break;
    await collapsed.first().click();
  }
  await link.click();
}
