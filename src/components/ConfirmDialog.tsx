import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  required?: boolean;
};

type Pending =
  | (ConfirmOptions & {
      kind: 'confirm';
      resolve: (value: boolean) => void;
    })
  | (PromptOptions & {
      kind: 'prompt';
      resolve: (value: string | null) => void;
    });

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const CLOSE_ANIMATION_MS = 180;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const closeTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setIsClosing(false);
      setPending({ kind: 'confirm', resolve, ...options });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setIsClosing(false);
      setPromptValue(options.defaultValue ?? '');
      setPending({ kind: 'prompt', resolve, ...options });
    });
  }, []);

  function close(answer: boolean | string | null) {
    if (!pending || isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      if (pending.kind === 'confirm') {
        pending.resolve(answer === true);
      } else {
        pending.resolve(typeof answer === 'string' ? answer : null);
      }
      setPending(null);
      setIsClosing(false);
      setPromptValue('');
      closeTimerRef.current = null;
    }, CLOSE_ANIMATION_MS);
  }

  function submitPrompt() {
    if (!pending || pending.kind !== 'prompt') return;
    const trimmed = promptValue.trim();
    if (pending.required !== false && !trimmed) return;
    close(trimmed);
  }

  useEffect(() => {
    if (!pending) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(pending?.kind === 'prompt' ? null : false);
      } else if (event.key === 'Enter' && pending?.kind !== 'prompt') {
        event.preventDefault();
        close(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, isClosing]);

  useEffect(() => {
    if (pending?.kind === 'prompt') {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [pending]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const value: DialogContextValue = { confirm, prompt };

  const trimmedValue = promptValue.trim();
  const isPromptOpen = pending !== null && pending.kind === 'prompt';
  const isPromptRequired =
    isPromptOpen && (pending as PromptOptions).required !== false;
  const promptDisabled = isPromptRequired && trimmedValue.length === 0;

  return (
    <DialogContext.Provider value={value}>
      {children}
      {pending ? (
        <div
          className={`confirm-backdrop${isClosing ? ' is-closing' : ''}`}
          onClick={() =>
            close(pending.kind === 'prompt' ? null : false)
          }
          role="presentation"
        >
          <div
            aria-describedby={
              pending.kind === 'confirm' || pending.message
                ? 'confirm-message'
                : undefined
            }
            aria-labelledby="confirm-title"
            className={`confirm-dialog${
              pending.kind === 'confirm' && pending.destructive
                ? ' is-destructive'
                : pending.kind === 'prompt'
                  ? ' is-positive'
                  : ''
            }${isClosing ? ' is-closing' : ''}`}
            onClick={(event) => event.stopPropagation()}
            role={pending.kind === 'prompt' ? 'dialog' : 'alertdialog'}
          >
            <h3 className="confirm-title" id="confirm-title">
              {pending.title}
            </h3>
            {pending.kind === 'confirm' ? (
              <p className="confirm-message" id="confirm-message">
                {pending.message}
              </p>
            ) : null}
            {pending.kind === 'prompt' && pending.message ? (
              <p className="confirm-message" id="confirm-message">
                {pending.message}
              </p>
            ) : null}
            {pending.kind === 'prompt' ? (
              <form
                className="confirm-prompt-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPrompt();
                }}
              >
                <input
                  className="confirm-prompt-input"
                  maxLength={pending.maxLength}
                  onChange={(event) => setPromptValue(event.target.value)}
                  placeholder={pending.placeholder}
                  ref={inputRef}
                  type="text"
                  value={promptValue}
                />
              </form>
            ) : null}
            <div className="confirm-actions">
              <button
                className="subtle-action"
                onClick={() =>
                  close(pending.kind === 'prompt' ? null : false)
                }
                type="button"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                autoFocus={pending.kind !== 'prompt'}
                className={`primary-action${
                  pending.kind === 'confirm' && pending.destructive
                    ? ' destructive'
                    : ''
                }`}
                disabled={promptDisabled}
                onClick={() => {
                  if (pending.kind === 'prompt') {
                    submitPrompt();
                  } else {
                    close(true);
                  }
                }}
                type="button"
              >
                {pending.confirmLabel ??
                  (pending.kind === 'prompt' ? 'Save' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useConfirm() {
  const value = useContext(DialogContext);
  if (!value) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return value.confirm;
}

export function usePrompt() {
  const value = useContext(DialogContext);
  if (!value) {
    throw new Error('usePrompt must be used inside <ConfirmProvider>');
  }
  return value.prompt;
}
