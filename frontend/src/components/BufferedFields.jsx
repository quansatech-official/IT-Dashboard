import { startTransition, useEffect, useRef } from "react";

const toInputValue = (value) => (value === null || typeof value === "undefined" ? "" : String(value));

function useBufferedCommit(value, onCommit, delay) {
  const inputRef = useRef(null);
  const initialValueRef = useRef(toInputValue(value));
  const latestValueRef = useRef(initialValueRef.current);
  const localValueRef = useRef(initialValueRef.current);
  const focusedRef = useRef(false);
  const timerRef = useRef(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const nextValue = toInputValue(value);
    latestValueRef.current = nextValue;
    if (!focusedRef.current && nextValue !== localValueRef.current) {
      localValueRef.current = nextValue;
      if (inputRef.current) {
        inputRef.current.value = nextValue;
      }
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  const flush = (nextValue = localValueRef.current) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (nextValue === latestValueRef.current) return;
    latestValueRef.current = nextValue;
    startTransition(() => {
      onCommitRef.current?.(nextValue);
    });
  };

  const schedule = (nextValue) => {
    localValueRef.current = nextValue;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => flush(nextValue), delay);
  };

  return {
    inputRef,
    initialValue: initialValueRef.current,
    schedule,
    flush,
    markFocused: () => {
      focusedRef.current = true;
    },
    markBlurred: () => {
      focusedRef.current = false;
    }
  };
}

export function BufferedInput({ value, onCommit, commitDelay = 900, onBlur, onFocus, ...props }) {
  const buffer = useBufferedCommit(value, onCommit, commitDelay);

  return (
    <input
      {...props}
      ref={buffer.inputRef}
      defaultValue={buffer.initialValue}
      onChange={(event) => buffer.schedule(event.target.value)}
      onFocus={(event) => {
        buffer.markFocused();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        buffer.flush(event.target.value);
        buffer.markBlurred();
        onBlur?.(event);
      }}
    />
  );
}

export function BufferedTextarea({ value, onCommit, commitDelay = 900, onBlur, onFocus, ...props }) {
  const buffer = useBufferedCommit(value, onCommit, commitDelay);

  return (
    <textarea
      {...props}
      ref={buffer.inputRef}
      defaultValue={buffer.initialValue}
      onChange={(event) => buffer.schedule(event.target.value)}
      onFocus={(event) => {
        buffer.markFocused();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        buffer.flush(event.target.value);
        buffer.markBlurred();
        onBlur?.(event);
      }}
    />
  );
}
