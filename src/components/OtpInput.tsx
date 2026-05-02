import {
  ClipboardEvent,
  KeyboardEvent,
  useEffect,
  useRef,
} from 'react';

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  }

  function handleChange(index: number, raw: string) {
    const sanitized = raw.replace(/\D/g, '');

    if (sanitized.length > 1) {
      const chunk = sanitized.slice(0, length);
      onChange(chunk);
      focusIndex(Math.min(chunk.length, length - 1));
      return;
    }

    const next = digits.slice();
    next[index] = sanitized.slice(-1);
    onChange(next.join(''));

    if (sanitized && index < length - 1) {
      focusIndex(index + 1);
    }
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const next = digits.slice();
        next[index - 1] = '';
        onChange(next.join(''));
        focusIndex(index - 1);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      focusIndex(index - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      focusIndex(index + 1);
      event.preventDefault();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length);

    if (!pasted) {
      return;
    }

    event.preventDefault();
    onChange(pasted);
    focusIndex(Math.min(pasted.length, length - 1));
  }

  return (
    <div className="otp-input" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
