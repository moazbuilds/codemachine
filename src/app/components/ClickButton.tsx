import { useState } from 'react';

type ClickResponse = {
  message?: string;
};

export function ClickButton(): JSX.Element {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/click', { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: ClickResponse = await response.json();
      setMessage(data.message ?? '');
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error ? caughtError.message : 'Something went wrong';
      setError(errorMessage);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Click me'}
      </button>
      {message && <p>{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default ClickButton;
