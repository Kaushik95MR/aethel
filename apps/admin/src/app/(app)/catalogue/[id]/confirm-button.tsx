"use client";

/** A submit button that asks "are you sure?" first. Used for deletes. */
export function ConfirmButton({
  message,
  className,
  children,
  formAction,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
