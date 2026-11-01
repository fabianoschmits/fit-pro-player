import type { ButtonHTMLAttributes, ReactNode } from 'react'
export type FppButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> & {
 variant?: string; appearance?: string; size?: string; icon?: string; trailingIcon?: string;
 onAction?: (event: unknown) => unknown; onSuccess?: (value: unknown) => unknown;
 onError?: (error: unknown) => unknown; state?: string; intent?: string;
 loadingLabel?: ReactNode; successLabel?: ReactNode; errorLabel?: ReactNode;
 progress?: number; feedback?: string; activation?: string;
}
