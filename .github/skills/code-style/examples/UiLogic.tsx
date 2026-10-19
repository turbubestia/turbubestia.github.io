import { useState } from 'react';
import { useLogic } from './useLogic';

export function UiLogic() {
  const { state, submit, restart } = useLogic();
  const [input, setInput] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(input);
    if (!Number.isFinite(value)) return;

    submit(value);
    setInput('');
  }

  return (
    <section aria-labelledby="logic-title">
      <h1 id="logic-title">Number challenge</h1>
      <p role="status">
        {state.status === 'complete' ? 'Complete' : 'Choose a number.'}
      </p>
      <p>Attempts: {state.attempts}</p>

      {state.status === 'active' ? (
        <form onSubmit={handleSubmit}>
          <label>
            Number
            <input
              type="number"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <button type="submit">Submit</button>
        </form>
      ) : (
        <button type="button" onClick={restart}>Restart</button>
      )}
    </section>
  );
}