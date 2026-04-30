import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Sonik sign-in heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /sign in to sonik/i,
    }),
  ).toBeInTheDocument();
});
