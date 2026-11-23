import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

async function startCustom(user: ReturnType<typeof userEvent.setup>, length = '5') {
  window.location.hash = '/practice';
  await user.selectOptions(await screen.findByLabelText('Deck'), 'custom');
  await user.selectOptions(screen.getByLabelText('Round length'), length);
  await user.click(screen.getByRole('radio', { name: 'Windows / Linux' }));
  await user.click(screen.getByRole('button', { name: 'Start round' }));
}

describe('Keytempo', () => {
  it('runs a round with real key presses, retries and a summary', async () => {
    window.location.hash = '/';
    const user = userEvent.setup();
    render(<App />);
    await startCustom(user);
    expect(screen.getByTestId('prompt')).toHaveTextContent('Toggle dark mode (example)');
    expect(screen.getByTestId('practice')).toHaveFocus();
    // Wrong, then right.
    await user.keyboard('{Control>}l{/Control}');
    expect(screen.getByText(/try again/)).toBeInTheDocument();
    await user.keyboard('{Shift>}{Meta>}l{/Meta}{/Shift}');
    expect(screen.getByText('Got it')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    // Three misses reveal the answer.
    for (let i = 0; i < 3; i++) await user.keyboard('x');
    expect(screen.getByText(/The shortcut is/)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    for (let i = 0; i < 3; i++) { await user.keyboard('{Shift>}{Meta>}l{/Meta}{/Shift}'); await user.keyboard('{Enter}'); }
    expect(await screen.findByText('Round complete')).toBeInTheDocument();
    expect(screen.getByTestId('accuracy')).toHaveTextContent('60%');
    expect(screen.getByRole('button', { name: 'Practise the 1 missed' })).toBeInTheDocument();
    window.location.hash = '/progress';
    expect(await screen.findByRole('table', { name: 'All rounds, newest first' })).toHaveTextContent('My shortcuts');
  });

  it('records a custom shortcut and asks browser-reserved ones as multiple choice', async () => {
    window.location.hash = '/decks';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'My shortcuts' }));
    await user.click(screen.getByRole('button', { name: 'Remove Toggle dark mode (example)' }));
    await user.click(screen.getByRole('button', { name: 'Add shortcut' }));
    expect(screen.getByText('Name the action.')).toBeInTheDocument();
    expect(screen.getByText('Record or type a shortcut.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Action'), 'Close panel');
    await user.type(screen.getByLabelText('Or type it'), 'ctrl+w');
    await user.click(screen.getByRole('button', { name: 'Add shortcut' }));
    expect(screen.getByText(/multiple choice/)).toBeInTheDocument();
    // The recorder captures a pressed combo.
    await user.type(screen.getByLabelText('Action'), 'Duplicate');
    screen.getByRole('textbox', { name: /Shortcut recorder/ }).focus();
    await user.keyboard('{Control>}{Alt>}d{/Alt}{/Control}');
    expect(screen.getByRole('textbox', { name: 'Recorded Control Alt D' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add shortcut' }));
    await user.click(screen.getByRole('button', { name: 'Remove Duplicate' }));

    await startCustom(user);
    const choices = screen.getByRole('group', { name: 'Choose the shortcut' });
    expect(within(choices).getAllByRole('button')).toHaveLength(4);
    await user.click(within(choices).getByRole('img', { name: 'Control W' }));
    expect(screen.getByText(/First try/)).toBeInTheDocument();
  });

  it('shows deck mastery and clears demo data', async () => {
    window.location.hash = '/progress';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Clear demo data' }));
    expect(screen.getByText('No rounds yet')).toBeInTheDocument();
  });

  it('filters a deck', async () => {
    window.location.hash = '/decks';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Web browser' }));
    await user.type(screen.getByLabelText('Filter actions'), 'tab');
    const rows = within(screen.getByRole('table', { name: 'Web browser shortcuts' })).getAllByRole('row');
    expect(rows.length).toBe(6);
  });
});
