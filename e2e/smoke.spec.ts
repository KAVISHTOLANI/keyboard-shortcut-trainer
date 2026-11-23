import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

const MAC: Record<string, string> = {
  Copy: 'Meta+C', Paste: 'Meta+V', Cut: 'Meta+X', Undo: 'Meta+Z', Redo: 'Meta+Shift+Z', 'Select all': 'Meta+A', Find: 'Meta+F', Save: 'Meta+S', Bold: 'Meta+B', Italic: 'Meta+I',
  'Move one word left': 'Alt+ArrowLeft', 'Go to start of line': 'Meta+ArrowLeft', 'Go to end of document': 'Meta+ArrowDown', 'Delete previous word': 'Alt+Backspace',
};

test('practise a round, review progress and add a shortcut', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('for the mouse');
  await page.waitForTimeout(1500);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Start practising' }).first().click();
  await page.getByLabel('Deck').selectOption('text');
  await page.getByLabel('Round length').selectOption('5');
  await page.getByRole('radio', { name: 'Mac' }).click();
  await page.getByRole('button', { name: 'Start round' }).click();
  for (let i = 0; i < 5; i++) {
    const prompt = (await page.getByTestId('prompt').textContent())!;
    if (i === 0) {
      await page.keyboard.press('Meta+K');
      await expect(page.getByText('try again')).toBeVisible();
      await snap(page, 'practice');
      await checkMobile(page, 'practice-mobile');
    }
    await page.keyboard.press(MAC[prompt]);
    await expect(page.getByTestId('practice')).toHaveClass(/status-right/);
    if (i < 4) await expect(page.getByTestId('prompt')).not.toHaveText(prompt, { timeout: 3000 });
  }
  await expect(page.getByText('Round complete')).toBeVisible();
  await expect(page.getByTestId('accuracy')).toHaveText('80%');
  await snap(page, 'summary');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('table', { name: 'All rounds, newest first' }).getByRole('row').nth(1)).toContainText('Text editing');
  await snap(page, 'progress');
  await checkMobile(page);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Decks' }).click();
  await page.getByRole('tab', { name: 'My shortcuts' }).click();
  await page.getByLabel('Action', { exact: true }).fill('Toggle comments panel');
  await page.getByRole('textbox', { name: /Shortcut recorder/ }).focus();
  await page.keyboard.press('Control+Alt+M');
  await page.getByRole('button', { name: 'Add shortcut' }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'My shortcuts' }).click();
  await expect(page.getByRole('rowheader', { name: /Toggle comments panel/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Web browser' }).click();
  await snap(page, 'decks');
});
